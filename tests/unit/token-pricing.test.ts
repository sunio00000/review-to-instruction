/**
 * TokenPricing 단위 테스트
 * 토큰 비용 계산 및 포맷 검증
 */

import { describe, it, expect } from 'vitest';
import { calculateCost, formatCost } from '../../src/utils/token-pricing';

describe('calculateCost', () => {
  it('Claude 토큰 비용을 올바르게 계산해야 함', () => {
    const cost = calculateCost(
      { inputTokens: 1000, outputTokens: 500 },
      'claude'
    );

    // Claude Sonnet 4.5: input $3/1M, output $15/1M
    // 1000 input: 1000/1M * 3 = 0.003
    // 500 output: 500/1M * 15 = 0.0075
    // total: 0.0105 → rounded to 0.011 or 0.01 (3 decimal)
    expect(cost.usd).toBeCloseTo(0.0105, 2);
    expect(cost.krw).toBeGreaterThan(0);
  });

  it('OpenAI 토큰 비용을 올바르게 계산해야 함', () => {
    const cost = calculateCost(
      { inputTokens: 1000, outputTokens: 500 },
      'openai'
    );

    // GPT-4 Turbo: input $10/1M, output $30/1M
    // 1000 input: 1000/1M * 10 = 0.01
    // 500 output: 500/1M * 30 = 0.015
    // total: 0.025 USD
    expect(cost.usd).toBeCloseTo(0.025, 3);
    expect(cost.krw).toBeGreaterThan(0);
  });

  it('0 토큰이면 0 비용 반환', () => {
    const cost = calculateCost(
      { inputTokens: 0, outputTokens: 0 },
      'claude'
    );

    expect(cost.usd).toBe(0);
    expect(cost.krw).toBe(0);
  });

  it('KRW 환율이 적용되어야 함', () => {
    const cost = calculateCost(
      { inputTokens: 1_000_000, outputTokens: 0 },
      'claude'
    );

    // 1M input * $3/1M = $3 USD
    expect(cost.usd).toBe(3);
    // $3 * 1350 = ₩4050
    expect(cost.krw).toBe(4050);
  });

  it('대량 토큰에도 올바르게 계산해야 함', () => {
    const cost = calculateCost(
      { inputTokens: 100_000, outputTokens: 50_000 },
      'claude'
    );

    expect(cost.usd).toBeGreaterThan(0);
    expect(cost.krw).toBeGreaterThan(0);
  });
});

describe('formatCost', () => {
  it('$0.01 이상이면 USD와 KRW 모두 표시', () => {
    const formatted = formatCost({ usd: 0.025, krw: 34 });

    expect(formatted).toContain('$0.025');
    expect(formatted).toContain('₩');
  });

  it('$0.01 미만이면 KRW만 표시', () => {
    const formatted = formatCost({ usd: 0.005, krw: 7 });

    expect(formatted).toBe('~₩7');
    expect(formatted).not.toContain('$');
  });

  it('0원이면 적절하게 표시', () => {
    const formatted = formatCost({ usd: 0, krw: 0 });

    expect(formatted).toBe('~₩0');
  });
});
