/**
 * ConversionOrchestrator - 코멘트 변환 비즈니스 로직 조율
 */

import type { Comment, Repository, DiscussionThread } from '../../types';
import type { ServiceContainer } from './di-container';
import { ApiClient } from '../api-client';

export interface ConversionPayload {
  comment: Comment;
  repository: Repository;
}

export interface ConversionResult {
  prUrl: string;
  files: Array<{
    projectType: string;
    filePath: string;
    isUpdate: boolean;
  }>;
  category: string;
  keywords: string[];
  llmEnhanced: boolean;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * ConversionOrchestrator - 모든 서비스를 조율하여 코멘트 변환
 */
export class ConversionOrchestrator {
  constructor(private container: ServiceContainer) {}

  /**
   * 코멘트를 instruction/skill 파일로 변환하고 PR 생성 (Feature 2: 토큰 사용량 추적)
   */
  async convertComment(payload: ConversionPayload): Promise<ConversionResult> {
    const { comment, repository } = payload;

    // 1. 설정 로드
    const config = await this.container.configService.loadConfig(repository.platform);

    // 2. API 클라이언트 생성
    const client = new ApiClient({
      token: config.token,
      platform: repository.platform,
      gitlabUrl: config.gitlabUrl
    });

    // 3. 코멘트 검증 및 강화 (답글 포함, 토큰 사용량 추적)
    const { enhancedComment, tokenUsage } = await this.container.commentService.validateAndEnhance(
      comment,
      config.llmConfig
    );

    // 4. 파일 생성 (모든 프로젝트 타입, AI 분석 포함)
    const files = await this.container.fileGenerationService.generateForAllTypes(
      client,
      repository,
      enhancedComment,
      comment,
      config.llmConfig  // LLM 설정 전달
    );

    // 5. PR/MR 생성 (LLM 설정 전달하여 요약 기능 활성화)
    const prResult = await this.container.prService.create(
      client,
      repository,
      enhancedComment,
      comment,
      files,
      config.llmConfig  // LLM으로 PR 타이틀/커밋 메시지 요약
    );

    // 6. 결과 반환 (토큰 사용량 포함)
    return {
      prUrl: prResult.prUrl,
      files: files.map(f => ({
        projectType: f.projectType,
        filePath: f.filePath,
        isUpdate: f.isUpdate
      })),
      category: enhancedComment.category,
      keywords: enhancedComment.keywords,
      llmEnhanced: enhancedComment.llmEnhanced,
      tokenUsage
    };
  }

  /**
   * Thread 전체를 하나의 instruction으로 변환
   */
  async convertThread(payload: {
    thread: DiscussionThread;
    repository: Repository;
  }): Promise<ConversionResult> {
    const { thread, repository } = payload;

    // 1. 설정 로드
    const config = await this.container.configService.loadConfig(repository.platform);

    // 2. API 클라이언트 생성
    const client = new ApiClient({
      token: config.token,
      platform: repository.platform,
      gitlabUrl: config.gitlabUrl
    });

    // 3. Thread 코멘트들을 하나의 통합 코멘트로 병합
    const mergedComment = this.mergeThreadComments(thread);

    // 4. 코멘트 검증 및 강화 (Thread 컨텍스트 전달)
    const { enhancedComment, tokenUsage } =
      await this.container.commentService.validateAndEnhanceThread(
        mergedComment,
        thread,
        config.llmConfig
      );

    // 5. 파일 생성 (Thread 전체 컨텍스트 전달)
    const files = await this.container.fileGenerationService.generateForAllTypes(
      client,
      repository,
      enhancedComment,
      mergedComment,
      config.llmConfig,
      thread  // Thread 컨텍스트를 파일명 생성에 전달
    );

    // 6. PR/MR 생성
    const prResult = await this.container.prService.create(
      client,
      repository,
      enhancedComment,
      mergedComment,
      files,
      config.llmConfig
    );

    // 7. 결과 반환
    return {
      prUrl: prResult.prUrl,
      files: files.map(f => ({
        projectType: f.projectType,
        filePath: f.filePath,
        isUpdate: f.isUpdate
      })),
      category: enhancedComment.category,
      keywords: enhancedComment.keywords,
      llmEnhanced: enhancedComment.llmEnhanced,
      tokenUsage
    };
  }

  /**
   * Thread 코멘트들을 하나의 Markdown으로 병합
   */
  private mergeThreadComments(thread: DiscussionThread): Comment {
    const allComments = thread.comments;

    // 첫 번째 코멘트를 기본으로
    const firstComment = allComments[0];

    // 모든 코멘트 내용을 Markdown 형식으로 통합
    const mergedContent = allComments
      .map((comment, index) => {
        const header = `### Comment ${index + 1} by @${comment.author}`;
        const timestamp = new Date(comment.createdAt).toLocaleString();
        return `${header} (${timestamp})\n\n${comment.content}`;
      })
      .join('\n\n---\n\n');

    // 모든 작성자 목록
    const authors = [...new Set(allComments.map(c => c.author))];
    const authorText = authors.length > 1
      ? `Thread by ${firstComment.author} (+${authors.length - 1} others)`
      : `Thread by ${firstComment.author}`;

    return {
      id: thread.id,
      author: authorText,
      content: mergedContent,
      htmlContent: mergedContent,  // LLM이 Markdown으로 처리
      url: firstComment.url,
      createdAt: firstComment.createdAt,
      platform: thread.platform,
      // replies는 이미 통합되었으므로 undefined
      replies: undefined
    };
  }
}
