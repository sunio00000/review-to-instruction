/**
 * Review to Instruction - PR Creator
 * 브랜치 생성, 파일 커밋, PR/MR 생성
 * Feature 1: 다중 파일 PR 생성 지원
 */

import type { ApiClient } from '../background/api-client';
import type { Repository, ParsedComment, Comment, FileGenerationResult } from '../types';

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
    console.log('[PrCreator] Branch name:', branchName);
    console.log('[PrCreator] Base branch:', repository.branch);

    // 2. 브랜치 생성
    console.log('[PrCreator] Creating branch...');
    const branchCreated = await client.createBranch(
      repository,
      branchName,
      repository.branch
    );

    if (!branchCreated) {
      throw new Error('Failed to create branch');
    }

    console.log('[PrCreator] Branch created successfully');

    // 3. 파일 커밋
    console.log('[PrCreator] Preparing to commit file:', filePath);
    const commitMessage = generateCommitMessage(parsedComment, originalComment, repository, isUpdate);
    console.log('[PrCreator] Commit message:', commitMessage.split('\n')[0]);

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

    console.log('[PrCreator] File committed successfully to branch:', branchName);

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

    console.log('[PrCreator] PR/MR created successfully:', prResult.url);

    return {
      success: true,
      prUrl: prResult.url
    };

  } catch (error) {
    console.error('[PrCreator] Failed to create PR/MR:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 브랜치명 생성
 */
function generateBranchName(parsedComment: ParsedComment): string {
  const keyword = parsedComment.keywords[0] || parsedComment.category;
  const normalizedKeyword = keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `ai-instruction/add-${normalizedKeyword}-convention`;
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
}

/**
 * 다중 파일 PR 생성 전체 플로우
 * - 여러 프로젝트 타입에 대한 파일을 한 번에 커밋
 * - 단일 PR로 생성
 */
export async function createPullRequestWithMultipleFiles(
  options: MultiFilePrCreationOptions
): Promise<PrCreationResult> {
  const { client, repository, parsedComment, originalComment, files } = options;

  try {
    console.log(`[PrCreator] Creating PR with ${files.length} files`);

    // 1. 브랜치명 생성
    const branchName = generateBranchName(parsedComment);
    console.log('[PrCreator] Branch name:', branchName);

    // 2. 브랜치 생성
    console.log('[PrCreator] Creating branch...');
    const branchCreated = await client.createBranch(
      repository,
      branchName,
      repository.branch
    );

    if (!branchCreated) {
      throw new Error('Failed to create branch');
    }

    console.log('[PrCreator] Branch created successfully');

    // 3. 각 파일 순차적으로 커밋
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[PrCreator] Committing file ${i + 1}/${files.length}: ${file.filePath}`);

      const commitMessage = generateMultiFileCommitMessage(
        parsedComment,
        originalComment,
        repository,
        file
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

      console.log(`[PrCreator] File ${i + 1}/${files.length} committed successfully`);
    }

    // 4. PR/MR 생성
    const prTitle = generateMultiFilePrTitle(parsedComment, files);
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

    console.log('[PrCreator] Multi-file PR/MR created successfully:', prResult.url);

    return {
      success: true,
      prUrl: prResult.url
    };

  } catch (error) {
    console.error('[PrCreator] Failed to create multi-file PR/MR:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 다중 파일 커밋 메시지 생성
 */
function generateMultiFileCommitMessage(
  parsedComment: ParsedComment,
  originalComment: Comment,
  repository: Repository,
  file: FileGenerationResult
): string {
  const action = file.isUpdate ? 'Update' : 'Add';
  const projectType = file.projectType;

  const category = parsedComment.category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const title = `${action} ${category} convention for ${projectType}`;

  const purpose = file.isUpdate
    ? `PR #${repository.prNumber} 리뷰에서 확인된 추가 사례를 ${projectType} 컨벤션에 반영`
    : `PR #${repository.prNumber} 리뷰에서 확립된 ${category} 규칙을 ${projectType}용으로 추가`;

  const source = `\n\n출처: PR #${repository.prNumber}, ${originalComment.author}의 코멘트`;

  return `${title}\n\n목적: ${purpose}${source}`;
}

/**
 * 다중 파일 PR 제목 생성
 */
function generateMultiFilePrTitle(
  parsedComment: ParsedComment,
  files: FileGenerationResult[]
): string {
  const hasUpdates = files.some(f => f.isUpdate);
  const action = hasUpdates ? 'Update' : 'Add';

  const category = parsedComment.category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const keyword = parsedComment.keywords[0];
  const keywordTitle = keyword
    ? keyword.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : category;

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

  return `${action} AI conventions (${typesStr}): ${keywordTitle}`;
}

/**
 * 다중 파일 PR 본문 생성
 */
function generateMultiFilePrBody(
  parsedComment: ParsedComment,
  originalComment: Comment,
  repository: Repository,
  files: FileGenerationResult[]
): string {
  const hasUpdates = files.some(f => f.isUpdate);
  const action = hasUpdates ? '업데이트' : '추가';

  const sections = [
    '## 개요',
    `PR #${repository.prNumber}의 리뷰 과정에서 확립된 컨벤션을 여러 AI 도구용 instruction으로 ${action}했습니다.`,
    '',
    '## 변경 사항',
    '',
    '### 공통 정보',
    `- 카테고리: ${parsedComment.category}`,
    `- 키워드: ${parsedComment.keywords.join(', ')}`,
    '',
    '### 생성된 파일',
  ];

  // 각 파일 정보
  files.forEach((file, index) => {
    const typeMap: Record<string, string> = {
      'claude-code': 'Claude Code',
      'cursor': 'Cursor',
      'windsurf': 'Windsurf'
    };
    const typeName = typeMap[file.projectType] || file.projectType;
    const updateStatus = file.isUpdate ? '(업데이트)' : '(신규)';

    sections.push(`${index + 1}. **${typeName}** ${updateStatus}`);
    sections.push(`   - 파일: \`${file.filePath}\``);
  });

  sections.push('');
  sections.push('## 출처');
  sections.push(`- 원본 PR: #${repository.prNumber}`);
  sections.push(`- 코멘트 작성자: @${originalComment.author}`);
  sections.push(`- 코멘트 링크: ${originalComment.url}`);
  sections.push('');

  // 각 파일 미리보기
  sections.push('## 생성된 파일 미리보기');
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
  sections.push('🤖 이 PR은 [Review to Instruction](https://github.com/sunio00000/review-to-instruction)에 의해 자동 생성되었습니다.');

  return sections.join('\n');
}
