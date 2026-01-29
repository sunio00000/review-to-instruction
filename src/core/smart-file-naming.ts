/**
 * Smart File Naming
 * AI를 활용한 지능적 파일명 생성 + 디렉토리 제안
 */

import type { ParsedComment, EnhancedComment, LLMConfig, DiscussionThread } from '../types';
import type { AnalysisResult } from './instruction-analyzer';
import { ClaudeClient } from '../background/llm/claude-client';
import { OpenAIClient } from '../background/llm/openai-client';
import { DirectorySuggester } from './directory-suggester';
import { DirectoryRules } from './directory-rules';

export interface FileNamingOptions {
  parsedComment: ParsedComment | EnhancedComment;
  analysisResult: AnalysisResult | null;
  llmConfig?: LLMConfig;
  thread?: DiscussionThread;  // Thread 컨텍스트 (옵션)
}

export interface FileNamingResult {
  filename: string;         // 예: "component-naming-conventions.md"
  directory: string;        // 예: ".claude/rules"
  fullPath: string;        // 예: ".claude/rules/component-naming-conventions.md"
  confidence: number;      // 0-100
  reasoning?: string;      // AI의 선택 이유
}

export class SmartFileNaming {
  /**
   * AI 기반 파일명 + 디렉토리 생성
   */
  async generateFileName(options: FileNamingOptions): Promise<FileNamingResult> {
    const { parsedComment, analysisResult, llmConfig, thread } = options;

    // 1. 디렉토리 제안 (규칙 기반 + LLM 선택적)
    const llmClient = this.createLLMClient(llmConfig);
    const directorySuggester = new DirectorySuggester(new DirectoryRules(), llmClient);

    const suggestedDir = await directorySuggester.suggestDirectory(
      parsedComment,
      analysisResult,
      llmConfig
    );


    // 2. 파일명 생성 (LLM 또는 규칙 기반, Thread 컨텍스트 전달)
    let fileResult: FileNamingResult;

    if (llmConfig) {
      try {
        fileResult = await this.generateWithAI(parsedComment, analysisResult, llmConfig, thread);
      } catch (error) {
        fileResult = this.generateWithRules(parsedComment, analysisResult);
      }
    } else {
      fileResult = this.generateWithRules(parsedComment, analysisResult);
    }

    // 3. 제안된 디렉토리로 교체
    return {
      ...fileResult,
      directory: suggestedDir,
      fullPath: `${suggestedDir}/${fileResult.filename}`
    };
  }

  /**
   * LLM 클라이언트 생성
   */
  private createLLMClient(llmConfig?: LLMConfig): ClaudeClient | OpenAIClient | undefined {
    if (!llmConfig) {
      return undefined;
    }

    return llmConfig.provider === 'claude'
      ? new ClaudeClient(llmConfig.claudeApiKey!)
      : new OpenAIClient(llmConfig.openaiApiKey!);
  }

  /**
   * AI 기반 파일명 생성
   */
  private async generateWithAI(
    parsedComment: ParsedComment | EnhancedComment,
    analysisResult: AnalysisResult | null,
    llmConfig: LLMConfig,
    thread?: DiscussionThread
  ): Promise<FileNamingResult> {

    // LLM 클라이언트 생성
    const client = llmConfig.provider === 'claude'
      ? new ClaudeClient(llmConfig.claudeApiKey!)
      : new OpenAIClient(llmConfig.openaiApiKey!);


    // 프롬프트 구성 (Thread가 있으면 Thread 프롬프트 사용)
    const prompt = thread
      ? this.buildThreadNamingPrompt(parsedComment, analysisResult, thread)
      : this.buildAINamingPrompt(parsedComment, analysisResult);

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

    let prompt = `You are an expert at organizing code conventions and documentation. Generate an ABSTRACT and GENERALIZED filename for a Claude Code instruction file that can accommodate similar conventions in the future.

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

IMPORTANT: If an existing file could logically contain this convention, prefer that filename instead of creating a new one.
`;
    } else {
      prompt += `
## No Existing Files
This will be the first instruction file in the project. Use clear, ABSTRACT, and GENERALIZED naming that can accommodate related conventions.
`;
    }

    prompt += `
## CRITICAL Requirements for Filename Abstraction
1. **Avoid over-specific filenames**: Instead of "button-component-naming.md", use "component-naming.md"
2. **Think broadly**: Group related conventions under general categories
   - ✅ Good: "error-handling.md" (can include try-catch, logging, retries, etc.)
   - ❌ Bad: "try-catch-conventions.md" (too specific)
3. **Prefer existing files**: If an existing file's topic is related, reuse that filename
4. **Use category-level naming**: Base filenames on categories (naming, testing, architecture, etc.)
5. **Limit file proliferation**: Aim for 5-10 well-organized files, not 50+ narrow files

## Filename Selection Strategy
1. First, check if any existing file could contain this convention
2. If yes, return that existing filename
3. If no, create a NEW filename that is:
   - Abstract enough to group similar conventions
   - Based on the category, not specific implementation details
   - Follows the project's naming pattern (${analysisResult?.pattern.namingPattern || 'kebab-case'})
   - Clear but not overly descriptive

## Examples of Good Abstraction
- "naming-conventions.md" instead of "react-component-naming.md"
- "testing.md" instead of "jest-unit-test-setup.md"
- "api-design.md" instead of "rest-endpoint-naming.md"
- "code-organization.md" instead of "file-structure-for-services.md"

## Response Format (JSON)
{
  "filename": "suggested-filename.md",
  "directory": ".claude/rules",
  "reasoning": "Brief explanation of why this abstract filename is appropriate and how it can accommodate related conventions"
}

Respond ONLY with valid JSON, no additional text.`;

    return prompt;
  }

  /**
   * Thread 전용 AI 프롬프트 구성
   */
  private buildThreadNamingPrompt(
    parsedComment: ParsedComment | EnhancedComment,
    analysisResult: AnalysisResult | null,
    thread: DiscussionThread
  ): string {
    const isEnhanced = 'llmEnhanced' in parsedComment && parsedComment.llmEnhanced;
    const enhanced = isEnhanced ? (parsedComment as EnhancedComment) : null;

    // Thread 메타데이터
    const commentCount = thread.comments.length;
    const authors = [...new Set(thread.comments.map(c => c.author))].join(', ');
    const firstComment = thread.comments[0];
    const lastComment = thread.comments[thread.comments.length - 1];

    let prompt = `You are an expert at organizing code conventions and documentation. Generate an ABSTRACT and GENERALIZED filename for a Claude Code instruction file based on a Discussion Thread that can accommodate similar conventions in the future.

## Discussion Thread Overview
- Total comments: ${commentCount}
- Participants: ${authors}
- Platform: ${thread.platform}
- First comment by: ${firstComment.author}
- Last comment by: ${lastComment.author}

## Thread Summary
- Category: ${parsedComment.category}
- Keywords: ${parsedComment.keywords.join(', ')}
- Content Summary: ${enhanced?.summary || parsedComment.content.substring(0, 300)}

## Thread Context (Brief)
${thread.comments.slice(0, 3).map((comment, index) => `
Comment ${index + 1} by @${comment.author}:
${comment.content.substring(0, 150)}${comment.content.length > 150 ? '...' : ''}
`).join('\n')}
${commentCount > 3 ? `\n... and ${commentCount - 3} more comments` : ''}
`;

    if (analysisResult && analysisResult.existingFiles.length > 0) {
      prompt += `
## Existing Project Pattern
- Naming Pattern: ${analysisResult.pattern.namingPattern}
- Common Keywords: ${analysisResult.pattern.commonKeywords.join(', ')}
- Example Filenames: ${analysisResult.existingFiles.slice(0, 5).map(f => f.path.split('/').pop()).join(', ')}

IMPORTANT: If an existing file could logically contain this discussion's conventions, prefer that filename instead of creating a new one.
`;
    } else {
      prompt += `
## No Existing Files
This will be the first instruction file in the project. Use clear, ABSTRACT, and GENERALIZED naming that can accommodate related conventions.
`;
    }

    prompt += `
## CRITICAL Requirements for Filename Abstraction
1. **Avoid over-specific filenames**: Think about the broader category, not the specific discussion details
2. **Remove discussion markers**: Don't use "-discussion", "-consensus", "-thread" suffixes unless truly necessary
3. **Prefer existing files**: If an existing file's topic is related, reuse that filename
4. **Think categorically**: Base filenames on high-level categories (naming, testing, architecture, error-handling, etc.)
5. **Limit file proliferation**: Aim for well-organized, reusable filenames that can grow with additional conventions

## Special Instructions for Thread Files
1. The filename should capture the CORE TOPIC at a high level, not the discussion specifics
2. Consider: "What would be the chapter title in a style guide book?"
3. If the discussion reached a consensus, reflect the TOPIC not the process
4. Avoid temporal markers like "update-", "new-", "2024-" unless truly necessary

## Filename Selection Strategy
1. First, check if any existing file could contain this thread's conventions
2. If yes, return that existing filename
3. If no, create a NEW filename that is:
   - Abstract and category-based (e.g., "api-design" not "api-endpoint-discussion")
   - Timeless and reusable
   - Follows the project's naming pattern (${analysisResult?.pattern.namingPattern || 'kebab-case'})

## Examples of Good Abstraction
- "naming-conventions.md" instead of "component-naming-discussion.md"
- "testing-patterns.md" instead of "jest-setup-consensus.md"
- "error-handling.md" instead of "try-catch-discussion.md"
- "code-organization.md" instead of "folder-structure-thread.md"

## Response Format (JSON)
{
  "filename": "suggested-filename.md",
  "directory": ".claude/rules",
  "reasoning": "Brief explanation of why this abstract filename is appropriate and how it can accommodate related conventions from this and future discussions"
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

      // JSON 추출 - 여러 패턴 시도
      let jsonText: string | null = null;

      // 1. ```json``` 블록 내부 찾기
      const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1].trim();
      }

      // 2. 중괄호로 시작하는 JSON 객체 찾기
      if (!jsonText) {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
      }

      if (!jsonText) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonText);

      // 필수 필드 검증
      if (!parsed.filename) {
        throw new Error('Missing filename in AI response');
      }

      const directory = parsed.directory || '.claude/rules';
      const filename = parsed.filename;

      return {
        filename,
        directory,
        fullPath: `${directory}/${filename}`,
        confidence: 90,
        reasoning: parsed.reasoning || 'AI-generated filename'
      };
    } catch (error) {
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
      directories: ['.claude/rules']
    };

    // 기본 파일명 생성
    let baseFilename = this.createBaseFilename(parsedComment, pattern.namingPattern);

    // 중복 체크 및 번호 추가
    if (analysisResult && analysisResult.existingFiles.length > 0) {
      baseFilename = this.ensureUniqueness(baseFilename, analysisResult.existingFiles.map(f => f.path));
    }

    const filename = `${baseFilename}.md`;
    const directory = pattern.directories[0] || '.claude/rules';

    return {
      filename,
      directory,
      fullPath: `${directory}/${filename}`,
      confidence: 70,
      reasoning: `Generated using rule-based approach with ${pattern.namingPattern} pattern`
    };
  }

  /**
   * 기본 파일명 생성 (추상화된 파일명)
   */
  private createBaseFilename(
    parsedComment: ParsedComment | EnhancedComment,
    namingPattern: 'kebab-case' | 'PascalCase' | 'snake_case'
  ): string {
    // 사용자가 제안한 파일명이 있으면 우선 사용 (하지만 단순화)
    if (parsedComment.suggestedFileName) {
      // 제안된 파일명을 단순화 (너무 구체적이면 일반화)
      const simplified = this.simplifyFilename(parsedComment.suggestedFileName);
      return this.applyNamingPattern(simplified, namingPattern);
    }

    // 카테고리 중심으로 생성 (키워드는 최대 1개만 사용)
    // 카테고리가 이미 충분히 설명적이므로 키워드를 최소화
    const mainKeyword = parsedComment.keywords.length > 0 ? parsedComment.keywords[0] : null;

    // 카테고리만 사용하거나, 카테고리가 너무 일반적이면 키워드 1개 추가
    const genericCategories = ['general', 'conventions', 'best-practices', 'guidelines'];
    const useKeyword = mainKeyword && genericCategories.includes(parsedComment.category);

    const combined = useKeyword
      ? `${mainKeyword}-${parsedComment.category}`
      : parsedComment.category;

    return this.applyNamingPattern(combined.toLowerCase(), namingPattern);
  }

  /**
   * 파일명 단순화 (과도하게 구체적인 파일명을 일반화)
   */
  private simplifyFilename(filename: string): string {
    // 확장자 제거
    filename = filename.replace(/\.md$/, '');

    // 과도하게 구체적인 부분 제거
    const overlySpecificPatterns = [
      /-component$/,       // "button-component" -> "component"
      /-function$/,        // "helper-function" -> "helper"
      /-conventions?$/,    // "naming-convention" -> "naming"
      /-guidelines?$/,     // "style-guideline" -> "style"
      /-patterns?$/,       // "design-pattern" -> "design"
      /-rules?$/,          // "linting-rule" -> "linting"
      /-best-practices?$/, // "testing-best-practice" -> "testing"
    ];

    let simplified = filename;
    for (const pattern of overlySpecificPatterns) {
      simplified = simplified.replace(pattern, '');
    }

    // 너무 짧아지면 원래 파일명 유지
    if (simplified.length < 3) {
      return filename;
    }

    return simplified;
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
