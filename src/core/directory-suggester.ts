/**
 * Directory Suggester
 * 규칙 기반 + LLM 기반 디렉토리 제안
 */

import { DirectoryRules } from './directory-rules';
import type { AnalysisResult } from './instruction-analyzer';
import type { ParsedComment, EnhancedComment, ClaudeFile } from '../types';
import type { ClaudeClient } from '../background/llm/claude-client';
import type { OpenAIClient } from '../background/llm/openai-client';
import type { LLMConfig } from '../types';

/**
 * 디렉토리 후보
 */
export interface DirectoryCandidate {
  path: string;           // 전체 경로 (예: .claude/rules/api)
  score: number;          // 점수 (0-100)
  reasoning: string;      // 선택 이유
  strategy: 'keyword' | 'category' | 'similar' | 'fallback' | 'llm';  // 전략
}

/**
 * LLM 선택 응답 형식
 */
interface LLMSelectionResponse {
  selected: number;       // 선택된 후보 인덱스 (0-2)
  reasoning: string;      // 선택 이유
}

/**
 * 디렉토리 제안 클래스
 */
export class DirectorySuggester {
  private rules: DirectoryRules;
  private llmClient?: ClaudeClient | OpenAIClient;

  constructor(
    rules?: DirectoryRules,
    llmClient?: ClaudeClient | OpenAIClient
  ) {
    this.rules = rules || new DirectoryRules();
    this.llmClient = llmClient;
  }

  /**
   * 디렉토리 경로 제안
   *
   * @param comment 코멘트 (ParsedComment 또는 EnhancedComment)
   * @param analysisResult 프로젝트 분석 결과
   * @param llmConfig LLM 설정 (선택적)
   * @returns 제안된 디렉토리 전체 경로
   */
  async suggestDirectory(
    comment: ParsedComment | EnhancedComment,
    analysisResult: AnalysisResult | null,
    llmConfig?: LLMConfig
  ): Promise<string> {
    const baseDir = '.claude/rules';

    // 1. 규칙 기반 후보 3개 생성
    const candidates = this.generateRuleBasedCandidates(comment, analysisResult, baseDir);

    // 2. LLM 사용 가능 시 최종 선택
    if (llmConfig && this.llmClient) {
      try {
        const selectedPath = await this.selectBestWithLLM(candidates, comment, analysisResult);
        return selectedPath;
      } catch (error) {
        // LLM 실패 시 1순위 후보 사용
        return candidates[0].path;
      }
    }

    // 3. LLM 없으면 1순위 반환
    return candidates[0].path;
  }

  /**
   * 규칙 기반 후보 생성
   *
   * 3가지 전략을 사용하여 후보 생성:
   * 1. 키워드 매칭
   * 2. 카테고리 규칙
   * 3. 유사 파일 분석
   *
   * @param comment 코멘트
   * @param analysisResult 프로젝트 분석 결과
   * @param baseDir 기본 디렉토리
   * @returns 후보 배열 (최대 3개, 점수 순)
   */
  private generateRuleBasedCandidates(
    comment: ParsedComment | EnhancedComment,
    analysisResult: AnalysisResult | null,
    baseDir: string
  ): DirectoryCandidate[] {
    const candidates: DirectoryCandidate[] = [];

    // 전략 1: 키워드 매칭
    const keywordMatch = this.matchByKeywords(comment.keywords, analysisResult, baseDir);
    if (keywordMatch) {
      candidates.push(keywordMatch);
    }

    // 전략 2: 카테고리 규칙
    const categoryMatch = this.matchByCategory(comment.category, baseDir);
    if (categoryMatch) {
      candidates.push(categoryMatch);
    }

    // 전략 3: 유사 파일 분석
    const similarMatch = this.matchBySimilarFiles(comment, analysisResult, baseDir);
    if (similarMatch) {
      candidates.push(similarMatch);
    }

    // 전략 4: 기본 경로 (fallback)
    candidates.push({
      path: baseDir,
      score: 50,
      reasoning: '기본 디렉토리 (다른 규칙과 매칭되지 않음)',
      strategy: 'fallback'
    });

    // 중복 제거 (같은 경로는 점수 높은 것만)
    const uniqueCandidates = this.deduplicateCandidates(candidates);

    // 점수 순으로 정렬 후 상위 3개 반환
    uniqueCandidates.sort((a, b) => b.score - a.score);
    return uniqueCandidates.slice(0, 3);
  }

  /**
   * 전략 1: 키워드 매칭
   */
  private matchByKeywords(
    keywords: string[],
    analysisResult: AnalysisResult | null,
    baseDir: string
  ): DirectoryCandidate | null {
    if (!keywords || keywords.length === 0) {
      return null;
    }

    // 규칙에서 키워드 매칭
    const match = this.rules.matchKeywordsToDirectory(keywords);

    if (!match) {
      return null;
    }

    // 기존 디렉토리 구조와 매칭 확인
    const suggestedPath = `${baseDir}/${match.directory}`;

    // analysisResult가 있고, 해당 디렉토리가 기존에 존재하면 점수 보너스
    let finalScore = match.score;
    let reasoning = `키워드 매칭: ${match.matchedKeywords.join(', ')}`;

    if (analysisResult?.directoryHierarchy) {
      const exists = analysisResult.directoryHierarchy.allPaths.some(p =>
        p === suggestedPath || p.startsWith(suggestedPath + '/')
      );

      if (exists) {
        finalScore += 15; // 기존 구조와 일치하면 보너스
        reasoning += ' (기존 디렉토리 구조와 일치)';
      }
    }

    return {
      path: suggestedPath,
      score: Math.min(finalScore, 100), // 최대 100점
      reasoning,
      strategy: 'keyword'
    };
  }

  /**
   * 전략 2: 카테고리 규칙
   */
  private matchByCategory(
    category: string,
    baseDir: string
  ): DirectoryCandidate | null {
    const directory = this.rules.getCategoryDirectory(category);

    if (!directory) {
      // 카테고리가 매핑되지 않으면 루트
      return {
        path: baseDir,
        score: 70,
        reasoning: `카테고리 '${category}'는 루트 디렉토리에 저장`,
        strategy: 'category'
      };
    }

    return {
      path: `${baseDir}/${directory}`,
      score: 75,
      reasoning: `카테고리 '${category}'는 '${directory}/' 디렉토리로 매핑`,
      strategy: 'category'
    };
  }

  /**
   * 전략 3: 유사 파일 분석
   */
  private matchBySimilarFiles(
    comment: ParsedComment | EnhancedComment,
    analysisResult: AnalysisResult | null,
    _baseDir: string
  ): DirectoryCandidate | null {
    if (!analysisResult || !analysisResult.existingFiles || analysisResult.existingFiles.length === 0) {
      return null;
    }

    // 유사한 파일 찾기 (같은 카테고리 + 키워드 중복)
    const similarFiles = this.findSimilarFiles(
      comment.keywords,
      comment.category,
      analysisResult.existingFiles
    );

    if (similarFiles.length === 0) {
      return null;
    }

    // 유사 파일들이 위치한 디렉토리 분석
    const dirFrequency: Record<string, number> = {};

    similarFiles.forEach(file => {
      const parts = file.path.split('/');
      parts.pop(); // 파일명 제거
      const dir = parts.join('/');

      dirFrequency[dir] = (dirFrequency[dir] || 0) + 1;
    });

    // 가장 빈도 높은 디렉토리 선택
    const mostFrequentDir = Object.entries(dirFrequency)
      .sort((a, b) => b[1] - a[1])[0];

    const [directory, frequency] = mostFrequentDir;

    // 점수 계산: 유사 파일 수에 비례
    const score = Math.min(60 + (frequency * 5), 95);

    return {
      path: directory,
      score,
      reasoning: `유사한 파일 ${frequency}개가 이 디렉토리에 위치`,
      strategy: 'similar'
    };
  }

  /**
   * 유사 파일 찾기
   */
  private findSimilarFiles(
    keywords: string[],
    category: string,
    existingFiles: ClaudeFile[]
  ): ClaudeFile[] {
    return existingFiles.filter(file => {
      // 카테고리가 같으면 유사도 높음
      if (file.category === category) {
        // 키워드 중복 체크
        const commonKeywords = file.keywords.filter(k =>
          keywords.some(ck => ck.toLowerCase() === k.toLowerCase())
        );

        if (commonKeywords.length >= 2) {
          return true;
        }
      }

      return false;
    });
  }

  /**
   * 후보 중복 제거
   */
  private deduplicateCandidates(candidates: DirectoryCandidate[]): DirectoryCandidate[] {
    const pathMap = new Map<string, DirectoryCandidate>();

    candidates.forEach(candidate => {
      const existing = pathMap.get(candidate.path);

      if (!existing || candidate.score > existing.score) {
        // 새로운 경로이거나 점수가 더 높으면 교체
        pathMap.set(candidate.path, candidate);
      }
    });

    return Array.from(pathMap.values());
  }

  /**
   * LLM을 사용하여 최적 후보 선택
   */
  private async selectBestWithLLM(
    candidates: DirectoryCandidate[],
    comment: ParsedComment | EnhancedComment,
    analysisResult: AnalysisResult | null
  ): Promise<string> {
    if (!this.llmClient) {
      throw new Error('[DirectorySuggester] LLM client not available');
    }

    const prompt = this.buildLLMSelectionPrompt(candidates, comment, analysisResult);

    try {
      const response = await this.llmClient.generateText(prompt, {
        max_tokens: 500,
        temperature: 0.3 // 일관성을 위해 낮은 temperature
      });

      const parsed = this.parseSelectionResponse(response);

      // 선택된 인덱스 검증
      if (parsed.selected < 0 || parsed.selected >= candidates.length) {
        return candidates[0].path;
      }

      return candidates[parsed.selected].path;

    } catch (error) {
      throw error;
    }
  }

  /**
   * LLM 프롬프트 생성
   */
  private buildLLMSelectionPrompt(
    candidates: DirectoryCandidate[],
    comment: ParsedComment | EnhancedComment,
    analysisResult: AnalysisResult | null
  ): string {
    // 후보 목록 텍스트 생성
    const candidatesText = candidates
      .map((c, i) => `${i}. ${c.path} (점수: ${c.score}, 이유: ${c.reasoning})`)
      .join('\n');

    // 기존 디렉토리 구조 텍스트
    const existingDirs = analysisResult?.directoryHierarchy?.allPaths.join('\n') || '(없음)';

    return `당신은 프로젝트의 파일 구조를 분석하여 최적의 저장 위치를 제안하는 전문가입니다.

**코멘트 정보:**
- 카테고리: ${comment.category}
- 키워드: ${comment.keywords.join(', ')}
- 내용: ${this.truncateText(comment.content, 200)}

**기존 디렉토리 구조:**
${existingDirs}

**후보 디렉토리 (3개):**
${candidatesText}

**작업:**
위 3개 후보 중 코멘트 내용과 기존 프로젝트 구조를 고려하여 가장 적절한 디렉토리를 선택하세요.

**응답 형식 (JSON):**
{
  "selected": 0,  // 0, 1, 또는 2 (후보 인덱스)
  "reasoning": "선택 이유를 50자 이내로 설명"
}

**선택 기준:**
1. 기존 디렉토리 구조와의 일관성
2. 코멘트 내용과의 연관성
3. 향후 유지보수 편의성

JSON만 반환하고 다른 텍스트는 포함하지 마세요.`;
  }

  /**
   * LLM 응답 파싱
   */
  private parseSelectionResponse(response: string): LLMSelectionResponse {
    try {
      // JSON 추출 (코드 블록 제거)
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('JSON not found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as LLMSelectionResponse;

      // 검증
      if (typeof parsed.selected !== 'number' || typeof parsed.reasoning !== 'string') {
        throw new Error('Invalid response format');
      }

      return parsed;

    } catch (error) {
      // 기본값: 0번 후보 선택
      return {
        selected: 0,
        reasoning: 'LLM 응답 파싱 실패, 1순위 후보 사용'
      };
    }
  }

  /**
   * 텍스트 축약
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }
}
