/**
 * Review to Instruction - 공통 타입 정의
 */

// GitHub/GitLab 플랫폼 타입
export type Platform = 'github' | 'gitlab';

// 코멘트 정보
export interface Comment {
  id: string;
  author: string;
  content: string;
  htmlContent: string;
  url: string;
  createdAt: string;
  platform: Platform;
  replies?: CommentReply[];  // 스레드의 답글들 (optional)
}

// 코멘트 답글
export interface CommentReply {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

// Discussion Thread (여러 코멘트로 구성)
export interface DiscussionThread {
  id: string;
  platform: Platform;
  comments: Comment[];           // Thread 내 모든 코멘트
  containerElement: HTMLElement; // Discussion 컨테이너 DOM
}

// 파싱된 코멘트
export interface ParsedComment {
  content: string;              // 원본 코멘트 내용
  keywords: string[];           // 추출된 키워드
  category: string;             // 분류 (conventions, patterns, style, architecture 등)
  codeExamples: string[];       // 코드 예시
  suggestedFileName: string;    // 제안 파일명
}

// 코드 설명
export interface CodeExplanation {
  code: string;                 // 원본 코드
  explanation: string;          // LLM 생성 설명
  isGoodExample?: boolean;      // 올바른 예시 여부
}

// LLM 강화 코멘트 (ParsedComment 확장)
export interface EnhancedComment extends ParsedComment {
  llmEnhanced: boolean;                    // LLM으로 강화되었는지 여부
  summary?: string;                         // LLM 생성 요약
  detailedExplanation?: string;            // LLM 생성 상세 설명
  codeExplanations?: CodeExplanation[];    // 코드 예시 설명
  additionalKeywords?: string[];           // LLM이 추출한 추가 키워드
  suggestedCategory?: string;              // LLM이 제안한 카테고리
  reasoning?: ReasoningInfo;               // 추론 정보 (Phase 1)
}

// 추론 정보 (Phase 1: 투명성 강화)
export interface ReasoningInfo {
  detectedIntent: string[];
  keyPhrases: string[];
  codeReferences: string[];
  confidenceScore: number;
}

// 레포지토리 정보
export interface Repository {
  owner: string;
  name: string;
  platform: Platform;
  branch: string;               // 현재 PR/MR이 속한 브랜치
  prNumber: number;             // PR/MR 번호
}

// Claude Code instruction/skill 파일
export interface ClaudeFile {
  path: string;                 // 파일 경로 (.claude/rules/ 또는 .claude/skills/)
  title: string;
  keywords: string[];
  category: string;
  content: string;              // Markdown 내용
  frontmatter: Record<string, any>;  // YAML frontmatter
}

// 매칭 결과
export interface MatchResult {
  file: ClaudeFile | null;
  score: number;                // 0-100
  isMatch: boolean;             // score >= 70
}

// LLM 제공자 타입
export type LLMProvider = 'claude' | 'openai';

// LLM 설정
export interface LLMConfig {
  provider: LLMProvider;      // 'claude' or 'openai' (required)
  claudeApiKey?: string;
  openaiApiKey?: string;
}

// API 설정
export interface ApiConfig {
  githubToken?: string;
  gitlabToken?: string;
  gitlabUrl?: string;          // Self-hosted GitLab URL (선택)
  showButtons?: boolean;
  llm?: LLMConfig;             // LLM 설정 추가
}

// 프로젝트 타입 관련 (Feature 1)
export type { ProjectType, ProjectTypeConfig, ProjectTypeDetectionResult, CachedDetectionResult } from './project-types';

// FormManager 타입 관련
export type { FormState, ValidationRule, FieldSchema } from './form-manager';

// 파일 생성 결과 (Feature 1)
export interface FileGenerationResult {
  projectType: string;  // ProjectType
  filePath: string;
  content: string;
  isUpdate: boolean;
}

// 메시지 타입 (Content Script ↔ Background)
export type MessageType =
  | 'GET_CONFIG'
  | 'SAVE_CONFIG'
  | 'CONVERT_COMMENT'
  | 'CONVERT_THREAD'       // Discussion Thread 전체 변환
  | 'PREVIEW_INSTRUCTION'  // Instruction 미리보기 생성 (LLM 분석만)
  | 'CONFIRM_AND_CONVERT'  // 미리보기 확인 후 실제 변환
  | 'CREATE_PR'
  | 'TEST_API'
  | 'GET_CACHE_STATS'      // Feature 2: 캐시 통계 조회
  | 'CLEAR_CACHE'          // Feature 2: 캐시 초기화
  | 'GET_REPOSITORY_INFO'  // Repository 기본 브랜치 조회
  | 'GET_PR_INFO'          // PR head/base 브랜치 조회
  | 'SET_MASTER_PASSWORD'; // 마스터 비밀번호 설정

export interface Message {
  type: MessageType;
  payload?: any;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// 에러 응답 (표준화된 에러 형식)
export interface ErrorResponse {
  success: false;
  error: {
    message: string;      // 사용자에게 표시할 메시지
    code?: string;        // 에러 코드 (선택)
    timestamp: number;    // 에러 발생 시각
  };
}
