/**
 * LLM 프롬프트 템플릿
 */

/**
 * 코멘트 분석 프롬프트
 */
export function buildAnalysisPrompt(content: string, codeExamples: string[]): string {
  const hasCode = codeExamples.length > 0;

  return `You are a code review analyzer. Analyze the following code review comment and provide structured output.

**Review Comment:**
${content}

${hasCode ? `**Code Examples Found:**
${codeExamples.map((code, i) => `Example ${i + 1}:\n\`\`\`\n${code}\n\`\`\`\n`).join('\n')}` : ''}

**Task:**
1. Summarize the comment in 1-2 sentences (focus on the main rule/pattern).
2. Provide a detailed explanation (restructure the comment for clarity).
3. ${hasCode ? 'Explain each code example (what it demonstrates, why it\'s good/bad).' : 'No code examples provided.'}
4. Extract additional relevant keywords (programming concepts, technologies, patterns).
5. Suggest the most appropriate category from: naming, style, architecture, testing, security, performance, error-handling, documentation.

**Output Format (JSON):**
{
  "summary": "Brief 1-2 sentence summary",
  "detailedExplanation": "Clear, restructured explanation of the rule/pattern",
  "codeExplanations": [
    {
      "code": "original code snippet",
      "explanation": "What this code demonstrates",
      "isGoodExample": true/false
    }
  ],
  "additionalKeywords": ["keyword1", "keyword2"],
  "suggestedCategory": "category"
}

**Important:**
- Be concise but clear.
- Focus on the coding rule/pattern/convention.
- If code examples use ✅/❌ or "good"/"bad" markers, identify isGoodExample accordingly.
- Output ONLY valid JSON (no markdown code blocks, no extra text).`;
}

/**
 * 시스템 프롬프트 (선택적)
 */
export const SYSTEM_PROMPT = `You are an expert code review analyzer specializing in extracting coding conventions, patterns, and best practices from review comments. Your goal is to help teams document and standardize their coding guidelines.`;
