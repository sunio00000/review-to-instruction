/**
 * FileGenerationService - 프로젝트 타입 감지 및 파일 생성
 * AI 기반 분석 및 지능적 파일명 생성 지원
 */

import type { Repository, EnhancedComment, Comment, FileGenerationResult, ProjectType, LLMConfig, DiscussionThread } from '../../types';
import type { ApiClient } from '../api-client';
import { ProjectTypeDetector } from '../../core/project-detector';
import { GeneratorFactory } from '../../core/generators/generator-factory';
import { findMatchingFileForProjectType } from '../../core/file-matcher';
import { InstructionAnalyzer, type AnalysisResult } from '../../core/instruction-analyzer';
import { SmartFileNaming } from '../../core/smart-file-naming';

export interface FileGenerationService {
  generateForAllTypes(
    client: ApiClient,
    repository: Repository,
    enhancedComment: EnhancedComment,
    originalComment: Comment,
    llmConfig?: LLMConfig,
    thread?: DiscussionThread
  ): Promise<FileGenerationResult[]>;
}

/**
 * FileGenerationService 구현
 */
export class FileGenerationServiceImpl implements FileGenerationService {
  private projectDetector: ProjectTypeDetector;
  private instructionAnalyzer: InstructionAnalyzer;
  private smartFileNaming: SmartFileNaming;
  private analysisCache: Map<string, AnalysisResult | null> = new Map();

  constructor() {
    this.projectDetector = new ProjectTypeDetector();
    this.instructionAnalyzer = new InstructionAnalyzer();
    this.smartFileNaming = new SmartFileNaming();
  }

  /**
   * 감지된 모든 프로젝트 타입에 대해 파일 생성
   */
  async generateForAllTypes(
    client: ApiClient,
    repository: Repository,
    enhancedComment: EnhancedComment,
    originalComment: Comment,
    llmConfig?: LLMConfig,
    thread?: DiscussionThread
  ): Promise<FileGenerationResult[]> {
    // 1. 프로젝트 타입 감지
    const detectionResult = await this.projectDetector.detect(client, repository);

    // 프로젝트 타입이 감지되지 않으면 기본 타입들을 사용 (디렉토리 자동 생성)
    // 기본: Claude Code, Cursor만 생성
    const typesToGenerate: ProjectType[] = detectionResult.detectedTypes.length > 0
      ? detectionResult.detectedTypes
      : ['claude-code', 'cursor'];


    // 2. AI 기반 프로젝트 분석 (Claude Code 타입일 때만)
    let analysisResult: AnalysisResult | null = null;

    if (typesToGenerate.includes('claude-code')) {

      // 캐시 확인
      const cacheKey = `${repository.owner}/${repository.name}/${repository.branch}`;
      if (this.analysisCache.has(cacheKey)) {
        analysisResult = this.analysisCache.get(cacheKey)!;
      } else {
        // 새로 분석
        analysisResult = await this.instructionAnalyzer.analyzeProject(client, repository);
        this.analysisCache.set(cacheKey, analysisResult);
      }
    }

    // 3. Generator 생성
    const generators = GeneratorFactory.createGenerators(typesToGenerate);

    // 4. 각 타입별 파일 생성
    const files: FileGenerationResult[] = [];

    for (const [projectType, generator] of generators) {
      try {
        const file = await this.generateForType(
          client,
          repository,
          enhancedComment,
          originalComment,
          projectType,
          generator,
          analysisResult,
          llmConfig,
          thread
        );

        files.push(file);

      } catch (error) {
        // 부분 실패 허용: 한 타입 실패해도 다른 타입 계속 진행
      }
    }

    // 5. 모든 생성 실패 시 에러
    if (files.length === 0) {
      throw new Error('파일 생성에 모두 실패했습니다.');
    }

    return files;
  }

  /**
   * 특정 프로젝트 타입에 대한 파일 생성
   */
  private async generateForType(
    client: ApiClient,
    repository: Repository,
    enhancedComment: EnhancedComment,
    originalComment: Comment,
    projectType: string,
    generator: any,
    analysisResult?: AnalysisResult | null,
    llmConfig?: LLMConfig,
    thread?: DiscussionThread
  ): Promise<FileGenerationResult> {
    // 1. AI 기반 파일명 생성 (Claude Code 타입이고 LLM이 활성화된 경우)
    let smartFilePath: string | null = null;

    if (projectType === 'claude-code' && llmConfig && analysisResult) {
      try {
        const namingResult = await this.smartFileNaming.generateFileName({
          parsedComment: enhancedComment,
          analysisResult,
          llmConfig,
          thread  // Thread 컨텍스트 전달
        });

        smartFilePath = namingResult.fullPath;

      } catch (error) {
      }
    }

    // 2. 매칭 파일 찾기 (기존 방식)
    const matchResult = await findMatchingFileForProjectType(
      client,
      repository,
      enhancedComment,
      projectType as ProjectType
    );

    // 3. Generator로 파일 생성 (AI 제안 경로 전달)
    const generationResult = generator.generate({
      parsedComment: enhancedComment,
      originalComment: originalComment,
      repository,
      existingContent: matchResult.existingContent,
      suggestedPath: smartFilePath || undefined  // SmartFileNaming 결과 전달
    });

    // 4. 파일 경로 결정 (우선순위: Generator > Matcher)
    // Generator가 이미 smartFilePath를 사용했으므로 그 결과 사용
    const finalFilePath = generationResult.filePath || matchResult.filePath;

    return {
      projectType,
      filePath: finalFilePath,
      content: generationResult.content,
      isUpdate: generationResult.isUpdate
    };
  }
}
