/**
 * Review to Instruction - Project Type Definitions
 * 프로젝트 타입 및 관련 인터페이스 정의
 */

// 지원하는 AI 코딩 도구 타입
export type ProjectType = 'claude-code' | 'cursor' | 'windsurf';

// 각 타입별 설정
export interface ProjectTypeConfig {
  type: ProjectType;
  detectionPath: string;  // 감지할 경로 (예: '.claude/', '.cursorrules')
  enabled: boolean;       // 해당 타입 지원 활성화 여부
}

// 감지 결과
export interface ProjectTypeDetectionResult {
  detectedTypes: ProjectType[];
  configs: Map<ProjectType, ProjectTypeConfig>;
}

// 캐시된 감지 결과
export interface CachedDetectionResult {
  result: ProjectTypeDetectionResult;
  timestamp: number;
}
