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
`).join('\n')}` : ''}

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
1. Summarize the comment${hasReplies ? ' and discussion thread' : ''} in 1-2 sentences (focus on the main rule/pattern).
2. Provide a detailed explanation (restructure the comment${hasReplies ? ' and incorporate insights from replies' : ''} for clarity).
3. ${hasCode ? 'Explain each code example (what it demonstrates, why it\'s good/bad).' : 'No code examples provided.'}
4. Extract additional relevant keywords:
   - Programming concepts not obvious from the text
   - Technologies or frameworks implied by the context
   - Design patterns, principles, or best practices mentioned
   - Related tools, libraries, or methodologies
   ${hasExistingKeywords ? '- ONLY include keywords NOT already in the existing list above' : ''}
   - Prioritize: domain terms > patterns > technologies > general concepts
5. Suggest the most appropriate category from: naming, style, architecture, testing, security, performance, error-handling, documentation, accessibility, i18n, api, database, state-management, git, ci-cd, dependencies.
6. Provide reasoning information:
   - detectedIntent: List of detected intents (e.g., "code refactoring request", "bug fix suggestion", "naming convention")
   - keyPhrases: Key phrases extracted from the comment (2-5 most important phrases)
   - codeReferences: Mentioned code locations, function names, or file paths
   - confidenceScore: Confidence score (0-100) based on:
     * Clarity and specificity of the comment (40 points)
     * Presence of code examples (30 points)
     * Explicit rules or patterns mentioned (30 points)

**Output Format (JSON):**
{
  "summary": "Brief 1-2 sentence summary IN ENGLISH",
  "detailedExplanation": "Clear, restructured explanation of the rule/pattern IN ENGLISH",
  "codeExplanations": [
    {
      "code": "original code snippet",
      "explanation": "What this code demonstrates IN ENGLISH",
      "isGoodExample": true/false
    }
  ],
  "additionalKeywords": ["keyword1", "keyword2"],
  "suggestedCategory": "category",
  "reasoning": {
    "detectedIntent": ["intent1", "intent2"],
    "keyPhrases": ["phrase1", "phrase2"],
    "codeReferences": ["file.ts:123", "functionName"],
    "confidenceScore": 85
  }
}

**Important:**
- ALL text output MUST be in ENGLISH (summary, detailedExplanation, codeExplanations, etc.)
- Be concise but clear.
- Focus on the coding rule/pattern/convention.
${hasReplies ? '- Consider the discussion context from replies to provide comprehensive analysis.' : ''}
- If code examples use ✅/❌ or "good"/"bad" markers, identify isGoodExample accordingly.
${hasExistingKeywords ? '- For additionalKeywords: Only include NEW keywords not in the existing list. Think about implicit concepts, related patterns, or domain terminology.' : '- For additionalKeywords: Include 3-8 relevant keywords that capture the essence of this convention.'}
- Keep keywords concise (1-3 words max, kebab-case preferred).
- Output ONLY valid JSON (no markdown code blocks, no extra text).`;
}

/**
 * 시스템 프롬프트 (선택적)
 */
export const SYSTEM_PROMPT = `You are an expert code review analyzer specializing in extracting coding conventions, patterns, and best practices from review comments. Your goal is to help teams document and standardize their coding guidelines.`;
