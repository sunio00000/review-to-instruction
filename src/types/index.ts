/**
 * Review to Instruction - common type definitions
 */

// GitHub/GitLab platform type
export type Platform = 'github' | 'gitlab';

// Comment info
export interface Comment {
  id: string;
  author: string;
  content: string;
  htmlContent: string;
  url: string;
  createdAt: string;
  platform: Platform;
  replies?: CommentReply[];  // Replies in the thread (optional)
}

// Comment reply
export interface CommentReply {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

// Discussion Thread (multiple comments)
export interface DiscussionThread {
  id: string;
  platform: Platform;
  comments: Comment[];           // All comments in the thread
  containerElement: HTMLElement; // Discussion container DOM
}

// Parsed comment
export interface ParsedComment {
  content: string;              // Original comment content
  keywords: string[];           // Extracted keywords
  category: string;             // Category (conventions, patterns, style, architecture, etc.)
  codeExamples: string[];       // Code examples
  suggestedFileName: string;    // Suggested file name
}

// Code explanation
export interface CodeExplanation {
  code: string;                 // Original code
  explanation: string;          // LLM-generated explanation
  isGoodExample?: boolean;      // Whether it is a correct example
}

// LLM enhanced comment (extends ParsedComment)
export interface EnhancedComment extends ParsedComment {
  llmEnhanced: boolean;                    // Whether enhanced by LLM
  summary?: string;                         // LLM-generated summary
  detailedExplanation?: string;            // LLM-generated detailed explanation
  codeExplanations?: CodeExplanation[];    // Code example explanations
  additionalKeywords?: string[];           // Additional keywords extracted by LLM
  suggestedCategory?: string;              // Category suggested by LLM
  reasoning?: ReasoningInfo;               // Reasoning info (Phase 1)
}

// Reasoning info (Phase 1: transparency)
export interface ReasoningInfo {
  detectedIntent: string[];
  keyPhrases: string[];
  codeReferences: string[];
  confidenceScore: number;
}

// Repository info
export interface Repository {
  owner: string;
  name: string;
  platform: Platform;
  branch: string;               // Current PR/MR head branch (working branch)
  baseBranch?: string;          // Current PR/MR base branch (target branch)
  prNumber: number;             // PR/MR number
}

// Claude Code instruction/skill file
export interface ClaudeFile {
  path: string;                 // File path (.claude/rules/ or .claude/skills/)
  title: string;
  keywords: string[];
  category: string;
  content: string;              // Markdown content
  frontmatter: Record<string, any>;  // YAML frontmatter
}

// Matching result
export interface MatchResult {
  file: ClaudeFile | null;
  score: number;                // 0-100
  isMatch: boolean;             // score >= 70
}

// LLM provider type
export type LLMProvider = 'claude' | 'openai';

// LLM configuration
export interface LLMConfig {
  provider: LLMProvider;      // 'claude' or 'openai' (required)
  claudeApiKey?: string;
  openaiApiKey?: string;
}

// API configuration
export interface ApiConfig {
  githubToken?: string;
  gitlabToken?: string;
  gitlabUrl?: string;          // Self-hosted GitLab URL (optional)
  showButtons?: boolean;
  llm?: LLMConfig;             // LLM configuration
}

// Project type exports (Feature 1)
export type { ProjectType, ProjectTypeConfig, ProjectTypeDetectionResult, CachedDetectionResult } from './project-types';

// FormManager types
export type { FormState, ValidationRule, FieldSchema } from './form-manager';

// File generation result (Feature 1)
export interface FileGenerationResult {
  projectType: string;  // ProjectType
  filePath: string;
  content: string;
  isUpdate: boolean;
}

// Message types (Content Script ↔ Background)
export type MessageType =
  | 'GET_CONFIG'
  | 'SAVE_CONFIG'
  | 'CONVERT_COMMENT'
  | 'CONVERT_THREAD'       // Convert entire discussion thread
  | 'PREVIEW_INSTRUCTION'  // Generate instruction preview (LLM analysis only)
  | 'CONFIRM_AND_CONVERT'  // Convert after preview confirmation
  | 'CREATE_PR'
  | 'TEST_API'
  | 'GET_CACHE_STATS'      // Feature 2: fetch cache stats
  | 'CLEAR_CACHE'          // Feature 2: clear cache
  | 'GET_REPOSITORY_INFO'  // Fetch repository default branch
  | 'GET_PR_INFO'          // Fetch PR head/base branches
  | 'SET_MASTER_PASSWORD'  // Set master password
  | 'CHECK_TOKEN_STATUS';  // Check API token validity (decryptable)

export interface Message {
  type: MessageType;
  payload?: any;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Error response (standardized format)
export interface ErrorResponse {
  success: false;
  error: {
    message: string;      // Message to display to the user
    code?: string;        // Error code (optional)
    timestamp: number;    // Error occurred timestamp
  };
}
