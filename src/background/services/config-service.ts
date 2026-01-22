/**
 * ConfigService - Chrome Storage에서 설정 로드 및 유효성 검증
 *
 * v2 변경사항:
 * - 토큰을 암호화하여 chrome.storage.local에 저장
 * - chrome.storage.sync에서 local로 자동 마이그레이션
 * - Web Crypto API (AES-GCM 256-bit) 사용
 */

import type { Platform, LLMConfig } from '../../types';
import { CryptoService } from './crypto-service';

export interface ConfigServiceResult {
  token: string;
  llmConfig: LLMConfig;
  gitlabUrl?: string;  // GitLab URL (선택)
}

export interface ConfigService {
  loadConfig(platform: Platform): Promise<ConfigServiceResult>;
}

/**
 * ConfigService 구현
 */
export class ConfigServiceImpl implements ConfigService {
  private crypto = new CryptoService();
  private migrationComplete = false;

  /**
   * 플랫폼에 맞는 설정을 Chrome Storage에서 로드
   */
  async loadConfig(platform: Platform): Promise<ConfigServiceResult> {

    // 0. 자동 마이그레이션 (sync → local, 한 번만 실행)
    if (!this.migrationComplete) {
      await this.migrateToEncryptedStorage();
      this.migrationComplete = true;
    }

    // 1. 플랫폼에 따른 토큰 키 결정
    const tokenKey = platform === 'github' ? 'githubToken' : 'gitlabToken';
    const encryptedTokenKey = `${tokenKey}_enc`;

    // 2. Chrome Storage Local에서 암호화된 설정 가져오기
    const storage = await chrome.storage.local.get([
      encryptedTokenKey,
      'gitlabUrl',
      'claudeApiKey_enc',
      'openaiApiKey_enc',
      'llmProvider',
      'llmEnabled'
    ]);

      hasEncryptedToken: !!storage[encryptedTokenKey],
      gitlabUrl: storage.gitlabUrl,
      hasClaudeKey: !!storage.claudeApiKey_enc,
      hasOpenAIKey: !!storage.openaiApiKey_enc
    });

    // 3. Token 복호화
    const encryptedToken = storage[encryptedTokenKey] as string | undefined;
    if (!encryptedToken) {
      throw new Error(`${platform} token이 설정되지 않았습니다. Popup에서 토큰을 입력해주세요.`);
    }

    let token: string;
    try {
      token = await this.crypto.decrypt(encryptedToken);
    } catch (error) {
      throw new Error(`${platform} token 복호화에 실패했습니다. 토큰을 다시 입력해주세요.`);
    }

    // 4. GitLab URL 추출 (선택적, 암호화 불필요)
    const gitlabUrl = platform === 'gitlab' ? (storage.gitlabUrl as string | undefined) : undefined;

    // 5. LLM API 키 복호화
    let claudeApiKey: string | undefined;
    let openaiApiKey: string | undefined;

    if (storage.claudeApiKey_enc) {
      try {
        claudeApiKey = await this.crypto.decrypt(storage.claudeApiKey_enc as string);
      } catch (error) {
      }
    }

    if (storage.openaiApiKey_enc) {
      try {
        openaiApiKey = await this.crypto.decrypt(storage.openaiApiKey_enc as string);
      } catch (error) {
      }
    }

    // 6. LLM 설정 구성
    const llmConfig: LLMConfig = {
      enabled: (storage.llmEnabled as boolean | undefined) ?? false,
      provider: (storage.llmProvider as 'claude' | 'openai' | 'none' | undefined) ?? 'none',
      claudeApiKey,
      openaiApiKey
    };

      enabled: llmConfig.enabled,
      provider: llmConfig.provider,
      hasClaudeKey: !!llmConfig.claudeApiKey,
      hasOpenAIKey: !!llmConfig.openaiApiKey
    });

    return { token, llmConfig, gitlabUrl };
  }

  /**
   * 자동 마이그레이션: sync → local + 암호화
   *
   * 기존 chrome.storage.sync에 저장된 평문 토큰을 암호화하여
   * chrome.storage.local로 이동합니다.
   */
  private async migrateToEncryptedStorage(): Promise<void> {
    try {
      // 1. 마이그레이션 완료 플래그 확인
      const migrated = await chrome.storage.local.get('migration_v2_complete');
      if (migrated.migration_v2_complete) {
        return;
      }


      // 2. 기존 sync 데이터 읽기
      const syncData = await chrome.storage.sync.get([
        'githubToken',
        'gitlabToken',
        'gitlabUrl',
        'llm'
      ]);

      // 3. 마이그레이션 필요 여부 확인
      const hasOldData = !!(syncData.githubToken || syncData.gitlabToken || syncData.llm);
      if (!hasOldData) {
        await chrome.storage.local.set({ migration_v2_complete: true });
        return;
      }

        hasGitHubToken: !!syncData.githubToken,
        hasGitLabToken: !!syncData.gitlabToken,
        hasLLM: !!syncData.llm
      });

      // 4. 암호화하여 local에 저장
      const encryptedData: Record<string, any> = {};

      const githubToken = syncData.githubToken as string | undefined;
      const gitlabToken = syncData.gitlabToken as string | undefined;
      const llmData = syncData.llm as any;

      if (githubToken) {
        encryptedData.githubToken_enc = await this.crypto.encrypt(githubToken);
      }

      if (gitlabToken) {
        encryptedData.gitlabToken_enc = await this.crypto.encrypt(gitlabToken);
      }

      if (llmData?.claudeApiKey) {
        encryptedData.claudeApiKey_enc = await this.crypto.encrypt(llmData.claudeApiKey);
      }

      if (llmData?.openaiApiKey) {
        encryptedData.openaiApiKey_enc = await this.crypto.encrypt(llmData.openaiApiKey);
      }

      // LLM 설정 (provider, enabled)
      if (llmData) {
        encryptedData.llmProvider = llmData.provider ?? 'none';
        encryptedData.llmEnabled = llmData.enabled ?? false;
      }

      // gitlabUrl은 암호화 불필요 (민감 정보 아님)
      if (syncData.gitlabUrl) {
        encryptedData.gitlabUrl = syncData.gitlabUrl;
      }

      // 5. local에 저장
      await chrome.storage.local.set(encryptedData);

      // 6. sync에서 민감 정보 삭제
      await chrome.storage.sync.remove(['githubToken', 'gitlabToken', 'llm']);

      // 7. 마이그레이션 완료 플래그
      await chrome.storage.local.set({ migration_v2_complete: true });

    } catch (error) {
      // 마이그레이션 실패해도 계속 진행 (기존 동작 유지)
    }
  }

}
