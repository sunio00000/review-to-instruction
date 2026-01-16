/**
 * FileGenerationService - 프로젝트 타입 감지 및 파일 생성
 * AI 기반 분석 및 지능적 파일명 생성 지원
 */

import type { Repository, EnhancedComment, Comment, FileGenerationResult, ProjectType, LLMConfig } from '../../types';
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
    llmConfig?: LLMConfig
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
    llmConfig?: LLMConfig
  ): Promise<FileGenerationResult[]> {
    // 1. 프로젝트 타입 감지
    console.log('[FileGenerationService] Detecting project types...');
    const detectionResult = await this.projectDetector.detect(client, repository);

    if (detectionResult.detectedTypes.length === 0) {
      throw new Error('지원되는 AI 도구 형식(.claude/, .cursorrules, rules/)을 찾을 수 없습니다.');
    }

    console.log('[FileGenerationService] Detected project types:', detectionResult.detectedTypes);

    // 2. AI 기반 프로젝트 분석 (Claude Code 타입일 때만)
    let analysisResult: AnalysisResult | null = null;

    if (detectionResult.detectedTypes.includes('claude-code')) {
      console.log('[FileGenerationService] Analyzing existing instructions with AI...');

      // 캐시 확인
      const cacheKey = `${repository.owner}/${repository.name}/${repository.branch}`;
      if (this.analysisCache.has(cacheKey)) {
        analysisResult = this.analysisCache.get(cacheKey)!;
        console.log('[FileGenerationService] Using cached analysis result');
      } else {
        // 새로 분석
        analysisResult = await this.instructionAnalyzer.analyzeProject(client, repository);
        this.analysisCache.set(cacheKey, analysisResult);
        console.log('[FileGenerationService] Analysis complete:', {
          confidence: analysisResult?.confidence,
          existingFiles: analysisResult?.existingFiles.length || 0
        });
      }

      // 중복 체크
      if (analysisResult) {
        const similarFiles = this.instructionAnalyzer.findSimilarInstructions(
          analysisResult.existingFiles,
          enhancedComment.keywords,
          enhancedComment.category
        );

        if (similarFiles.length > 0) {
          console.log('[FileGenerationService] Found similar instructions:', similarFiles.map(f => f.path));
          console.log('[FileGenerationService] Consider updating existing files instead of creating new ones');
        }
      }
    }

    // 3. Generator 생성
    const generators = GeneratorFactory.createGenerators(detectionResult.detectedTypes);
    console.log(`[FileGenerationService] Created ${generators.size} generators`);

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
          llmConfig
        );

        files.push(file);

        console.log(`[FileGenerationService] Generated file for ${projectType}:`, {
          filePath: file.filePath,
          isUpdate: file.isUpdate
        });
      } catch (error) {
        console.error(`[FileGenerationService] Failed to generate file for ${projectType}:`, error);
        // 부분 실패 허용: 한 타입 실패해도 다른 타입 계속 진행
      }
    }

    // 5. 모든 생성 실패 시 에러
    if (files.length === 0) {
      throw new Error('파일 생성에 모두 실패했습니다.');
    }

    console.log(`[FileGenerationService] Successfully generated ${files.length} files`);
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
    llmConfig?: LLMConfig
  ): Promise<FileGenerationResult> {
    console.log(`[FileGenerationService] Generating file for ${projectType}...`);

    // 1. AI 기반 파일명 생성 (Claude Code 타입이고 LLM이 활성화된 경우)
    let smartFilePath: string | null = null;

    if (projectType === 'claude-code' && llmConfig?.enabled && analysisResult) {
      try {
        console.log('[FileGenerationService] Using AI-based file naming...');

        const namingResult = await this.smartFileNaming.generateFileName({
          parsedComment: enhancedComment,
          analysisResult,
          llmConfig
        });

        smartFilePath = namingResult.fullPath;

        console.log('[FileGenerationService] AI suggested filename:', {
          path: smartFilePath,
          confidence: namingResult.confidence,
          reasoning: namingResult.reasoning
        });
      } catch (error) {
        console.warn('[FileGenerationService] AI file naming failed, falling back to rule-based:', error);
      }
    }

    // 2. 매칭 파일 찾기 (기존 방식)
    const matchResult = await findMatchingFileForProjectType(
      client,
      repository,
      enhancedComment,
      projectType as ProjectType
    );

    // 3. Generator로 파일 생성
    const generationResult = generator.generate({
      parsedComment: enhancedComment,
      originalComment: originalComment,
      repository,
      existingContent: matchResult.existingContent
    });

    // 4. 파일 경로 결정 (우선순위: AI > Generator > Matcher)
    const finalFilePath = smartFilePath
      || generationResult.filePath
      || matchResult.filePath;

    console.log('[FileGenerationService] Final file path:', finalFilePath);

    return {
      projectType,
      filePath: finalFilePath,
      content: generationResult.content,
      isUpdate: generationResult.isUpdate
    };
  }
}
