/**
 * CryptoService - Web Crypto API를 사용한 토큰 암호화/복호화
 *
 * AES-GCM 256-bit 암호화를 사용하여 API 토큰을 안전하게 저장합니다.
 * 마스터 비밀번호 기반 암호화를 사용하여 강력한 보안을 제공합니다.
 *
 * 보안 특성:
 * - AES-GCM 256-bit 암호화
 * - 마스터 비밀번호 기반 키 유도 (PBKDF2 500,000 iterations)
 * - Extension ID를 Salt에 포함하여 설치마다 고유한 키 생성
 * - 12-byte IV (Initialization Vector) 사용
 * - 암호문과 IV를 base64로 인코딩하여 저장
 * - Legacy: Extension ID 기반 암호화 지원 (마이그레이션용, 100,000 iterations)
 *
 * 세션 관리:
 * - 마스터 비밀번호는 메모리에만 저장 (chrome.storage 미사용)
 * - 브라우저 세션 동안 유지 (Service Worker 종료 시까지)
 * - Popup과 Background 간 메시지 패싱으로 동기화
 */

export class CryptoService {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;  // 12 bytes for AES-GCM
  private static readonly PBKDF2_ITERATIONS_LEGACY = 100000;  // Legacy Extension ID 방식
  private static readonly PBKDF2_ITERATIONS = 500000;  // 마스터 비밀번호 방식
  private static readonly SALT = 'review-to-instruction-salt-v1';

  // 마스터 비밀번호 저장 (메모리에만, 세션 유지)
  private masterPassword: string | null = null;

  /**
   * 마스터 비밀번호 설정
   *
   * @param password 사용자가 설정한 마스터 비밀번호
   */
  setMasterPassword(password: string): void {
    this.masterPassword = password;
  }

  /**
   * 마스터 비밀번호 가져오기
   *
   * @returns 현재 설정된 마스터 비밀번호 (없으면 null)
   */
  getMasterPassword(): string | null {
    return this.masterPassword;
  }

  /**
   * 마스터 비밀번호 초기화
   */
  clearMasterPassword(): void {
    this.masterPassword = null;
  }

  /**
   * 마스터 비밀번호를 기반으로 암호화 키 생성
   *
   * PBKDF2를 사용하여 사용자 비밀번호에서 암호화 키를 유도합니다.
   * 사용자별로 고유한 비밀번호를 사용하므로 Extension ID 방식보다 보안이 강화됩니다.
   *
   * @param password 마스터 비밀번호
   * @returns CryptoKey 객체
   */
  private async deriveKeyFromPassword(password: string): Promise<CryptoKey> {
    if (!password) {
      throw new Error('[CryptoService] 마스터 비밀번호가 필요합니다.');
    }

    const encoder = new TextEncoder();

    // 사용자 비밀번호로 키 소스 생성
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Extension ID를 SALT에 포함하여 설치마다 다른 키 생성
    const extensionId = chrome.runtime.id || 'default-extension-id';
    const dynamicSalt = `${CryptoService.SALT}|${extensionId}`;

    // PBKDF2로 키 유도 (500K iterations로 보안 강화)
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(dynamicSalt),
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
   * Chrome Extension ID를 기반으로 암호화 키 생성 (Legacy)
   *
   * PBKDF2를 사용하여 Extension ID에서 암호화 키를 유도합니다.
   * 기존 데이터 마이그레이션을 위해 유지됩니다.
   *
   * @returns CryptoKey 객체
   */
  private async deriveKeyLegacy(): Promise<CryptoKey> {
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

    // PBKDF2로 키 유도 (Legacy 100K iterations)
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(CryptoService.SALT),
        iterations: CryptoService.PBKDF2_ITERATIONS_LEGACY,
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
   * 현재 사용할 암호화 키 생성
   *
   * 마스터 비밀번호가 설정되어 있으면 비밀번호 기반, 없으면 Extension ID 기반
   *
   * @returns CryptoKey 객체
   */
  private async deriveKey(): Promise<CryptoKey> {
    if (this.masterPassword) {
      return await this.deriveKeyFromPassword(this.masterPassword);
    } else {
      // Fallback to legacy Extension ID 방식
      return await this.deriveKeyLegacy();
    }
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
      throw new Error('암호화 중 오류가 발생했습니다.');
    }
  }

  /**
   * 토큰 복호화
   *
   * 마스터 비밀번호가 설정된 경우 비밀번호 기반 복호화를 시도하고,
   * 실패하면 Legacy Extension ID 기반 복호화를 시도합니다.
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
      // 마스터 비밀번호 방식으로 실패한 경우, Legacy 방식 시도
      if (this.masterPassword) {
        try {
          const legacyKey = await this.deriveKeyLegacy();
          const combined = this.base64ToArrayBuffer(ciphertext);
          const iv = combined.slice(0, CryptoService.IV_LENGTH);
          const encrypted = combined.slice(CryptoService.IV_LENGTH);

          const decrypted = await crypto.subtle.decrypt(
            {
              name: CryptoService.ALGORITHM,
              iv: iv
            },
            legacyKey,
            encrypted
          );

          const decoder = new TextDecoder();
          const plaintext = decoder.decode(decrypted);

          return plaintext;
        } catch (legacyError) {
        }
      }

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
