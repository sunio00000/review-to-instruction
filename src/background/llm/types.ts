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
  tokenUsage?: TokenUsage;  // 토큰 사용량 추가
}

// LLM 분석 결과
export interface LLMAnalysisResult {
  summary: string;                      // 코멘트 요약 (1-2문장)
  detailedExplanation: string;         // 상세 설명 (재구성된 코멘트)
  codeExplanations: CodeExplanation[]; // 코드 예시 설명
  additionalKeywords: string[];        // 추가 키워드
  suggestedCategory?: string;          // 제안 카테고리
  reasoning?: ReasoningInfo;           // Chain-of-Thought 추론 정보 (Phase 1)
}

// Chain-of-Thought 추론 정보 (Phase 1: 투명성 강화)
export interface ReasoningInfo {
  detectedIntent: string[];            // 감지된 의도 (예: "코드 리팩토링 요청", "버그 수정 제안")
  keyPhrases: string[];                // 추출된 핵심 문구
  codeReferences: string[];            // 언급된 코드 위치
  confidenceScore: number;             // 신뢰도 점수 (0-100)
}

// Instruction 생성 결과 (Phase 1: 미리보기 모달용)
export interface InstructionResult {
  content: string;                     // 생성된 Instruction 내용
  reasoning: ReasoningInfo;            // 추론 과정
  sources: CommentSource[];            // 참조한 코멘트
}

// 참조 코멘트 정보
export interface CommentSource {
  commentId: string;                   // 코멘트 ID
  author: string;                      // 작성자
  excerpt: string;                     // 해당 코멘트에서 사용된 부분
  weight: number;                      // 이 코멘트의 영향력 (0-1)
}

// 토큰 사용량
export interface TokenUsage {
  inputTokens: number;    // 입력 토큰 수
  outputTokens: number;   // 출력 토큰 수
  totalTokens: number;    // 총 토큰 수
}

// LLM 클라이언트 인터페이스
export interface ILLMClient {
  provider: LLMProvider;
  analyzeComment(
    content: string,
    codeExamples: string[],
    replies?: Array<{ author: string; content: string; createdAt: string; }>,
    existingKeywords?: string[],
    codeContext?: { filePath: string; lines: string; startLine?: number; endLine?: number; }
  ): Promise<LLMResponse>;
  generateText(prompt: string, options?: {
    max_tokens?: number;
    temperature?: number;
    system?: string;
  }): Promise<string>;
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

// 유사도 검사 결과 (Phase 1: 중복 파일 방지)
export interface SimilarityCheckResult {
  success: boolean;
  data?: {
    similarity: number;  // 0-100
    decision: 'IDENTICAL' | 'MERGE' | 'DIFFERENT';
    reasoning: string;
  };
  error?: string;
  tokenUsage?: TokenUsage;
}
