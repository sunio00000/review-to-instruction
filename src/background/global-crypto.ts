/**
 * Global CryptoService Instance
 * 순환 참조 방지를 위해 별도 파일로 분리
 */

import { CryptoService } from './services/crypto-service';

/**
 * 전역 CryptoService 인스턴스 (마스터 비밀번호 유지)
 * Background Service Worker의 세션 동안 유지됨
 */
export const globalCrypto = new CryptoService();
