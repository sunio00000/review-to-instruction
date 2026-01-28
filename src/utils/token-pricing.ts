/**
 * LLM 토큰 가격 정보 (2026년 1월 기준)
 * 마지막 업데이트: 2026-01-28
 */

export interface TokenPricing {
  inputPricePerMillion: number;   // USD per 1M tokens
  outputPricePerMillion: number;  // USD per 1M tokens
}

const USD_TO_KRW = 1350; // 환율 (주기적으로 업데이트 필요)

// Claude Sonnet 4.5 가격
const CLAUDE_SONNET_45_PRICING: TokenPricing = {
  inputPricePerMillion: 3.0,
  outputPricePerMillion: 15.0
};

// OpenAI GPT-4 Turbo 가격
const OPENAI_GPT4_TURBO_PRICING: TokenPricing = {
  inputPricePerMillion: 10.0,
  outputPricePerMillion: 30.0
};

/**
 * 토큰 사용량을 비용으로 변환
 */
export function calculateCost(
  tokenUsage: { inputTokens: number; outputTokens: number },
  provider: 'claude' | 'openai'
): { usd: number; krw: number } {
  const pricing = provider === 'claude'
    ? CLAUDE_SONNET_45_PRICING
    : OPENAI_GPT4_TURBO_PRICING;

  const inputCost = (tokenUsage.inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (tokenUsage.outputTokens / 1_000_000) * pricing.outputPricePerMillion;
  const totalUsd = inputCost + outputCost;
  const totalKrw = totalUsd * USD_TO_KRW;

  return {
    usd: Math.round(totalUsd * 1000) / 1000, // 소수점 3자리
    krw: Math.round(totalKrw)
  };
}

/**
 * 비용을 사용자 친화적인 문자열로 포맷
 */
export function formatCost(cost: { usd: number; krw: number }): string {
  if (cost.usd < 0.01) {
    return `~₩${cost.krw}`;
  }
  return `$${cost.usd.toFixed(3)} (~₩${cost.krw.toLocaleString()})`;
}
