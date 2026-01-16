/**
 * Error Builder - 표준화된 에러 응답 생성
 */

import type { MessageResponse } from '../../types';

/**
 * 에러를 표준화된 MessageResponse로 변환
 */
export function buildErrorResponse(error: unknown): MessageResponse {
  const message = error instanceof Error
    ? error.message
    : String(error);

  return {
    success: false,
    error: message
  };
}

/**
 * 상세한 에러 정보를 포함한 응답 생성 (선택적)
 */
export function buildDetailedErrorResponse(
  error: unknown,
  code?: string
): MessageResponse {
  const message = error instanceof Error
    ? error.message
    : String(error);

  return {
    success: false,
    error: message,
    data: {
      errorCode: code,
      timestamp: Date.now()
    }
  };
}
