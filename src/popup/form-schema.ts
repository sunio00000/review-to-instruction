/**
 * Popup Form 필드 스키마 정의
 *
 * 폼의 모든 필드를 선언적으로 정의합니다.
 * FormManager가 이 스키마를 사용하여 폼 동작을 자동화합니다.
 */

import { FieldSchema, FormState } from '../types/form-manager';

/**
 * Popup 폼의 전체 필드 스키마
 *
 * 8개 필드:
 * 1. github-token: GitHub Personal Access Token (ghp_로 시작)
 * 2. gitlab-token: GitLab Personal Access Token (glpat-로 시작)
 * 3. gitlab-url: GitLab 인스턴스 URL
 * 4. show-buttons: 버튼 표시 여부
 * 5. llm-enabled: LLM 기능 활성화
 * 6. llm-provider: LLM 제공자 선택
 * 7. claude-api-key: Claude API 키 (llmProvider=claude일 때)
 * 8. openai-api-key: OpenAI API 키 (llmProvider=openai일 때)
 */
export const popupFormSchema: FieldSchema[] = [
  // 1. GitHub Token
  {
    id: 'github-token',
    storageKey: 'githubToken_enc',
    type: 'password',
    encrypted: true,
    validation: {
      pattern: /^ghp_[a-zA-Z0-9]{36,}$/,
      message: 'GitHub 토큰은 "ghp_"로 시작해야 합니다.'
    }
  },

  // 2. GitLab Token
  {
    id: 'gitlab-token',
    storageKey: 'gitlabToken_enc',
    type: 'password',
    encrypted: true
    // 검증 제거: 다양한 GitLab 토큰 형식 지원
  },

  // 3. GitLab URL
  {
    id: 'gitlab-url',
    storageKey: 'gitlabUrl',
    type: 'text',
    encrypted: false,
    defaultValue: 'https://gitlab.com',
    validation: {
      pattern: /^https?:\/\/.+$/,
      message: 'URL은 http:// 또는 https://로 시작해야 합니다.',
      custom: (value: string) => {
        try {
          new URL(value);
          return true;
        } catch {
          return 'URL 형식이 올바르지 않습니다.';
        }
      }
    }
  },

  // 4. Show Buttons
  {
    id: 'show-buttons',
    storageKey: 'showButtons',
    type: 'checkbox',
    encrypted: false,
    defaultValue: true
  },

  // 5. LLM Enabled
  {
    id: 'llm-enabled',
    storageKey: 'llmEnabled',
    type: 'checkbox',
    encrypted: false,
    defaultValue: false
  },

  // 6. LLM Provider
  {
    id: 'llm-provider',
    storageKey: 'llmProvider',
    type: 'select',
    encrypted: false,
    defaultValue: 'none'
  },

  // 7. Claude API Key (llmProvider=claude일 때만 표시)
  {
    id: 'claude-api-key',
    storageKey: 'claudeApiKey_enc',
    type: 'password',
    encrypted: true,
    validation: {
      pattern: /^sk-ant-[a-zA-Z0-9_-]{95,}$/,
      message: 'Claude API 키는 "sk-ant-"로 시작해야 합니다.'
    },
    visible: (state: FormState) => state['llm-provider'] === 'claude'
  },

  // 8. OpenAI API Key (llmProvider=openai일 때만 표시)
  {
    id: 'openai-api-key',
    storageKey: 'openaiApiKey_enc',
    type: 'password',
    encrypted: true,
    validation: {
      pattern: /^sk-[a-zA-Z0-9]{32,}$/,
      message: 'OpenAI API 키는 "sk-"로 시작해야 합니다.'
    },
    visible: (state: FormState) => state['llm-provider'] === 'openai'
  }
];
