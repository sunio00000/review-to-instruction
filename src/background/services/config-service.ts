/**
 * ConfigService - Chrome Storage에서 설정 로드 및 유효성 검증
 */

import type { Platform, LLMConfig } from '../../types';

export interface ConfigServiceResult {
  token: string;
  llmConfig: LLMConfig;
}

export interface ConfigService {
  loadConfig(platform: Platform): Promise<ConfigServiceResult>;
}

/**
 * ConfigService 구현
 */
export class ConfigServiceImpl implements ConfigService {
  /**
   * 플랫폼에 맞는 설정을 Chrome Storage에서 로드
   */
  async loadConfig(platform: Platform): Promise<ConfigServiceResult> {
    // 1. 플랫폼에 따른 토큰 키 결정
    const tokenKey = platform === 'github' ? 'githubToken' : 'gitlabToken';

    // 2. Chrome Storage에서 설정 가져오기
    const storage = await chrome.storage.sync.get([tokenKey, 'llm']);

    // 3. Token 추출 및 검증
    const token = storage[tokenKey] as string | undefined;
    if (!token) {
      throw new Error(`${platform} token이 설정되지 않았습니다.`);
    }

    // 4. LLM 설정 추출 (기본값 포함)
    const llmConfig = this.ensureLLMConfig(storage.llm);

    return { token, llmConfig };
  }

  /**
   * LLM 설정에 기본값 적용
   */
  private ensureLLMConfig(value: any): LLMConfig {
    return {
      enabled: value?.enabled ?? false,
      provider: value?.provider ?? 'none',
      claudeApiKey: value?.claudeApiKey,
      openaiApiKey: value?.openaiApiKey
    };
  }
}
