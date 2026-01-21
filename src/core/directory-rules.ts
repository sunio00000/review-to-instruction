/**
 * Directory Rules
 * 키워드와 카테고리를 디렉토리 경로로 매핑하는 규칙
 */

/**
 * 디렉토리 매칭 결과
 */
export interface DirectoryMatch {
  directory: string;
  score: number;
  matchedKeywords: string[];
}

/**
 * 디렉토리 규칙 관리 클래스
 */
export class DirectoryRules {
  /**
   * 키워드 → 디렉토리 매핑 규칙
   *
   * 프로젝트 타입별로 자주 사용되는 디렉토리 패턴 정의
   */
  private static rules: Record<string, string[]> = {
    // API 관련
    'api': ['api', 'rest', 'restful', 'graphql', 'endpoint', 'request', 'response', 'http', 'fetch'],

    // UI/Frontend 관련
    'ui': ['component', 'ui', 'style', 'layout', 'theme', 'css', 'scss', 'react', 'vue', 'svelte', 'angular'],
    'components': ['component', 'widget', 'element', 'button', 'form', 'input', 'modal', 'dialog'],

    // Database 관련
    'database': ['db', 'database', 'query', 'schema', 'migration', 'orm', 'sql', 'nosql', 'mongodb', 'postgres'],

    // Authentication/Security 관련
    'auth': ['auth', 'authentication', 'authorization', 'security', 'jwt', 'oauth', 'token', 'session', 'login', 'password'],

    // Testing 관련
    'testing': ['test', 'testing', 'spec', 'mock', 'fixture', 'assertion', 'jest', 'vitest', 'mocha', 'cypress'],

    // Documentation 관련
    'docs': ['doc', 'documentation', 'readme', 'guide', 'tutorial', 'manual', 'reference'],

    // Infrastructure/DevOps 관련
    'infra': ['docker', 'container', 'kubernetes', 'k8s', 'deployment', 'ci', 'cd', 'pipeline', 'github-actions'],

    // Architecture/Design 관련
    'architecture': ['architecture', 'design', 'pattern', 'solid', 'ddd', 'microservice', 'monolith'],

    // Performance 관련
    'performance': ['performance', 'optimization', 'cache', 'caching', 'speed', 'benchmark', 'profiling'],

    // Error handling 관련
    'error-handling': ['error', 'exception', 'handling', 'logging', 'monitoring', 'debugging'],

    // Config 관련
    'config': ['config', 'configuration', 'settings', 'env', 'environment', 'variable']
  };

  /**
   * 카테고리 → 디렉토리 기본 매핑
   *
   * 코멘트의 카테고리가 명확할 때 사용
   */
  private static categoryMap: Record<string, string> = {
    'api': 'api',
    'ui': 'ui',
    'frontend': 'ui',
    'backend': 'api',
    'database': 'database',
    'db': 'database',
    'authentication': 'auth',
    'authorization': 'auth',
    'security': 'auth',
    'testing': 'testing',
    'test': 'testing',
    'documentation': 'docs',
    'infrastructure': 'infra',
    'devops': 'infra',
    'deployment': 'infra',
    'architecture': 'architecture',
    'design': 'architecture',
    'performance': 'performance',
    'optimization': 'performance',
    'error': 'error-handling',
    'logging': 'error-handling',
    'config': 'config',
    'configuration': 'config',
    'convention': '', // 컨벤션은 특정 디렉토리 없음 (루트 또는 컨텍스트 기반)
    'general': ''     // 일반은 루트
  };

  /**
   * 카테고리에서 디렉토리 경로 추출
   *
   * @param category 코멘트 카테고리
   * @returns 디렉토리 경로 (없으면 null)
   */
  getCategoryDirectory(category: string): string | null {
    const normalized = category.toLowerCase().trim();
    const directory = DirectoryRules.categoryMap[normalized];

    if (directory === '') {
      // 빈 문자열은 루트 디렉토리 의미
      return null;
    }

    return directory || null;
  }

  /**
   * 키워드 배열을 디렉토리로 매핑
   *
   * @param keywords 코멘트 키워드 배열
   * @returns 매칭된 디렉토리 정보 (없으면 null)
   */
  matchKeywordsToDirectory(keywords: string[]): DirectoryMatch | null {
    if (!keywords || keywords.length === 0) {
      return null;
    }

    const matches: DirectoryMatch[] = [];

    // 각 규칙에 대해 키워드 매칭
    for (const [directory, ruleKeywords] of Object.entries(DirectoryRules.rules)) {
      const matchedKeywords: string[] = [];

      // 코멘트 키워드 중 규칙 키워드와 일치하는 것 찾기
      keywords.forEach(keyword => {
        const normalizedKeyword = keyword.toLowerCase().trim();

        if (ruleKeywords.some(rk => {
          // 완전 일치 또는 부분 일치
          return normalizedKeyword === rk ||
                 normalizedKeyword.includes(rk) ||
                 rk.includes(normalizedKeyword);
        })) {
          matchedKeywords.push(keyword);
        }
      });

      if (matchedKeywords.length > 0) {
        // 점수 계산: (매칭된 키워드 수 / 전체 키워드 수) * 100
        const score = (matchedKeywords.length / keywords.length) * 100;

        matches.push({
          directory,
          score,
          matchedKeywords
        });
      }
    }

    if (matches.length === 0) {
      return null;
    }

    // 점수가 가장 높은 매칭 반환
    matches.sort((a, b) => b.score - a.score);
    return matches[0];
  }

  /**
   * 여러 키워드에서 가능한 모든 디렉토리 후보 반환
   *
   * @param keywords 코멘트 키워드 배열
   * @param topN 반환할 최대 후보 수
   * @returns 디렉토리 매칭 배열 (점수 순)
   */
  getAllMatchingDirectories(keywords: string[], topN: number = 3): DirectoryMatch[] {
    if (!keywords || keywords.length === 0) {
      return [];
    }

    const matches: DirectoryMatch[] = [];

    // 각 규칙에 대해 키워드 매칭
    for (const [directory, ruleKeywords] of Object.entries(DirectoryRules.rules)) {
      const matchedKeywords: string[] = [];

      keywords.forEach(keyword => {
        const normalizedKeyword = keyword.toLowerCase().trim();

        if (ruleKeywords.some(rk => {
          return normalizedKeyword === rk ||
                 normalizedKeyword.includes(rk) ||
                 rk.includes(normalizedKeyword);
        })) {
          matchedKeywords.push(keyword);
        }
      });

      if (matchedKeywords.length > 0) {
        const score = (matchedKeywords.length / keywords.length) * 100;

        matches.push({
          directory,
          score,
          matchedKeywords
        });
      }
    }

    // 점수 순으로 정렬 후 상위 N개 반환
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, topN);
  }

  /**
   * 커스텀 규칙 추가
   *
   * 프로젝트별로 특수한 디렉토리 규칙을 동적으로 추가 가능
   *
   * @param directory 디렉토리 이름
   * @param keywords 매칭할 키워드 배열
   */
  addCustomRule(directory: string, keywords: string[]): void {
    DirectoryRules.rules[directory] = keywords;
  }

  /**
   * 카테고리 매핑 추가
   *
   * @param category 카테고리 이름
   * @param directory 매핑할 디렉토리
   */
  addCategoryMapping(category: string, directory: string): void {
    DirectoryRules.categoryMap[category.toLowerCase()] = directory;
  }

  /**
   * 모든 규칙 반환 (디버깅/검증용)
   */
  getRules(): Record<string, string[]> {
    return { ...DirectoryRules.rules };
  }

  /**
   * 모든 카테고리 매핑 반환 (디버깅/검증용)
   */
  getCategoryMappings(): Record<string, string> {
    return { ...DirectoryRules.categoryMap };
  }
}
