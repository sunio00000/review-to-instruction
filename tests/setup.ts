/**
 * Vitest 테스트 환경 설정
 *
 * Chrome Extension API 모킹 및 전역 설정
 */

import { vi } from 'vitest';

// Chrome Extension API 모킹
global.chrome = {
  runtime: {
    id: 'test-extension-id-123456789'
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn()
    }
  }
} as any;

// Web Crypto API 모킹 (Node.js 환경에서 사용 가능)
if (typeof crypto === 'undefined') {
  const { webcrypto } = require('crypto');
  global.crypto = webcrypto as any;
}
