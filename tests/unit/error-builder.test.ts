/**
 * ErrorBuilder 단위 테스트
 * 표준화된 에러 응답 생성 검증
 */

import { describe, it, expect } from 'vitest';
import { buildErrorResponse, buildDetailedErrorResponse } from '../../src/background/utils/error-builder';

describe('buildErrorResponse', () => {
  it('Error 객체를 표준 응답으로 변환해야 함', () => {
    const error = new Error('Something went wrong');
    const response = buildErrorResponse(error);

    expect(response.success).toBe(false);
    expect(response.error).toBe('Something went wrong');
  });

  it('문자열 에러를 처리해야 함', () => {
    const response = buildErrorResponse('string error');

    expect(response.success).toBe(false);
    expect(response.error).toBe('string error');
  });

  it('숫자 에러를 문자열로 변환해야 함', () => {
    const response = buildErrorResponse(404);

    expect(response.success).toBe(false);
    expect(response.error).toBe('404');
  });

  it('null/undefined 에러를 처리해야 함', () => {
    const nullResponse = buildErrorResponse(null);
    expect(nullResponse.success).toBe(false);
    expect(nullResponse.error).toBe('null');

    const undefinedResponse = buildErrorResponse(undefined);
    expect(undefinedResponse.success).toBe(false);
    expect(undefinedResponse.error).toBe('undefined');
  });
});

describe('buildDetailedErrorResponse', () => {
  it('에러 코드와 타임스탬프를 포함해야 함', () => {
    const error = new Error('Auth failed');
    const response = buildDetailedErrorResponse(error, 'AUTH_ERROR');

    expect(response.success).toBe(false);
    expect(response.error).toBe('Auth failed');
    expect(response.data).toBeDefined();
    expect(response.data.errorCode).toBe('AUTH_ERROR');
    expect(response.data.timestamp).toBeGreaterThan(0);
  });

  it('에러 코드 없이도 동작해야 함', () => {
    const response = buildDetailedErrorResponse('simple error');

    expect(response.success).toBe(false);
    expect(response.error).toBe('simple error');
    expect(response.data.errorCode).toBeUndefined();
    expect(response.data.timestamp).toBeGreaterThan(0);
  });

  it('문자열 에러도 처리해야 함', () => {
    const response = buildDetailedErrorResponse('string error', 'STR_ERR');

    expect(response.success).toBe(false);
    expect(response.error).toBe('string error');
    expect(response.data.errorCode).toBe('STR_ERR');
  });
});
