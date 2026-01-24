/**
 * Review to Instruction - PR Creator
 * 브랜치 생성, 파일 커밋, PR/MR 생성
 * Feature 1: 다중 파일 PR 생성 지원
 */

import type { ApiClient } from '../background/api-client';
import type { Repository, ParsedComment, Comment, FileGenerationResult } from '../types';
import type { ILLMClient } from '../background/llm/types';

export interface PrCreationOptions {
  client: ApiClient;
  repository: Repository;
  parsedComment: ParsedComment;
  originalComment: Comment;
  filePath: string;
  fileContent: string;
  isUpdate: boolean;
}

export interface PrCreationResult {
  success: boolean;
  prUrl?: string;
  error?: string;
}

/**
 * PR/MR 생성 전체 플로우
 */
export async function createPullRequest(
  options: PrCreationOptions
): Promise<PrCreationResult> {
  const { client, repository, parsedComment, originalComment, filePath, fileContent, isUpdate } = options;

  try {
    // 1. 브랜치명 생성
    const branchName = generateBranchName(parsedComment);

    // 2. 브랜치 생성
    const branchCreated = await client.createBranch(
      repository,
      branchName,
      repository.branch
    );

    if (!branchCreated) {
      throw new Error('Failed to create branch');
    }


    // 3. 파일 커밋
    const commitMessage = generateCommitMessage(parsedComment, originalComment, repository, isUpdate);

    const commitSuccess = await client.createOrUpdateFile(
      repository,
      filePath,
      fileContent,
      commitMessage,
      branchName
    );

    if (!commitSuccess) {
      throw new Error('Failed to commit file');
    }


    // 4. PR/MR 생성
    const prTitle = generatePrTitle(parsedComment, isUpdate);
    const prBody = generatePrBody(parsedComment, originalComment, repository, filePath, fileContent, isUpdate);

    const prResult = await client.createPullRequest(
      repository,
      prTitle,
      prBody,
      branchName,
      repository.branch
    );

    if (!prResult.success) {
      throw new Error(prResult.error || 'Failed to create PR/MR');
    }


    return {
      success: true,
      prUrl: prResult.url
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 브랜치명 생성 (타임스탬프 포함하여 고유성 보장)
 */
function generateBranchName(parsedComment: ParsedComment): string {
  const keyword = parsedComment.keywords[0] || parsedComment.category;
  const normalizedKeyword = keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // 타임스탬프 추가 (YYYYMMDD-HHMMSS 형식)
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');

  return `ai-instruction/add-${normalizedKeyword}-convention-${timestamp}`;
}

/**
 * 커밋 메시지 생성
 */
function generateCommitMessage(
  parsedComment: ParsedComment,
  originalComment: Comment,
  repository: Repository,
  isUpdate: boolean
): string {
  const action = isUpdate ? 'Update' : 'Add';
  const category = parsedComment.category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const title = `${action} ${category} convention to AI instructions`;

  const purpose = isUpdate
    ? `PR #${repository.prNumber} 리뷰에서 확인된 추가 사례를 기존 컨벤션에 반영`
    : `PR #${repository.prNumber} 리뷰에서 확립된 ${category} 규칙을 AI agents가 활용할 수 있도록 추가`;

  // 예시 추출 (첫 번째 코드 블록만)
  let exampleSection = '';
  if (parsedComment.codeExamples.length > 0) {
    const firstExample = parsedComment.codeExamples[0];
    // 예시가 너무 길면 첫 3줄만
    const exampleLines = firstExample.split('\n').slice(0, 3);
    exampleSection = `\n\n예시:\n${exampleLines.join('\n')}${firstExample.split('\n').length > 3 ? '\n...' : ''}`;
  }

  const source = `\n\n출처: PR #${repository.prNumber}, ${originalComment.author}의 코멘트`;

  return `${title}\n\n목적: ${purpose}${exampleSection}${source}`;
}

/**
 * PR 제목 생성
 */
function generatePrTitle(parsedComment: ParsedComment, isUpdate: boolean): string {
  const action = isUpdate ? 'Update' : 'Add';
  const category = parsedComment.category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const keyword = parsedComment.keywords[0];
  if (keyword) {
    const keywordTitle = keyword
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return `${action} AI instruction: ${keywordTitle} ${category}`;
  }

  return `${action} AI instruction: ${category}`;
}

/**
 * PR 본문 생성
 */
function generatePrBody(
  parsedComment: ParsedComment,
  originalComment: Comment,
  repository: Repository,
  filePath: string,
  fileContent: string,
  isUpdate: boolean
): string {
  const action = isUpdate ? '업데이트' : '추가';

  const sections = [
    '## 개요',
    `PR #${repository.prNumber}의 리뷰 과정에서 확립된 컨벤션을 AI agents용 instruction으로 ${action}했습니다.`,
    '',
    '## 변경 사항',
    `- 파일: \`${filePath}\``,
    `- 카테고리: ${parsedComment.category}`,
    `- 키워드: ${parsedComment.keywords.join(', ')}`,
    '',
    '## 출처',
    `- 원본 PR: #${repository.prNumber}`,
    `- 코멘트 작성자: @${originalComment.author}`,
    `- 코멘트 링크: ${originalComment.url}`,
    '',
    '## 생성된 파일 미리보기',
    '```markdown'
  ];

  // 파일 내용 미리보기 (처음 30줄)
  const previewLines = fileContent.split('\n').slice(0, 30);
  sections.push(...previewLines);

  if (fileContent.split('\n').length > 30) {
    sections.push('...');
  }

  sections.push('```');
  sections.push('');
  sections.push('---');
  sections.push('');
  sections.push('🤖 이 PR은 [Review to Instruction](https://github.com/sunio00000/review-to-instruction)에 의해 자동 생성되었습니다.');

  return sections.join('\n');
}

// ==================== LLM 요약 기능 ====================

/**
 * LLM을 사용하여 코멘트를 한 줄로 요약 (영어로 생성)
 * PR 타이틀과 커밋 메시지에 사용
 */
async function summarizeCommentForPR(
  llmClient: ILLMClient,
  parsedComment: ParsedComment
): Promise<string | null> {
  try {
    const prompt = `Summarize the following code review comment in one concise line (max 80 characters) IN ENGLISH.

Comment content:
${parsedComment.content.slice(0, 500)}

Category: ${parsedComment.category}
Keywords: ${parsedComment.keywords.join(', ')}

Requirements:
- One-line summary (max 80 characters)
- Exclude action verbs like "Add", "Update"
- Focus only on the core rule/convention
- MUST be written in ENGLISH

Examples:
- "Include specific error messages in error handling"
- "Specify initial values when declaring useState hooks"
- "Add error handling after API calls"

Summary:`;

    const summary = await llmClient.generateText(prompt, {
      max_tokens: 100,
      temperature: 0.3
    });

    // 첫 줄만 추출하고 따옴표 제거
    const firstLine = summary
      .split('\n')[0]
      .trim()
      .replace(/^["']|["']$/g, '');

    // 80자 제한
    return firstLine.slice(0, 80);
  } catch (error) {
    // LLM 실패 시 null 반환 (fallback to default)
    return null;
  }
}

// ==================== Feature 1: 다중 파일 PR 생성 ====================

/**
 * 다중 파일 PR 생성 옵션
 */
export interface MultiFilePrCreationOptions {
  client: ApiClient;
  repository: Repository;
  parsedComment: ParsedComment;
  originalComment: Comment;
  files: FileGenerationResult[];  // 여러 파일
  llmClient?: ILLMClient;  // LLM 클라이언트 (optional, 요약 기능용)
}

/**
 * 다중 파일 PR 생성 전체 플로우
 * - 여러 프로젝트 타입에 대한 파일을 한 번에 커밋
 * - 단일 PR로 생성
 */
export async function createPullRequestWithMultipleFiles(
  options: MultiFilePrCreationOptions
): Promise<PrCreationResult> {
  const { client, repository, parsedComment, originalComment, files, llmClient } = options;

  try {
    // 0. LLM 요약 생성 (optional)
    let llmSummary: string | null = null;
    if (llmClient) {
      llmSummary = await summarizeCommentForPR(llmClient, parsedComment);
    }

    // 1. 브랜치명 생성
    const branchName = generateBranchName(parsedComment);

    // 2. 브랜치 생성
    const branchCreated = await client.createBranch(
      repository,
      branchName,
      repository.branch
    );

    if (!branchCreated) {
      throw new Error('Failed to create branch');
    }


    // 3. 각 파일 순차적으로 커밋
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const commitMessage = generateMultiFileCommitMessage(
        parsedComment,
        originalComment,
        repository,
        file,
        llmSummary
      );

      const commitSuccess = await client.createOrUpdateFile(
        repository,
        file.filePath,
        file.content,
        commitMessage,
        branchName
      );

      if (!commitSuccess) {
        throw new Error(`Failed to commit file: ${file.filePath}`);
      }

    }

    // 4. PR/MR 생성
    const prTitle = generateMultiFilePrTitle(parsedComment, files, llmSummary);
    const prBody = generateMultiFilePrBody(
      parsedComment,
      originalComment,
      repository,
      files
    );

    const prResult = await client.createPullRequest(
      repository,
      prTitle,
      prBody,
      branchName,
      repository.branch
    );

    if (!prResult.success) {
      throw new Error(prResult.error || 'Failed to create PR/MR');
    }


    return {
      success: true,
      prUrl: prResult.url
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 다중 파일 커밋 메시지 생성 (영어로)
 */
function generateMultiFileCommitMessage(
  parsedComment: ParsedComment,
  originalComment: Comment,
  repository: Repository,
  file: FileGenerationResult,
  llmSummary: string | null
): string {
  const action = file.isUpdate ? 'Update' : 'Add';
  const projectType = file.projectType;

  // LLM 요약이 있으면 사용, 없으면 기존 방식
  const title = llmSummary
    ? `${action} ${projectType} convention: ${llmSummary}`
    : (() => {
        const category = parsedComment.category
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return `${action} ${category} convention for ${projectType}`;
      })();

  const purpose = file.isUpdate
    ? `Reflects additional cases identified in PR #${repository.prNumber} review to ${projectType} conventions`
    : `Adds rules established in PR #${repository.prNumber} review for ${projectType}`;

  const source = `\n\nSource: PR #${repository.prNumber}, comment by ${originalComment.author}`;

  return `${title}\n\nPurpose: ${purpose}${source}`;
}

/**
 * 다중 파일 PR 제목 생성
 */
function generateMultiFilePrTitle(
  parsedComment: ParsedComment,
  files: FileGenerationResult[],
  llmSummary: string | null
): string {
  const hasUpdates = files.some(f => f.isUpdate);
  const action = hasUpdates ? 'Update' : 'Add';

  // 프로젝트 타입 목록
  const projectTypes = files.map(f => {
    const typeMap: Record<string, string> = {
      'claude-code': 'Claude Code',
      'cursor': 'Cursor',
      'windsurf': 'Windsurf'
    };
    return typeMap[f.projectType] || f.projectType;
  });

  const typesStr = projectTypes.join(', ');

  // LLM 요약이 있으면 사용, 없으면 기존 방식
  if (llmSummary) {
    return `${action} AI conventions (${typesStr}): ${llmSummary}`;
  }

  // Fallback: 기존 방식
  const category = parsedComment.category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const keyword = parsedComment.keywords[0];
  const keywordTitle = keyword
    ? keyword.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : category;

  return `${action} AI conventions (${typesStr}): ${keywordTitle}`;
}

/**
 * 다중 파일 PR 본문 생성 (영어로)
 */
function generateMultiFilePrBody(
  parsedComment: ParsedComment,
  originalComment: Comment,
  repository: Repository,
  files: FileGenerationResult[]
): string {
  const hasUpdates = files.some(f => f.isUpdate);
  const action = hasUpdates ? 'updated' : 'added';

  const sections = [
    '## Overview',
    `Conventions established during PR #${repository.prNumber} review have been ${action} as instructions for multiple AI tools.`,
    '',
    '## Changes',
    '',
    '### Common Information',
    `- Category: ${parsedComment.category}`,
    `- Keywords: ${parsedComment.keywords.join(', ')}`,
    '',
    '### Generated Files',
  ];

  // 각 파일 정보
  files.forEach((file, index) => {
    const typeMap: Record<string, string> = {
      'claude-code': 'Claude Code',
      'cursor': 'Cursor',
      'windsurf': 'Windsurf'
    };
    const typeName = typeMap[file.projectType] || file.projectType;
    const updateStatus = file.isUpdate ? '(Updated)' : '(New)';

    sections.push(`${index + 1}. **${typeName}** ${updateStatus}`);
    sections.push(`   - File: \`${file.filePath}\``);
  });

  sections.push('');
  sections.push('## Source');
  sections.push(`- Original PR: #${repository.prNumber}`);
  sections.push(`- Comment Author: @${originalComment.author}`);
  sections.push(`- Comment Link: ${originalComment.url}`);
  sections.push('');

  // 각 파일 미리보기
  sections.push('## File Previews');
  sections.push('');

  files.forEach((file, index) => {
    const typeMap: Record<string, string> = {
      'claude-code': 'Claude Code',
      'cursor': 'Cursor',
      'windsurf': 'Windsurf'
    };
    const typeName = typeMap[file.projectType] || file.projectType;

    sections.push(`### ${index + 1}. ${typeName} (\`${file.filePath}\`)`);
    sections.push('');
    sections.push('```markdown');

    // 파일 내용 미리보기 (처음 20줄)
    const previewLines = file.content.split('\n').slice(0, 20);
    sections.push(...previewLines);

    if (file.content.split('\n').length > 20) {
      sections.push('...');
    }

    sections.push('```');
    sections.push('');
  });

  sections.push('---');
  sections.push('');
  sections.push('🤖 This PR was automatically generated by [Review to Instruction](https://github.com/sunio00000/review-to-instruction).');

  return sections.join('\n');
}
