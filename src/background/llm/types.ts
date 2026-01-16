/**
 * LLM 관련 타입 정의
 */

import type { CodeExplanation } from '../../types';

// LLM 제공자 타입
export type LLMProvider = 'claude' | 'openai';

// LLM API 응답
export interface LLMResponse {
  success: boolean;
  data?: LLMAnalysisResult;
  error?: string;
}

// LLM 분석 결과
export interface LLMAnalysisResult {
  summary: string;                      // 코멘트 요약 (1-2문장)
  detailedExplanation: string;         // 상세 설명 (재구성된 코멘트)
  codeExplanations: CodeExplanation[]; // 코드 예시 설명
  additionalKeywords: string[];        // 추가 키워드
  suggestedCategory?: string;          // 제안 카테고리
}

// LLM 클라이언트 인터페이스
export interface ILLMClient {
  provider: LLMProvider;
  analyzeComment(content: string, codeExamples: string[]): Promise<LLMResponse>;
}

// LLM API 에러
export class LLMError extends Error {
  constructor(
    message: string,
    public provider: LLMProvider,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
