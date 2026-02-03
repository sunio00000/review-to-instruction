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

    // 2. 타겟 브랜치 결정 (baseBranch가 있으면 우선 사용, 없으면 branch 사용)
    const targetBranch = repository.baseBranch || repository.branch;

    // 3. 브랜치 생성 (실패 시 fallback 시도)
    let branchCreated = await client.createBranch(
      repository,
      branchName,
      targetBranch
    );

    // 3-1. 타겟 브랜치로 생성 실패 시, baseBranch로 재시도 (머지된 PR의 경우)
    if (!branchCreated && targetBranch !== repository.baseBranch && repository.baseBranch) {
      branchCreated = await client.createBranch(
        repository,
        branchName,
        repository.baseBranch
      );
    }

    // 3-2. 여전히 실패하면 'develop'으로 재시도
    if (!branchCreated && targetBranch !== 'develop') {
      branchCreated = await client.createBranch(
        repository,
        branchName,
        'develop'
      );
    }

    // 3-3. 'develop'도 실패하면 'main'으로 재시도
    if (!branchCreated && targetBranch !== 'main') {
      branchCreated = await client.createBranch(
        repository,
        branchName,
        'main'
      );
    }

    // 3-4. 'main'도 실패하면 'master'로 최종 시도
    if (!branchCreated && targetBranch !== 'master') {
      branchCreated = await client.createBranch(
        repository,
        branchName,
        'master'
      );
    }

    if (!branchCreated) {
      // 브랜치 생성 실패 - 이미 존재하는 브랜치일 가능성
      // 기존 PR 찾기 시도
      const existingPR = await client.findPullRequestByBranch(repository, branchName);

      if (existingPR) {
        throw new Error(
          `⚠️ Branch "${branchName}" already exists with an open PR/MR!\n\n` +
          `📌 Existing PR: ${existingPR.url}\n\n` +
          `💡 Options:\n` +
          `• View and update the existing PR\n` +
          `• Close the existing PR first\n` +
          `• Or wait - the PR might be merged soon`
        );
      } else {
        throw new Error(
          `⚠️ Branch "${branchName}" already exists!\n\n` +
          `This usually means:\n` +
          `• A PR/MR was already created for this comment\n` +
          `• The branch exists but the PR might be closed/merged\n\n` +
          `💡 You can:\n` +
          `• Check your repository for existing branches\n` +
          `• Delete the branch manually if it's no longer needed`
        );
      }
    }


    // 4. 파일 커밋
    const commitMessage = generateCommitMessage(parsedComment, originalComment, repository, isUpdate);

    try {
      await client.createOrUpdateFile(
        repository,
        filePath,
        fileContent,
        commitMessage,
        branchName,
        undefined,  // sha (GitHub only)
        targetBranch  // baseBranch (파일 존재 여부 확인용)
      );
    } catch (error) {
      // API 클라이언트에서 던진 에러를 그대로 전달
      throw error;
    }


    // 5. PR/MR 생성
    const prTitle = generatePrTitle(parsedComment, isUpdate);
    const prBody = generatePrBody(parsedComment, originalComment, repository, filePath, fileContent, isUpdate);

    const prResult = await client.createPullRequest(
      repository,
      prTitle,
      prBody,
      branchName,
      targetBranch
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
  isWrapup?: boolean;  // Wrapup 모드 여부
  wrapupCommentCount?: number;  // Wrapup 모드일 때 총 코멘트 수
}

/**
 * 다중 파일 PR 생성 전체 플로우
 * - 여러 프로젝트 타입에 대한 파일을 한 번에 커밋
 * - 단일 PR로 생성
 */
export async function createPullRequestWithMultipleFiles(
  options: MultiFilePrCreationOptions
): Promise<PrCreationResult> {
  const { client, repository, parsedComment, originalComment, files, llmClient, isWrapup, wrapupCommentCount } = options;

  try {
    // 0. LLM 요약 생성 (optional)
    let llmSummary: string | null = null;
    if (llmClient) {
      llmSummary = await summarizeCommentForPR(llmClient, parsedComment);
    }

    // 1. 브랜치명 생성
    const branchName = generateBranchName(parsedComment);

    // 2. 타겟 브랜치 결정 (baseBranch가 있으면 우선 사용, 없으면 branch 사용)
    const targetBranch = repository.baseBranch || repository.branch;

    // 3. 브랜치 생성 (실패 시 fallback 시도)
    let branchCreated = await client.createBranch(
      repository,
      branchName,
      targetBranch
    );

    // 3-1. 타겟 브랜치로 생성 실패 시, baseBranch로 재시도 (머지된 PR의 경우)
    if (!branchCreated && targetBranch !== repository.baseBranch && repository.baseBranch) {
      branchCreated = await client.createBranch(
        repository,
        branchName,
        repository.baseBranch
      );
    }

    // 3-2. 여전히 실패하면 'develop'으로 재시도
    if (!branchCreated && targetBranch !== 'develop') {
      branchCreated = await client.createBranch(
        repository,
        branchName,
        'develop'
      );
    }

    // 3-3. 'develop'도 실패하면 'main'으로 재시도
    if (!branchCreated && targetBranch !== 'main') {
      branchCreated = await client.createBranch(
        repository,
        branchName,
        'main'
      );
    }

    // 3-4. 'main'도 실패하면 'master'로 최종 시도
    if (!branchCreated && targetBranch !== 'master') {
      branchCreated = await client.createBranch(
        repository,
        branchName,
        'master'
      );
    }

    if (!branchCreated) {
      // 브랜치 생성 실패 - 이미 존재하는 브랜치일 가능성
      // 기존 PR 찾기 시도
      const existingPR = await client.findPullRequestByBranch(repository, branchName);

      if (existingPR) {
        throw new Error(
          `⚠️ Branch "${branchName}" already exists with an open PR/MR!\n\n` +
          `📌 Existing PR: ${existingPR.url}\n\n` +
          `💡 Options:\n` +
          `• View and update the existing PR\n` +
          `• Close the existing PR first\n` +
          `• Or wait - the PR might be merged soon`
        );
      } else {
        throw new Error(
          `⚠️ Branch "${branchName}" already exists!\n\n` +
          `This usually means:\n` +
          `• A PR/MR was already created for this comment\n` +
          `• The branch exists but the PR might be closed/merged\n\n` +
          `💡 You can:\n` +
          `• Check your repository for existing branches\n` +
          `• Delete the branch manually if it's no longer needed`
        );
      }
    }


    // 4. 각 파일 순차적으로 커밋
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
        branchName,
        undefined,  // sha (GitHub only)
        targetBranch  // baseBranch (파일 존재 여부 확인용)
      );

      if (!commitSuccess) {
        throw new Error(`Failed to commit file: ${file.filePath}`);
      }

    }

    // 5. PR/MR 생성
    const prTitle = isWrapup
      ? `docs: Add AI Instructions from ${wrapupCommentCount} PR/MR conventions`
      : generateMultiFilePrTitle(parsedComment, files, llmSummary);
    const prBody = isWrapup
      ? generateWrapupPrBody(repository, files, wrapupCommentCount || 0)
      : generateMultiFilePrBody(parsedComment, originalComment, repository, files);

    const prResult = await client.createPullRequest(
      repository,
      prTitle,
      prBody,
      branchName,
      targetBranch
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
    `Conventions from PR #${repository.prNumber} ${action} as AI instructions.`,
    '',
    '## Files',
    ''
  ];

  const typeMap: Record<string, string> = {
    'claude-code': 'Claude Code',
    'cursor': 'Cursor',
    'windsurf': 'Windsurf'
  };

  // 파일 목록 (간략)
  files.forEach((file, index) => {
    const typeName = typeMap[file.projectType] || file.projectType;
    const status = file.isUpdate ? 'Updated' : 'New';
    sections.push(`${index + 1}. **${typeName}** (${status}): \`${file.filePath}\``);
  });

  sections.push('');
  sections.push('## Metadata');
  sections.push(`- **Category:** ${parsedComment.category}`);
  sections.push(`- **Keywords:** ${parsedComment.keywords.join(', ')}`);
  sections.push(`- **Source:** [PR #${repository.prNumber}](${originalComment.url}) by @${originalComment.author}`);
  sections.push('');

  // 첫 파일만 접힌 형태로 미리보기 (10줄)
  if (files.length > 0) {
    const firstFile = files[0];
    const typeName = typeMap[firstFile.projectType] || firstFile.projectType;
    sections.push('<details>');
    sections.push(`<summary>Preview: ${typeName}</summary>`);
    sections.push('');
    sections.push('```markdown');
    const previewLines = firstFile.content.split('\n').slice(0, 10);
    sections.push(...previewLines);
    if (firstFile.content.split('\n').length > 10) {
      sections.push('...');
    }
    sections.push('```');
    sections.push('</details>');
    sections.push('');
  }

  sections.push('---');
  sections.push('🤖 Auto-generated by [Review to Instruction](https://github.com/sunio00000/review-to-instruction)');

  return sections.join('\n');
}

/**
 * Wrapup PR 본문 생성 (전체 PR 변환용)
 */
function generateWrapupPrBody(
  repository: Repository,
  files: FileGenerationResult[],
  commentCount: number
): string {
  const sections: string[] = [];

  // Overview
  sections.push('## Overview');
  sections.push('');
  sections.push(`This PR adds AI Instructions extracted from **${commentCount} convention comments** in PR #${repository.prNumber}.`);
  sections.push('');
  sections.push('All comments have been analyzed and converted into structured AI Instructions for:');
  sections.push('- Claude Code (.claude/rules/)');
  sections.push('- Cursor (.cursor/rules/)');
  sections.push('- Windsurf (.windsurf/rules/)');
  sections.push('- Codex (AGENTS.md)');
  sections.push('');

  // File Summary
  sections.push('## Files');
  sections.push('');

  const typeMap: Record<string, string> = {
    'claude-code': 'Claude Code',
    'cursor': 'Cursor',
    'windsurf': 'Windsurf',
    'codex': 'Codex'
  };

  // 프로젝트 타입별 그룹화
  const filesByType = files.reduce((acc, file) => {
    if (!acc[file.projectType]) {
      acc[file.projectType] = [];
    }
    acc[file.projectType].push(file);
    return acc;
  }, {} as Record<string, FileGenerationResult[]>);

  // 각 타입별 파일 수 표시
  Object.entries(filesByType).forEach(([projectType, typeFiles]) => {
    const typeName = typeMap[projectType] || projectType;
    const newFiles = typeFiles.filter(f => !f.isUpdate).length;
    const updatedFiles = typeFiles.filter(f => f.isUpdate).length;

    let statusText = '';
    if (newFiles > 0 && updatedFiles > 0) {
      statusText = `${newFiles} new, ${updatedFiles} updated`;
    } else if (newFiles > 0) {
      statusText = `${newFiles} new`;
    } else {
      statusText = `${updatedFiles} updated`;
    }

    sections.push(`- **${typeName}**: ${typeFiles.length} files (${statusText})`);
  });

  sections.push('');

  // Metadata
  sections.push('## Metadata');
  sections.push('');
  sections.push(`- **Source PR**: #${repository.prNumber}`);
  sections.push(`- **Total Conventions**: ${commentCount}`);
  sections.push(`- **Total Files**: ${files.length}`);
  sections.push('');

  // Footer
  sections.push('---');
  sections.push('🤖 Auto-generated by [Review to Instruction](https://github.com/sunio00000/review-to-instruction)');

  return sections.join('\n');
}
