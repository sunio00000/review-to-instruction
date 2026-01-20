/**
 * CryptoService - Web Crypto API를 사용한 토큰 암호화/복호화
 *
 * AES-GCM 256-bit 암호화를 사용하여 API 토큰을 안전하게 저장합니다.
 * Extension ID를 기반으로 암호화 키를 생성하므로, 각 Extension 설치마다 고유한 키를 가집니다.
 *
 * 보안 특성:
 * - AES-GCM 256-bit 암호화
 * - Extension ID 기반 키 유도 (PBKDF2 100,000 iterations)
 * - 12-byte IV (Initialization Vector) 사용
 * - 암호문과 IV를 base64로 인코딩하여 저장
 */

export class CryptoService {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;  // 12 bytes for AES-GCM
  private static readonly PBKDF2_ITERATIONS = 100000;
  private static readonly SALT = 'review-to-instruction-salt-v1';

  /**
   * Chrome Extension ID를 기반으로 암호화 키 생성
   *
   * PBKDF2를 사용하여 Extension ID에서 암호화 키를 유도합니다.
   * 각 Extension 설치마다 고유한 ID를 가지므로, 재설치 시 새로운 키가 생성됩니다.
   *
   * @returns CryptoKey 객체
   */
  private async deriveKey(): Promise<CryptoKey> {
    // Chrome Extension ID 가져오기
    const extensionId = chrome.runtime.id;
    if (!extensionId) {
      throw new Error('[CryptoService] Extension ID not available');
    }

    const encoder = new TextEncoder();

    // Extension ID를 키 소스로 사용
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(extensionId),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // PBKDF2로 키 유도
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(CryptoService.SALT),
        iterations: CryptoService.PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: CryptoService.ALGORITHM,
        length: CryptoService.KEY_LENGTH
      },
      false,  // extractable = false (보안 강화)
      ['encrypt', 'decrypt']
    );

    return key;
  }

  /**
   * 토큰 암호화
   *
   * @param plaintext 암호화할 평문 문자열
   * @returns Base64로 인코딩된 암호문 (IV + 암호화된 데이터)
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!plaintext) {
      throw new Error('[CryptoService] Cannot encrypt empty string');
    }

    try {
      const key = await this.deriveKey();
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      // 랜덤 IV 생성
      const iv = crypto.getRandomValues(new Uint8Array(CryptoService.IV_LENGTH));

      // AES-GCM 암호화
      const encrypted = await crypto.subtle.encrypt(
        {
          name: CryptoService.ALGORITHM,
          iv: iv
        },
        key,
        data
      );

      // IV + 암호문 결합
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Base64로 인코딩
      return this.arrayBufferToBase64(combined);
    } catch (error) {
      console.error('[CryptoService] Encryption failed:', error);
      throw new Error('암호화 중 오류가 발생했습니다.');
    }
  }

  /**
   * 토큰 복호화
   *
   * @param ciphertext Base64로 인코딩된 암호문
   * @returns 복호화된 평문 문자열
   */
  async decrypt(ciphertext: string): Promise<string> {
    if (!ciphertext) {
      throw new Error('[CryptoService] Cannot decrypt empty string');
    }

    try {
      const key = await this.deriveKey();

      // Base64 디코딩
      const combined = this.base64ToArrayBuffer(ciphertext);

      // IV와 암호문 분리
      const iv = combined.slice(0, CryptoService.IV_LENGTH);
      const encrypted = combined.slice(CryptoService.IV_LENGTH);

      // AES-GCM 복호화
      const decrypted = await crypto.subtle.decrypt(
        {
          name: CryptoService.ALGORITHM,
          iv: iv
        },
        key,
        encrypted
      );

      // 평문으로 변환
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('[CryptoService] Decryption failed:', error);
      throw new Error('복호화 중 오류가 발생했습니다. 토큰을 다시 입력해주세요.');
    }
  }

  /**
   * Uint8Array를 Base64 문자열로 변환
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    const binary = String.fromCharCode(...buffer);
    return btoa(binary);
  }

  /**
   * Base64 문자열을 Uint8Array로 변환
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Web Crypto API 지원 여부 확인
   *
   * @returns Web Crypto API가 사용 가능하면 true
   */
  static isSupported(): boolean {
    return (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof crypto.subtle.encrypt === 'function'
    );
  }
}
