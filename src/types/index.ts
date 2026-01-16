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
  path: string;                 // 파일 경로 (.claude/instructions/ 또는 .claude/skills/)
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
export type LLMProvider = 'claude' | 'openai' | 'none';

// LLM 설정
export interface LLMConfig {
  provider: LLMProvider;      // 'claude', 'openai', 'none'
  claudeApiKey?: string;
  openaiApiKey?: string;
  enabled: boolean;            // LLM 기능 활성화 여부
}

// API 설정
export interface ApiConfig {
  githubToken?: string;
  gitlabToken?: string;
  showButtons?: boolean;
  llm?: LLMConfig;             // LLM 설정 추가
}

// 프로젝트 타입 관련 (Feature 1)
export type { ProjectType, ProjectTypeConfig, ProjectTypeDetectionResult, CachedDetectionResult } from './project-types';

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
  | 'CREATE_PR'
  | 'TEST_API'
  | 'GET_CACHE_STATS'   // Feature 2: 캐시 통계 조회
  | 'CLEAR_CACHE';      // Feature 2: 캐시 초기화

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
