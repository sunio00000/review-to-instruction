/**
 * DI Container - 서비스 의존성 관리
 */

import type { ConfigService } from './config-service';
import type { CommentService } from './comment-service';
import type { FileGenerationService } from './file-generation-service';
import type { PullRequestService } from './pr-service';

import { ConfigServiceImpl } from './config-service';
import { CommentServiceImpl } from './comment-service';
import { FileGenerationServiceImpl } from './file-generation-service';
import { PullRequestServiceImpl } from './pr-service';
import { CryptoService } from './crypto-service';

export interface ServiceContainer {
  configService: ConfigService;
  commentService: CommentService;
  fileGenerationService: FileGenerationService;
  prService: PullRequestService;
}

/**
 * 서비스 컨테이너 생성
 * @param crypto CryptoService 인스턴스 (전역 인스턴스 사용)
 */
export function createServiceContainer(crypto: CryptoService): ServiceContainer {
  return {
    configService: new ConfigServiceImpl(crypto),
    commentService: new CommentServiceImpl(),
    fileGenerationService: new FileGenerationServiceImpl(),
    prService: new PullRequestServiceImpl()
  };
}
