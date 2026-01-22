/**
 * Review to Instruction - LLM Cache
 * LLM 응답 캐싱으로 API 비용 절감 (Feature 2)
 */

import type { LLMProvider } from '../../types';
import type { LLMAnalysisResult } from './types';

// 캐시 버전 (프롬프트 변경 시 증가)
const CACHE_VERSION = 1;

// 캐시 설정
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30일 (ms)
const MAX_CACHE_ENTRIES = 1000;
const STORAGE_KEY = 'llm_response_cache';

/**
 * 캐시 엔트리
 */
interface CacheEntry {
  key: string;
  data: LLMAnalysisResult;
  metadata: {
    provider: LLMProvider;
    timestamp: number;
    ttl: number;
    accessCount: number;
    lastAccessed: number;
    version: number;
  };
}

/**
 * 캐시 통계
 */
export interface CacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  cacheSize: number; // bytes (추정치)
  oldestEntry?: number; // timestamp
  newestEntry?: number; // timestamp
}

/**
 * LLM 응답 캐시 관리자
 */
export class LLMCache {
  private hitCount = 0;
  private missCount = 0;

  /**
   * 캐시 키 생성 (SHA-256)
   */
  async generateCacheKey(
    content: string,
    codeExamples: string[],
    provider: LLMProvider
  ): Promise<string> {
    // 버전:provider:content:examples 조합
    const data = `${CACHE_VERSION}:${provider}:${content}:${codeExamples.join('||')}`;

    // SHA-256 해시 생성 (Web Crypto API)
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);

    // ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  /**
   * 캐시에서 데이터 조회
   */
  async get(key: string): Promise<LLMAnalysisResult | null> {
    try {
      const storage = await chrome.storage.local.get(STORAGE_KEY);
      const cache = (storage[STORAGE_KEY] || {}) as Record<string, CacheEntry>;

      const entry = cache[key];

      if (!entry) {
        this.missCount++;
        return null;
      }

      // 버전 확인
      if (entry.metadata.version !== CACHE_VERSION) {
        await this.delete(key);
        this.missCount++;
        return null;
      }

      // TTL 확인
      const now = Date.now();
      const age = now - entry.metadata.timestamp;

      if (age > entry.metadata.ttl) {
        await this.delete(key);
        this.missCount++;
        return null;
      }

      // 접근 정보 업데이트
      entry.metadata.accessCount++;
      entry.metadata.lastAccessed = now;
      cache[key] = entry;

      await chrome.storage.local.set({ [STORAGE_KEY]: cache });

        provider: entry.metadata.provider,
        age: Math.round(age / 1000 / 60 / 60), // hours
        accessCount: entry.metadata.accessCount
      });

      this.hitCount++;
      return entry.data;

    } catch (error) {
      this.missCount++;
      return null;
    }
  }

  /**
   * 캐시에 데이터 저장
   */
  async set(
    key: string,
    data: LLMAnalysisResult,
    provider: LLMProvider
  ): Promise<void> {
    try {
      const storage = await chrome.storage.local.get(STORAGE_KEY);
      const cache = (storage[STORAGE_KEY] || {}) as Record<string, CacheEntry>;

      // 캐시 크기 확인 및 LRU 정책 적용
      const currentSize = Object.keys(cache).length;
      if (currentSize >= MAX_CACHE_ENTRIES) {
        await this.evictOldestEntries(cache);
      }

      // 새 엔트리 생성
      const entry: CacheEntry = {
        key,
        data,
        metadata: {
          provider,
          timestamp: Date.now(),
          ttl: CACHE_TTL,
          accessCount: 1,
          lastAccessed: Date.now(),
          version: CACHE_VERSION
        }
      };

      cache[key] = entry;

      await chrome.storage.local.set({ [STORAGE_KEY]: cache });

        provider,
        cacheSize: Object.keys(cache).length
      });

    } catch (error) {
      // 캐시 저장 실패해도 에러를 throw하지 않음 (Fail-safe)
    }
  }

  /**
   * 캐시 엔트리 삭제
   */
  async delete(key: string): Promise<void> {
    try {
      const storage = await chrome.storage.local.get(STORAGE_KEY);
      const cache = (storage[STORAGE_KEY] || {}) as Record<string, CacheEntry>;

      delete cache[key];

      await chrome.storage.local.set({ [STORAGE_KEY]: cache });


    } catch (error) {
    }
  }

  /**
   * 캐시 전체 초기화
   */
  async clear(): Promise<void> {
    try {
      await chrome.storage.local.remove(STORAGE_KEY);
      this.hitCount = 0;
      this.missCount = 0;


    } catch (error) {
      throw error;
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getStats(): Promise<CacheStats> {
    try {
      const storage = await chrome.storage.local.get(STORAGE_KEY);
      const cache = (storage[STORAGE_KEY] || {}) as Record<string, CacheEntry>;

      const entries = Object.values(cache);
      const totalEntries = entries.length;

      // 캐시 크기 추정 (JSON 문자열 길이)
      const cacheSize = JSON.stringify(cache).length;

      // 가장 오래된/최신 엔트리
      let oldestEntry: number | undefined;
      let newestEntry: number | undefined;

      if (totalEntries > 0) {
        const timestamps = entries.map(e => e.metadata.timestamp);
        oldestEntry = Math.min(...timestamps);
        newestEntry = Math.max(...timestamps);
      }

      return {
        totalEntries,
        hitCount: this.hitCount,
        missCount: this.missCount,
        cacheSize,
        oldestEntry,
        newestEntry
      };

    } catch (error) {
      return {
        totalEntries: 0,
        hitCount: this.hitCount,
        missCount: this.missCount,
        cacheSize: 0
      };
    }
  }

  /**
   * LRU 정책: 오래된 엔트리 제거 (최대 용량의 10%)
   */
  private async evictOldestEntries(cache: Record<string, CacheEntry>): Promise<void> {
    const entries = Object.entries(cache);

    // lastAccessed 기준으로 정렬
    entries.sort((a, b) => a[1].metadata.lastAccessed - b[1].metadata.lastAccessed);

    // 오래된 10% 제거
    const evictCount = Math.ceil(MAX_CACHE_ENTRIES * 0.1);
    const toEvict = entries.slice(0, evictCount);


    for (const [key] of toEvict) {
      delete cache[key];
    }
  }
}

// 싱글톤 인스턴스
export const llmCache = new LLMCache();
