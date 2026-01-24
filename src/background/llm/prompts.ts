/**
 * LLM 프롬프트 템플릿
 */

/**
 * 코멘트 분석 프롬프트 (Feature 2: 스레드 답글 포함, 영어 출력)
 */
export function buildAnalysisPrompt(
  content: string,
  codeExamples: string[],
  replies?: Array<{ author: string; content: string; createdAt: string; }>
): string {
  const hasCode = codeExamples.length > 0;
  const hasReplies = replies && replies.length > 0;

  return `You are a code review analyzer. Analyze the following code review comment${hasReplies ? ' and discussion thread' : ''} and provide structured output IN ENGLISH.

**Review Comment:**
${content}

${hasReplies ? `**Discussion Thread (${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}):**
${replies.map((reply, i) => `Reply ${i + 1} by ${reply.author}:
${reply.content}
`).join('\n')}` : ''}

${hasCode ? `**Code Examples Found:**
${codeExamples.map((code, i) => `Example ${i + 1}:\n\`\`\`\n${code}\n\`\`\`\n`).join('\n')}` : ''}

**Task:**
1. Summarize the comment${hasReplies ? ' and discussion thread' : ''} in 1-2 sentences (focus on the main rule/pattern).
2. Provide a detailed explanation (restructure the comment${hasReplies ? ' and incorporate insights from replies' : ''} for clarity).
3. ${hasCode ? 'Explain each code example (what it demonstrates, why it\'s good/bad).' : 'No code examples provided.'}
4. Extract additional relevant keywords (programming concepts, technologies, patterns).
5. Suggest the most appropriate category from: naming, style, architecture, testing, security, performance, error-handling, documentation.

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
  "suggestedCategory": "category"
}

**Important:**
- ALL text output MUST be in ENGLISH (summary, detailedExplanation, codeExplanations, etc.)
- Be concise but clear.
- Focus on the coding rule/pattern/convention.
${hasReplies ? '- Consider the discussion context from replies to provide comprehensive analysis.' : ''}
- If code examples use ✅/❌ or "good"/"bad" markers, identify isGoodExample accordingly.
- Output ONLY valid JSON (no markdown code blocks, no extra text).`;
}

/**
 * 시스템 프롬프트 (선택적)
 */
export const SYSTEM_PROMPT = `You are an expert code review analyzer specializing in extracting coding conventions, patterns, and best practices from review comments. Your goal is to help teams document and standardize their coding guidelines.`;
