/**
 * Review to Instruction - Project Type Detector
 * 프로젝트 타입 자동 감지
 */

import type { ApiClient } from '../background/api-client';
import type { Repository } from '../types';
import type {
  ProjectType,
  ProjectTypeConfig,
  ProjectTypeDetectionResult,
  CachedDetectionResult
} from '../types/project-types';

/**
 * 프로젝트 타입 감지기
 * .claude/, .cursorrules, rules/ 존재 여부를 확인하여 프로젝트 타입 자동 감지
 */
export class ProjectTypeDetector {
  private cache: Map<string, CachedDetectionResult> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5분

  /**
   * 프로젝트 타입 감지 (캐싱 적용)
   */
  async detect(
    client: ApiClient,
    repository: Repository
  ): Promise<ProjectTypeDetectionResult> {
    // 캐시 확인
    const cacheKey = this.getCacheKey(repository);
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isCacheExpired(cached)) {
      return cached.result;
    }


    // 병렬로 모든 타입 감지
    const detectionPromises = [
      this.detectClaudeCode(client, repository),
      this.detectCursor(client, repository),
      this.detectWindsurf(client, repository),
      this.detectCodex(client, repository)
    ];

    const results = await Promise.all(detectionPromises);

    // 결과 집계
    const detectedTypes: ProjectType[] = [];
    const configs = new Map<ProjectType, ProjectTypeConfig>();

    results.forEach(result => {
      if (result.detected) {
        detectedTypes.push(result.type);
        configs.set(result.type, result.config);
      }
    });


    // 결과 생성 및 캐시 저장
    const detectionResult: ProjectTypeDetectionResult = {
      detectedTypes,
      configs
    };

    this.cache.set(cacheKey, {
      result: detectionResult,
      timestamp: Date.now()
    });

    return detectionResult;
  }

  /**
   * Claude Code 감지 (.claude/ 디렉토리)
   */
  private async detectClaudeCode(
    client: ApiClient,
    repository: Repository
  ): Promise<{ detected: boolean; type: ProjectType; config: ProjectTypeConfig }> {
    try {
      const contents = await client.getDirectoryContents(repository, '.claude');
      return {
        detected: contents !== null && contents.length > 0,
        type: 'claude-code',
        config: {
          type: 'claude-code',
          detectionPath: '.claude/',
          enabled: true
        }
      };
    } catch (error) {
      return {
        detected: false,
        type: 'claude-code',
        config: {
          type: 'claude-code',
          detectionPath: '.claude/',
          enabled: false
        }
      };
    }
  }

  /**
   * Cursor 감지 (.cursor/rules/ 디렉토리)
   */
  private async detectCursor(
    client: ApiClient,
    repository: Repository
  ): Promise<{ detected: boolean; type: ProjectType; config: ProjectTypeConfig }> {
    try {
      const contents = await client.getDirectoryContents(repository, '.cursor/rules');
      return {
        detected: contents !== null && contents.length > 0,
        type: 'cursor',
        config: {
          type: 'cursor',
          detectionPath: '.cursor/rules/',
          enabled: true
        }
      };
    } catch (error) {
      return {
        detected: false,
        type: 'cursor',
        config: {
          type: 'cursor',
          detectionPath: '.cursor/rules/',
          enabled: false
        }
      };
    }
  }

  /**
   * Windsurf 감지 (.windsurf/rules/ 디렉토리)
   */
  private async detectWindsurf(
    client: ApiClient,
    repository: Repository
  ): Promise<{ detected: boolean; type: ProjectType; config: ProjectTypeConfig }> {
    try {
      const contents = await client.getDirectoryContents(repository, '.windsurf/rules');
      return {
        detected: contents !== null && contents.length > 0,
        type: 'windsurf',
        config: {
          type: 'windsurf',
          detectionPath: '.windsurf/rules/',
          enabled: true
        }
      };
    } catch (error) {
      return {
        detected: false,
        type: 'windsurf',
        config: {
          type: 'windsurf',
          detectionPath: '.windsurf/rules/',
          enabled: false
        }
      };
    }
  }

  /**
   * Codex 감지 (AGENTS.md 파일)
   */
  private async detectCodex(
    client: ApiClient,
    repository: Repository
  ): Promise<{ detected: boolean; type: ProjectType; config: ProjectTypeConfig }> {
    try {
      // AGENTS.md 파일 존재 확인
      const fileContent = await client.getFileContent(repository, 'AGENTS.md');
      return {
        detected: fileContent !== null,
        type: 'codex',
        config: {
          type: 'codex',
          detectionPath: 'AGENTS.md',
          enabled: true
        }
      };
    } catch (error) {
      return {
        detected: false,
        type: 'codex',
        config: {
          type: 'codex',
          detectionPath: 'AGENTS.md',
          enabled: false
        }
      };
    }
  }

  /**
   * 캐시 키 생성
   */
  private getCacheKey(repository: Repository): string {
    return `${repository.platform}:${repository.owner}/${repository.name}:${repository.branch}`;
  }

  /**
   * 캐시 만료 확인
   */
  private isCacheExpired(cached: CachedDetectionResult): boolean {
    return Date.now() - cached.timestamp > this.CACHE_TTL;
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cache.clear();
  }
}
