/**
 * Smart File Naming
 * AI를 활용한 지능적 파일명 생성
 */

import type { ParsedComment, EnhancedComment, LLMConfig } from '../types';
import type { AnalysisResult } from './instruction-analyzer';
import { ClaudeClient } from '../background/llm/claude-client';
import { OpenAIClient } from '../background/llm/openai-client';

export interface FileNamingOptions {
  parsedComment: ParsedComment | EnhancedComment;
  analysisResult: AnalysisResult | null;
  llmConfig?: LLMConfig;
}

export interface FileNamingResult {
  filename: string;         // 예: "component-naming-conventions.md"
  directory: string;        // 예: ".claude/instructions"
  fullPath: string;        // 예: ".claude/instructions/component-naming-conventions.md"
  confidence: number;      // 0-100
  reasoning?: string;      // AI의 선택 이유
}

export class SmartFileNaming {
  /**
   * AI 기반 파일명 생성
   */
  async generateFileName(options: FileNamingOptions): Promise<FileNamingResult> {
    const { parsedComment, analysisResult, llmConfig } = options;

    // LLM이 활성화되어 있으면 AI 기반 생성
    if (llmConfig?.enabled && llmConfig.provider !== 'none') {
      try {
        return await this.generateWithAI(parsedComment, analysisResult, llmConfig);
      } catch (error) {
        console.warn('[SmartFileNaming] AI generation failed, falling back to rule-based:', error);
      }
    }

    // LLM이 없거나 실패하면 규칙 기반 생성
    return this.generateWithRules(parsedComment, analysisResult);
  }

  /**
   * AI 기반 파일명 생성
   */
  private async generateWithAI(
    parsedComment: ParsedComment | EnhancedComment,
    analysisResult: AnalysisResult | null,
    llmConfig: LLMConfig
  ): Promise<FileNamingResult> {
    // LLM 클라이언트 생성
    const client = llmConfig.provider === 'claude'
      ? new ClaudeClient(llmConfig.claudeApiKey!)
      : new OpenAIClient(llmConfig.openaiApiKey!);

    // 프롬프트 구성
    const prompt = this.buildAINamingPrompt(parsedComment, analysisResult);

    // AI 호출
    const response = await client.generateFileName(prompt);

    // 응답 파싱
    const result = this.parseAIResponse(response, analysisResult);

    return result;
  }

  /**
   * AI 프롬프트 구성
   */
  private buildAINamingPrompt(
    parsedComment: ParsedComment | EnhancedComment,
    analysisResult: AnalysisResult | null
  ): string {
    const isEnhanced = 'llmEnhanced' in parsedComment && parsedComment.llmEnhanced;
    const enhanced = isEnhanced ? (parsedComment as EnhancedComment) : null;

    let prompt = `You are an expert at organizing code conventions and documentation. Generate an appropriate filename for a Claude Code instruction file based on the following information:

## Comment Information
- Category: ${parsedComment.category}
- Keywords: ${parsedComment.keywords.join(', ')}
- Content Summary: ${enhanced?.summary || parsedComment.content.substring(0, 200)}
`;

    if (analysisResult && analysisResult.existingFiles.length > 0) {
      prompt += `
## Existing Project Pattern
- Naming Pattern: ${analysisResult.pattern.namingPattern}
- Common Keywords: ${analysisResult.pattern.commonKeywords.join(', ')}
- Existing Categories: ${Object.keys(analysisResult.pattern.categoryDistribution).join(', ')}
- Example Filenames: ${analysisResult.existingFiles.slice(0, 5).map(f => f.path.split('/').pop()).join(', ')}
`;
    } else {
      prompt += `
## No Existing Files
This will be the first instruction file in the project. Use clear, descriptive kebab-case naming.
`;
    }

    prompt += `
## Requirements
1. Generate a filename that is:
   - Descriptive and clear
   - Follows the project's naming pattern (${analysisResult?.pattern.namingPattern || 'kebab-case'})
   - Relevant to the category and keywords
   - Unique and not conflicting with existing files
2. Suggest the appropriate directory (usually .claude/instructions)
3. Provide a brief reasoning for your choice

## Response Format (JSON)
{
  "filename": "suggested-filename.md",
  "directory": ".claude/instructions",
  "reasoning": "Brief explanation of why this filename is appropriate"
}

Respond ONLY with valid JSON, no additional text.`;

    return prompt;
  }

  /**
   * AI 응답 파싱
   */
  private parseAIResponse(
    response: string,
    analysisResult: AnalysisResult | null
  ): FileNamingResult {
    try {
      // JSON 추출 (```json 태그 제거)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        filename: parsed.filename || 'instruction.md',
        directory: parsed.directory || '.claude/instructions',
        fullPath: `${parsed.directory}/${parsed.filename}`,
        confidence: 90,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      console.error('[SmartFileNaming] Failed to parse AI response:', error);
      // 파싱 실패 시 규칙 기반으로 폴백
      return this.generateWithRules(
        { keywords: [], category: 'general', content: '', codeExamples: [], suggestedFileName: '' },
        analysisResult
      );
    }
  }

  /**
   * 규칙 기반 파일명 생성
   */
  private generateWithRules(
    parsedComment: ParsedComment | EnhancedComment,
    analysisResult: AnalysisResult | null
  ): FileNamingResult {
    const pattern = analysisResult?.pattern || {
      namingPattern: 'kebab-case' as const,
      directories: ['.claude/instructions']
    };

    // 기본 파일명 생성
    let baseFilename = this.createBaseFilename(parsedComment, pattern.namingPattern);

    // 중복 체크 및 번호 추가
    if (analysisResult && analysisResult.existingFiles.length > 0) {
      baseFilename = this.ensureUniqueness(baseFilename, analysisResult.existingFiles.map(f => f.path));
    }

    const filename = `${baseFilename}.md`;
    const directory = pattern.directories[0] || '.claude/instructions';

    return {
      filename,
      directory,
      fullPath: `${directory}/${filename}`,
      confidence: 70,
      reasoning: `Generated using rule-based approach with ${pattern.namingPattern} pattern`
    };
  }

  /**
   * 기본 파일명 생성
   */
  private createBaseFilename(
    parsedComment: ParsedComment | EnhancedComment,
    namingPattern: 'kebab-case' | 'PascalCase' | 'snake_case'
  ): string {
    // 사용자가 제안한 파일명이 있으면 우선 사용
    if (parsedComment.suggestedFileName) {
      return this.applyNamingPattern(parsedComment.suggestedFileName, namingPattern);
    }

    // 키워드 + 카테고리 조합
    const keywords = parsedComment.keywords.slice(0, 2); // 최대 2개
    const parts = [...keywords, parsedComment.category];

    const combined = parts.join('-').toLowerCase();

    return this.applyNamingPattern(combined, namingPattern);
  }

  /**
   * 네이밍 패턴 적용
   */
  private applyNamingPattern(
    text: string,
    pattern: 'kebab-case' | 'PascalCase' | 'snake_case'
  ): string {
    // 기본: 소문자 + 하이픈
    text = text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    switch (pattern) {
      case 'PascalCase':
        return text.split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join('');
      case 'snake_case':
        return text.replace(/-/g, '_');
      case 'kebab-case':
      default:
        return text;
    }
  }

  /**
   * 고유성 보장 (중복 방지)
   */
  private ensureUniqueness(baseFilename: string, existingPaths: string[]): string {
    const existingFilenames = existingPaths.map(p => p.split('/').pop()?.replace('.md', '') || '');

    if (!existingFilenames.includes(baseFilename)) {
      return baseFilename;
    }

    // 번호 추가
    let counter = 2;
    while (existingFilenames.includes(`${baseFilename}-${counter}`)) {
      counter++;
    }

    return `${baseFilename}-${counter}`;
  }
}
