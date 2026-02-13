/**
 * RateLimiter & Debouncer 단위 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter, Debouncer } from '../../src/utils/rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('제한 내 요청은 허용해야 함', () => {
    const limiter = new RateLimiter(3, 1000);

    expect(limiter.tryRequest()).toBe(true);
    expect(limiter.tryRequest()).toBe(true);
    expect(limiter.tryRequest()).toBe(true);
  });

  it('제한 초과 요청은 거부해야 함', () => {
    const limiter = new RateLimiter(2, 1000);

    expect(limiter.tryRequest()).toBe(true);
    expect(limiter.tryRequest()).toBe(true);
    expect(limiter.tryRequest()).toBe(false);
  });

  it('시간 경과 후 요청이 다시 허용되어야 함', () => {
    const limiter = new RateLimiter(1, 1000);

    expect(limiter.tryRequest()).toBe(true);
    expect(limiter.tryRequest()).toBe(false);

    // 1초 경과
    vi.advanceTimersByTime(1001);

    expect(limiter.tryRequest()).toBe(true);
  });

  it('getRemainingRequests가 남은 요청 수를 반환해야 함', () => {
    const limiter = new RateLimiter(3, 1000);

    expect(limiter.getRemainingRequests()).toBe(3);

    limiter.tryRequest();
    expect(limiter.getRemainingRequests()).toBe(2);

    limiter.tryRequest();
    expect(limiter.getRemainingRequests()).toBe(1);

    limiter.tryRequest();
    expect(limiter.getRemainingRequests()).toBe(0);
  });

  it('getTimeUntilReset이 리셋까지 남은 시간을 반환해야 함', () => {
    const limiter = new RateLimiter(1, 5000);

    // 요청이 없으면 0
    expect(limiter.getTimeUntilReset()).toBe(0);

    limiter.tryRequest();

    // 5초 윈도우에서 바로 확인하면 약 5000ms 남음
    const remaining = limiter.getTimeUntilReset();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(5000);
  });

  it('reset이 모든 요청 기록을 초기화해야 함', () => {
    const limiter = new RateLimiter(1, 1000);

    limiter.tryRequest();
    expect(limiter.tryRequest()).toBe(false);

    limiter.reset();

    expect(limiter.tryRequest()).toBe(true);
    expect(limiter.getRemainingRequests()).toBe(0);
  });
});

describe('Debouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('canCall이 첫 호출에서 true를 반환해야 함', () => {
    const debouncer = new Debouncer(1000);

    expect(debouncer.canCall()).toBe(true);
  });

  it('canCall이 딜레이 내에서 false를 반환해야 함', () => {
    const debouncer = new Debouncer(1000);

    debouncer.canCall(); // 첫 호출 -> true
    expect(debouncer.canCall()).toBe(false); // 바로 다시 -> false
  });

  it('canCall이 딜레이 후에 true를 반환해야 함', () => {
    const debouncer = new Debouncer(1000);

    debouncer.canCall();

    vi.advanceTimersByTime(1001);

    expect(debouncer.canCall()).toBe(true);
  });

  it('getTimeRemaining이 남은 시간을 반환해야 함', () => {
    const debouncer = new Debouncer(1000);

    debouncer.canCall();

    const remaining = debouncer.getTimeRemaining();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(1000);
  });

  it('getTimeRemaining이 호출 전에 0을 반환해야 함', () => {
    const debouncer = new Debouncer(1000);

    // canCall을 호출하지 않은 상태
    expect(debouncer.getTimeRemaining()).toBe(0);
  });

  it('debounce가 마지막 호출만 실행해야 함', () => {
    const debouncer = new Debouncer(500);
    const fn = vi.fn();
    const debouncedFn = debouncer.debounce(fn);

    debouncedFn('a');
    debouncedFn('b');
    debouncedFn('c');

    // 아직 실행되지 않음
    expect(fn).not.toHaveBeenCalled();

    // 500ms 경과
    vi.advanceTimersByTime(500);

    // 마지막 호출만 실행됨
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });
});
