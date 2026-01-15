/**
 * Review to Instruction - File Matcher
 * .claude/ 디렉토리에서 기존 파일을 찾고 키워드 기반으로 매칭
 */

import type { ApiClient } from '../background/api-client';
import type { Repository, ClaudeFile, MatchResult, ParsedComment } from '../types';

/**
 * .claude/ 디렉토리에서 매칭되는 파일 찾기
 */
export async function findMatchingFile(
  client: ApiClient,
  repository: Repository,
  parsedComment: ParsedComment
): Promise<MatchResult> {
  try {
    // 1. .claude/ 디렉토리 존재 확인
    const claudeDir = await client.getDirectoryContents(repository, '.claude');
    if (!claudeDir || claudeDir.length === 0) {
      console.log('[FileMatcher] .claude/ directory not found');
      return { file: null, score: 0, isMatch: false };
    }

    // 2. skills/ 디렉토리에서 매칭 파일 찾기
    const skillsMatch = await findInDirectory(
      client,
      repository,
      '.claude/skills',
      parsedComment
    );

    // 매칭 스코어가 70 이상이면 skills 파일 업데이트
    if (skillsMatch.isMatch) {
      console.log('[FileMatcher] Found matching skill:', skillsMatch.file?.path);
      return skillsMatch;
    }

    // 3. 매칭되지 않으면 instructions/ 디렉토리에 새 파일 생성
    console.log('[FileMatcher] No matching file found, will create new instruction');
    return { file: null, score: 0, isMatch: false };

  } catch (error) {
    console.error('[FileMatcher] Error finding matching file:', error);
    return { file: null, score: 0, isMatch: false };
  }
}

/**
 * 특정 디렉토리에서 매칭 파일 찾기
 */
async function findInDirectory(
  client: ApiClient,
  repository: Repository,
  dirPath: string,
  parsedComment: ParsedComment
): Promise<MatchResult> {
  try {
    // 디렉토리 내용 가져오기
    const items = await client.getDirectoryContents(repository, dirPath);
    if (!items || items.length === 0) {
      return { file: null, score: 0, isMatch: false };
    }

    // Markdown 파일만 필터링
    const mdFiles = items.filter(item =>
      item.type === 'file' && item.name.endsWith('.md')
    );

    if (mdFiles.length === 0) {
      return { file: null, score: 0, isMatch: false };
    }

    // 각 파일에 대해 매칭 스코어 계산
    const matchResults: MatchResult[] = [];

    for (const file of mdFiles) {
      const fileContent = await client.getFileContent(repository, file.path);
      if (!fileContent) continue;

      // Base64 디코딩
      const content = decodeBase64(fileContent.content);

      // YAML frontmatter 파싱
      const frontmatter = parseFrontmatter(content);

      // 매칭 스코어 계산
      const score = calculateMatchScore(
        parsedComment,
        frontmatter,
        file.name,
        content
      );

      const claudeFile: ClaudeFile = {
        path: file.path,
        title: frontmatter.title || file.name.replace('.md', ''),
        keywords: frontmatter.keywords || [],
        category: frontmatter.category || 'conventions',
        content,
        frontmatter
      };

      matchResults.push({
        file: claudeFile,
        score,
        isMatch: score >= 70
      });
    }

    // 가장 높은 스코어의 파일 반환
    if (matchResults.length === 0) {
      return { file: null, score: 0, isMatch: false };
    }

    matchResults.sort((a, b) => b.score - a.score);
    return matchResults[0];

  } catch (error) {
    console.error(`[FileMatcher] Error in directory ${dirPath}:`, error);
    return { file: null, score: 0, isMatch: false };
  }
}

/**
 * YAML frontmatter 파싱
 */
function parseFrontmatter(content: string): Record<string, any> {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {};
  }

  const frontmatterText = match[1];
  const frontmatter: Record<string, any> = {};

  // 간단한 YAML 파싱 (key: value 형식)
  const lines = frontmatterText.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    // key: value 파싱
    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmedLine.substring(0, colonIndex).trim();
    let value: any = trimmedLine.substring(colonIndex + 1).trim();

    // 배열 처리 (예: keywords: ["a", "b", "c"])
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        value = JSON.parse(value);
      } catch (e) {
        // JSON 파싱 실패 시 문자열 배열로 처리
        value = value
          .slice(1, -1)
          .split(',')
          .map((v: string) => v.trim().replace(/['"]/g, ''))
          .filter((v: string) => v.length > 0);
      }
    }
    // 따옴표 제거
    else if ((value.startsWith('"') && value.endsWith('"')) ||
             (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  return frontmatter;
}

/**
 * 매칭 스코어 계산 (0-100)
 */
function calculateMatchScore(
  parsedComment: ParsedComment,
  frontmatter: Record<string, any>,
  fileName: string,
  content: string
): number {
  let score = 0;

  // 1. 카테고리 매칭 (30점)
  if (frontmatter.category === parsedComment.category) {
    score += 30;
  } else if (frontmatter.category && parsedComment.category) {
    // 부분 매칭 (예: error-handling vs error)
    if (frontmatter.category.includes(parsedComment.category) ||
        parsedComment.category.includes(frontmatter.category)) {
      score += 15;
    }
  }

  // 2. 키워드 매칭 (50점)
  const fileKeywords = Array.isArray(frontmatter.keywords)
    ? frontmatter.keywords.map((k: string) => k.toLowerCase())
    : [];

  const commentKeywords = parsedComment.keywords.map(k => k.toLowerCase());

  if (fileKeywords.length > 0 && commentKeywords.length > 0) {
    const matchingKeywords = fileKeywords.filter(fk =>
      commentKeywords.some(ck => ck === fk || ck.includes(fk) || fk.includes(ck))
    );

    const keywordMatchRatio = matchingKeywords.length / Math.max(fileKeywords.length, commentKeywords.length);
    score += Math.round(keywordMatchRatio * 50);
  }

  // 3. 파일명 매칭 (20점)
  const fileNameLower = fileName.toLowerCase().replace('.md', '');
  const suggestedNameLower = parsedComment.suggestedFileName.toLowerCase();

  if (fileNameLower === suggestedNameLower) {
    score += 20;
  } else if (fileNameLower.includes(suggestedNameLower) ||
             suggestedNameLower.includes(fileNameLower)) {
    score += 10;
  } else {
    // 파일명에 키워드가 포함되어 있는지 확인
    const keywordsInFileName = commentKeywords.filter(kw =>
      fileNameLower.includes(kw)
    );
    if (keywordsInFileName.length > 0) {
      score += Math.round((keywordsInFileName.length / commentKeywords.length) * 10);
    }
  }

  // 4. 내용 유사도 보너스 (최대 10점)
  const contentLower = content.toLowerCase();
  const matchingContentKeywords = commentKeywords.filter(kw =>
    contentLower.includes(kw)
  );

  if (matchingContentKeywords.length > 0) {
    score += Math.min(10, matchingContentKeywords.length * 2);
  }

  return Math.min(100, score);
}

/**
 * Base64 디코딩
 */
function decodeBase64(base64: string): string {
  try {
    // Base64 디코딩 (UTF-8 지원)
    const decoded = atob(base64);
    return decodeURIComponent(escape(decoded));
  } catch (error) {
    console.error('[FileMatcher] Failed to decode base64:', error);
    return '';
  }
}

/**
 * 파일 경로 생성 (새 파일용)
 */
export function generateFilePath(
  isSkill: boolean,
  fileName: string
): string {
  const dir = isSkill ? '.claude/skills' : '.claude/instructions';
  const normalizedFileName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
  return `${dir}/${normalizedFileName}`;
}

/**
 * 파일명 중복 확인 및 처리
 */
export async function ensureUniqueFileName(
  client: ApiClient,
  repository: Repository,
  basePath: string
): Promise<string> {
  console.log('[FileMatcher] Checking file uniqueness:', basePath);
  let path = basePath;
  let counter = 1;

  while (true) {
    try {
      const existingFile = await client.getFileContent(repository, path);
      if (!existingFile) {
        // 파일이 존재하지 않으면 사용 가능
        console.log('[FileMatcher] File path available:', path);
        return path;
      }

      // 파일이 존재하면 중복되므로 숫자 추가
      console.log('[FileMatcher] File exists, trying alternative name');
      const pathWithoutExt = basePath.replace('.md', '');
      path = `${pathWithoutExt}-${counter}.md`;
      counter++;

      // 무한 루프 방지 (최대 100개)
      if (counter > 100) {
        return `${pathWithoutExt}-${Date.now()}.md`;
      }
    } catch (error) {
      // 에러 발생 시 (404 등) 파일이 없다고 간주
      console.log('[FileMatcher] Error checking file, assuming it does not exist:', error);
      return path;
    }
  }
}
