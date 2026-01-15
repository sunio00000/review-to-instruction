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

// API 설정
export interface ApiConfig {
  githubToken?: string;
  gitlabToken?: string;
  showButtons?: boolean;
}

// 메시지 타입 (Content Script ↔ Background)
export type MessageType =
  | 'GET_CONFIG'
  | 'SAVE_CONFIG'
  | 'CONVERT_COMMENT'
  | 'CREATE_PR'
  | 'TEST_API';

export interface Message {
  type: MessageType;
  payload?: any;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}
