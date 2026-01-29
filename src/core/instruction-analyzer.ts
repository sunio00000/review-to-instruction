/**
 * Instruction Analyzer
 * 프로젝트의 기존 instruction 파일들을 분석하여 패턴 파악
 */

import type { ApiClient } from '../background/api-client';
import type { Repository, ClaudeFile } from '../types';

export interface InstructionPattern {
  // 디렉토리 구조 패턴
  directories: string[];

  // 파일명 패턴
  namingPattern: 'kebab-case' | 'PascalCase' | 'snake_case';

  // 카테고리별 파일 수
  categoryDistribution: Record<string, number>;

  // 평균 파일 크기
  averageFileSize: number;

  // 주로 사용되는 키워드
  commonKeywords: string[];

  // frontmatter 필드 패턴
  frontmatterFields: string[];
}

export interface AnalysisResult {
  pattern: InstructionPattern;
  existingFiles: ClaudeFile[];
  suggestedLocation: string;
  confidence: number;  // 0-100
  directoryHierarchy?: DirectoryHierarchy;  // 디렉토리 계층 구조
}

export interface DirectoryHierarchy {
  allPaths: string[];  // 모든 디렉토리 경로 배열
  tree: DirectoryNode; // 계층 구조
}

export interface DirectoryNode {
  name: string;
  path: string;
  children: DirectoryNode[];
}

export class InstructionAnalyzer {
  /**
   * 프로젝트의 기존 instruction 파일들 분석
   */
  async analyzeProject(
    client: ApiClient,
    repository: Repository
  ): Promise<AnalysisResult | null> {
    try {
      // .claude/rules 디렉토리 내용 가져오기
      const files = await this.fetchInstructionFiles(client, repository);

      if (files.length === 0) {
        // 기존 파일이 없으면 기본 패턴 반환
        return {
          pattern: this.getDefaultPattern(),
          existingFiles: [],
          suggestedLocation: '.claude/rules',
          confidence: 50
        };
      }

      // 패턴 분석
      const pattern = this.extractPattern(files);

      // 디렉토리 계층 구조 추출
      const directoryHierarchy = this.extractDirectoryHierarchy(files);

      return {
        pattern,
        existingFiles: files,
        suggestedLocation: this.suggestLocation(pattern),
        confidence: this.calculateConfidence(files),
        directoryHierarchy
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * GitHub/GitLab에서 instruction 파일들 가져오기 (재귀 탐색)
   */
  private async fetchInstructionFiles(
    client: ApiClient,
    repository: Repository
  ): Promise<ClaudeFile[]> {
    const instructionsPath = '.claude/rules';
    const files: ClaudeFile[] = [];

    try {
      // 재귀적으로 모든 하위 디렉토리 탐색
      await this.fetchFilesRecursively(client, repository, instructionsPath, files);
    } catch (error) {
      // 디렉토리가 없으면 빈 배열 반환
    }

    return files;
  }

  /**
   * 재귀적으로 디렉토리 탐색
   */
  private async fetchFilesRecursively(
    client: ApiClient,
    repository: Repository,
    dirPath: string,
    accumulator: ClaudeFile[],
    depth: number = 0
  ): Promise<void> {
    // 최대 depth 제한 (성능 보호)
    if (depth > 5) {
      return;
    }

    try {
      const contents = await client.getDirectoryContents(repository, dirPath);

      for (const item of contents) {
        if (item.type === 'file' && item.name.endsWith('.md')) {
          // Markdown 파일 처리
          try {
            const fileContent = await client.getFileContent(repository, item.path);

            if (fileContent && fileContent.content) {
              // Base64 디코딩
              const decodedContent = atob(fileContent.content);
              accumulator.push(this.parseInstructionFile(item.path, decodedContent));
            }
          } catch (error) {
          }
        } else if (item.type === 'dir') {
          // 하위 디렉토리 재귀 탐색
          await this.fetchFilesRecursively(
            client,
            repository,
            item.path,
            accumulator,
            depth + 1
          );
        }
      }
    } catch (error) {
    }
  }

  /**
   * Instruction 파일 파싱
   */
  private parseInstructionFile(path: string, content: string): ClaudeFile {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    let frontmatter: Record<string, any> = {};
    let keywords: string[] = [];
    let category = 'general';

    if (match) {
      const yamlContent = match[1];

      // keywords 추출
      const keywordsMatch = yamlContent.match(/keywords:\s*\[(.*?)\]/);
      if (keywordsMatch) {
        keywords = keywordsMatch[1]
          .split(',')
          .map(k => k.trim().replace(/['"]/g, ''))
          .filter(k => k.length > 0);
      }

      // category 추출
      const categoryMatch = yamlContent.match(/category:\s*["']?(.*?)["']?$/m);
      if (categoryMatch) {
        category = categoryMatch[1];
      }

      // title 추출
      const titleMatch = yamlContent.match(/title:\s*["']?(.*?)["']?$/m);
      if (titleMatch) {
        frontmatter.title = titleMatch[1];
      }

      // 모든 필드 추출
      const fieldMatches = yamlContent.matchAll(/^(\w+):/gm);
      for (const fieldMatch of fieldMatches) {
        frontmatter[fieldMatch[1]] = true;
      }
    }

    return {
      path,
      title: frontmatter.title || path.split('/').pop()?.replace('.md', '') || 'Untitled',
      keywords,
      category,
      content,
      frontmatter
    };
  }

  /**
   * 파일들에서 패턴 추출
   */
  private extractPattern(files: ClaudeFile[]): InstructionPattern {
    // 디렉토리 추출
    const directories = Array.from(
      new Set(files.map(f => {
        const parts = f.path.split('/');
        parts.pop(); // 파일명 제거
        return parts.join('/');
      }))
    );

    // 파일명 패턴 감지
    const namingPattern = this.detectNamingPattern(files);

    // 카테고리별 분포
    const categoryDistribution: Record<string, number> = {};
    files.forEach(f => {
      categoryDistribution[f.category] = (categoryDistribution[f.category] || 0) + 1;
    });

    // 평균 파일 크기
    const averageFileSize = files.reduce((sum, f) => sum + f.content.length, 0) / files.length;

    // 공통 키워드 (빈도수 높은 순)
    const keywordFreq: Record<string, number> = {};
    files.forEach(f => {
      f.keywords.forEach(k => {
        keywordFreq[k] = (keywordFreq[k] || 0) + 1;
      });
    });
    const commonKeywords = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);

    // frontmatter 필드 패턴
    const fieldFreq: Record<string, number> = {};
    files.forEach(f => {
      Object.keys(f.frontmatter).forEach(field => {
        fieldFreq[field] = (fieldFreq[field] || 0) + 1;
      });
    });
    const frontmatterFields = Object.entries(fieldFreq)
      .filter(([, count]) => count >= files.length * 0.5) // 50% 이상 사용
      .map(([field]) => field);

    return {
      directories,
      namingPattern,
      categoryDistribution,
      averageFileSize,
      commonKeywords,
      frontmatterFields
    };
  }

  /**
   * 디렉토리 계층 구조 추출
   */
  private extractDirectoryHierarchy(files: ClaudeFile[]): DirectoryHierarchy {
    const dirSet = new Set<string>();

    // 모든 파일 경로에서 디렉토리 경로 추출
    files.forEach(f => {
      const parts = f.path.split('/');
      parts.pop(); // 파일명 제거

      // 경로의 모든 depth에 대해 디렉토리 추가
      for (let i = 1; i <= parts.length; i++) {
        dirSet.add(parts.slice(0, i).join('/'));
      }
    });

    const allPaths = Array.from(dirSet).sort();

    // 트리 구조 생성
    const tree = this.buildDirectoryTree(allPaths);

    return {
      allPaths,
      tree
    };
  }

  /**
   * 디렉토리 경로 배열에서 트리 구조 생성
   */
  private buildDirectoryTree(paths: string[]): DirectoryNode {
    // 루트 노드 생성
    const root: DirectoryNode = {
      name: '.claude/rules',
      path: '.claude/rules',
      children: []
    };

    // 경로별로 트리에 추가
    paths.forEach(path => {
      if (path === '.claude/rules') return; // 루트는 스킵

      const parts = path.split('/');
      let currentNode = root;

      // .claude/rules 이후 경로만 처리
      const relevantParts = parts.slice(2); // ['.claude', 'instructions', ...] 에서 마지막 부분들

      relevantParts.forEach((part, index) => {
        const fullPath = parts.slice(0, 3 + index).join('/'); // .claude/rules/...

        // 기존 자식 노드 찾기
        let childNode = currentNode.children.find(child => child.name === part);

        if (!childNode) {
          // 새 노드 생성
          childNode = {
            name: part,
            path: fullPath,
            children: []
          };
          currentNode.children.push(childNode);
        }

        currentNode = childNode;
      });
    });

    return root;
  }

  /**
   * 파일명 패턴 감지
   */
  private detectNamingPattern(files: ClaudeFile[]): 'kebab-case' | 'PascalCase' | 'snake_case' {
    const patterns = {
      'kebab-case': 0,
      'PascalCase': 0,
      'snake_case': 0
    };

    files.forEach(f => {
      const filename = f.path.split('/').pop()?.replace('.md', '') || '';

      if (/^[a-z]+(-[a-z]+)*$/.test(filename)) {
        patterns['kebab-case']++;
      } else if (/^[A-Z][a-z]+([A-Z][a-z]+)*$/.test(filename)) {
        patterns['PascalCase']++;
      } else if (/^[a-z]+(_[a-z]+)*$/.test(filename)) {
        patterns['snake_case']++;
      }
    });

    // 가장 많이 사용된 패턴 반환
    const maxPattern = Object.entries(patterns).reduce((max, entry) =>
      entry[1] > max[1] ? entry : max
    );

    return maxPattern[0] as 'kebab-case' | 'PascalCase' | 'snake_case';
  }

  /**
   * 기본 패턴 반환 (기존 파일이 없을 때)
   */
  private getDefaultPattern(): InstructionPattern {
    return {
      directories: ['.claude/rules'],
      namingPattern: 'kebab-case',
      categoryDistribution: {},
      averageFileSize: 500,
      commonKeywords: [],
      frontmatterFields: ['title', 'keywords', 'category', 'created_at']
    };
  }

  /**
   * 제안 위치 결정
   */
  private suggestLocation(pattern: InstructionPattern): string {
    // 가장 많이 사용되는 디렉토리 반환
    if (pattern.directories.length > 0) {
      return pattern.directories[0];
    }
    return '.claude/rules';
  }

  /**
   * 신뢰도 계산
   */
  private calculateConfidence(files: ClaudeFile[]): number {
    if (files.length === 0) return 50;
    if (files.length < 3) return 60;
    if (files.length < 10) return 80;
    return 95;
  }

  /**
   * 유사한 instruction 찾기 (중복 체크용)
   */
  findSimilarInstructions(
    files: ClaudeFile[],
    keywords: string[],
    category: string
  ): ClaudeFile[] {
    return files.filter(file => {
      // 카테고리가 같으면 유사도 높음
      if (file.category === category) {
        // 키워드 중복 체크
        const commonKeywords = file.keywords.filter(k => keywords.includes(k));
        if (commonKeywords.length >= 2) {
          return true;
        }
      }
      return false;
    });
  }
}
