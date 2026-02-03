/**
 * LLM 프롬프트 템플릿
 */

/**
 * 코멘트 분석 프롬프트 (Feature 2: 스레드 답글 포함, 영어 출력, 강화된 키워드 추출)
 */
export function buildAnalysisPrompt(
  content: string,
  codeExamples: string[],
  replies?: Array<{ author: string; content: string; createdAt: string; }>,
  existingKeywords?: string[]
): string {
  const hasCode = codeExamples.length > 0;
  const hasReplies = replies && replies.length > 0;
  const hasExistingKeywords = existingKeywords && existingKeywords.length > 0;

  return `You are a code review analyzer. Analyze the following code review comment${hasReplies ? ' and discussion thread' : ''} and provide structured output IN ENGLISH.

**Review Comment:**
${content}

${hasReplies ? `**Discussion Thread (${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}):**
${replies.map((reply, i) => `Reply ${i + 1} by ${reply.author}:
${reply.content}
`).join('\n')}

**CRITICAL - Thread Analysis Protocol:**
Your task is to extract ONLY the final agreed-upon convention from this discussion thread.

1. **Identify rejection/disagreement intent** using natural language understanding:
   - Direct rejection: "No", "I disagree", "That's not good"
   - Alternative suggestion: "Instead use X", "Better to use Y", "Rather do Z"
   - Correction: "Actually", "Not quite", "More accurately"
   - Dismissal: "Let's not", "Avoid that", "Don't do that"
   - ANY expression indicating the previous suggestion should NOT be followed

2. **Apply consensus extraction logic:**
   - If suggestion A is rejected/corrected → extract ONLY the alternative (B, C, etc.)
   - If multiple alternatives discussed → extract ONLY the final agreement
   - Later replies override earlier contradictory suggestions
   - Ignore proposals that were dismissed or not adopted

3. **Examples of rejection patterns:**
   - "Use snake_case" → "No, use camelCase" → Extract: camelCase only
   - "Add comments" → "That's unnecessary" → Extract: nothing
   - "Try A" → "A won't work, let's do B" → Extract: B only
   - "한글 주석도 괜찮아요" → "아뇨, 영어로 통일하시죠" → Extract: English only

Focus on understanding the INTENT and OUTCOME of the discussion, not just keywords.` : ''}

${hasCode ? `**Code Examples Found:**
${codeExamples.map((code, i) => `Example ${i + 1}:\n\`\`\`\n${code}\n\`\`\`\n`).join('\n')}` : ''}

${hasExistingKeywords ? `**Keywords Already Extracted (Rule-based):**
${existingKeywords.join(', ')}

Note: Extract ADDITIONAL keywords not in the above list. Focus on:
- Implicit concepts mentioned but not explicitly named
- Related technologies or patterns inferred from context
- Domain-specific terminology
- Design patterns or principles implied
- Best practices or anti-patterns referenced` : ''}

**Task:**
1. Summarize the comment${hasReplies ? ' and discussion thread' : ''} in ONE sentence (max 100 chars).
2. Provide a COMPACT rule explanation (1-3 bullet points max, each under 80 chars).
3. ${hasCode ? 'Briefly explain each code example (one line per example).' : 'No code examples provided.'}
4. Extract 3-5 relevant keywords (concise, no duplicates).
5. Suggest category from: naming, style, architecture, testing, security, performance, error-handling, documentation, accessibility, i18n, api, database, state-management, git, ci-cd, dependencies.
6. Provide reasoning: detectedIntent (1-2 intents), keyPhrases (2-3 phrases), codeReferences (if any), confidenceScore (0-100).

**Output Format (JSON):**
{
  "summary": "One sentence (max 100 chars) IN ENGLISH",
  "detailedExplanation": "1-3 compact bullet points, each under 80 chars, IN ENGLISH",
  "codeExplanations": [
    {
      "code": "original code snippet",
      "explanation": "Brief one-line explanation IN ENGLISH (max 60 chars)",
      "isGoodExample": true/false
    }
  ],
  "additionalKeywords": ["keyword1", "keyword2"],
  "suggestedCategory": "category",
  "reasoning": {
    "detectedIntent": ["intent1"],
    "keyPhrases": ["phrase1", "phrase2"],
    "codeReferences": ["file.ts:123"],
    "confidenceScore": 85
  }
}

**Important:**
- ALL output MUST be in ENGLISH (summary, detailedExplanation, codeExplanations).
- **CRITICAL: Be EXTREMELY CONCISE.** Context matters - long rules waste tokens.
- Summary: ONE sentence, max 100 chars.
- DetailedExplanation: 1-3 bullet points, each under 80 chars. NO redundancy with summary.
- Code explanations: One line each, max 60 chars.
${hasReplies ? `- **Thread Consensus Extraction:**
  * Use natural language understanding to detect rejection/disagreement.
  * Extract ONLY what was finally agreed upon, NOT rejected proposals.
  * If uncertain about consensus, prefer the last substantive reply.
  * When in doubt, be conservative - exclude ambiguous suggestions.` : ''}
- If code examples use ✅/❌ or "good"/"bad" markers, identify isGoodExample accordingly.
${hasExistingKeywords ? '- additionalKeywords: ONLY NEW keywords (3-5 max).' : '- additionalKeywords: 3-5 relevant keywords.'}
- Keywords: 1-2 words max, kebab-case.
- Output ONLY valid JSON (no markdown, no extra text).`;
}

/**
 * 시스템 프롬프트 (선택적)
 */
export const SYSTEM_PROMPT = `You are an expert code review analyzer specializing in extracting coding conventions, patterns, and best practices from review comments. Your goal is to help teams document and standardize their coding guidelines.`;

/**
 * Claude Code instruction vs skill 분류 프롬프트
 *
 * Instruction: 규칙, 컨벤션, 가이드라인, 표준 (무엇을 해야/하지 말아야 하는지)
 * Skill: 단계별 방법, 기법, 하우투 가이드 (어떻게 하는지)
 */
export function buildClassificationPrompt(content: string, keywords: string[]): string {
  return `Classify this code review comment as either INSTRUCTION or SKILL.

**Definitions:**
- **INSTRUCTION**: A rule, convention, guideline, or standard that describes WHAT should or shouldn't be done.
  Examples: "Always use const for immutable values", "Avoid using var keyword", "Error messages must be user-friendly"

- **SKILL**: A step-by-step method, technique, or how-to guide that describes HOW to accomplish something.
  Examples: "How to set up authentication", "Steps to configure Docker", "Method for implementing caching"

**Important distinction:**
- "Use design pattern X" → INSTRUCTION (rule about which pattern to use)
- "How to implement design pattern X" → SKILL (step-by-step guide)
- "Follow naming convention Y" → INSTRUCTION (rule about naming)
- "How to create proper naming" → SKILL (guide on creating names)

**Comment:**
${content}

**Keywords:**
${keywords.join(', ')}

**Task:**
Analyze the comment and respond with ONLY ONE WORD (no explanation):
- "instruction" if it describes a rule/convention/standard
- "skill" if it describes a how-to/method/technique

Answer:`;
}
