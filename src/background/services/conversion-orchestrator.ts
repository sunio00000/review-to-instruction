/**
 * ConversionOrchestrator - 코멘트 변환 비즈니스 로직 조율
 */

import type { Comment, Repository } from '../../types';
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
}

/**
 * ConversionOrchestrator - 모든 서비스를 조율하여 코멘트 변환
 */
export class ConversionOrchestrator {
  constructor(private container: ServiceContainer) {}

  /**
   * 코멘트를 instruction/skill 파일로 변환하고 PR 생성
   */
  async convertComment(payload: ConversionPayload): Promise<ConversionResult> {
    const { comment, repository } = payload;

      commentId: comment.id,
      repository: `${repository.owner}/${repository.name}`
    });

    // 1. 설정 로드
    const config = await this.container.configService.loadConfig(repository.platform);

    // 2. API 클라이언트 생성
    const client = new ApiClient({
      token: config.token,
      platform: repository.platform,
      gitlabUrl: config.gitlabUrl
    });

    // 3. 코멘트 검증 및 강화
    const enhancedComment = await this.container.commentService.validateAndEnhance(
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

    // 5. PR/MR 생성
    const prResult = await this.container.prService.create(
      client,
      repository,
      enhancedComment,
      comment,
      files
    );


    // 6. 결과 반환
    return {
      prUrl: prResult.prUrl,
      files: files.map(f => ({
        projectType: f.projectType,
        filePath: f.filePath,
        isUpdate: f.isUpdate
      })),
      category: enhancedComment.category,
      keywords: enhancedComment.keywords,
      llmEnhanced: enhancedComment.llmEnhanced
    };
  }
}
