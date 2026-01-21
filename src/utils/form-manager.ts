/**
 * FormManager - 폼 필드 관리 클래스
 *
 * Chrome Extension 팝업의 폼 필드를 선언적으로 관리합니다.
 *
 * 주요 기능:
 * - DOM 요소 캐싱 (Map을 사용한 빠른 접근)
 * - 암호화된 필드 자동 처리 (CryptoService 연동)
 * - chrome.storage.local과의 자동 동기화
 * - 검증 규칙 적용
 * - 조건부 필드 가시성 관리
 * - 빈 값 자동 제거 (storage.remove 호출)
 */

import { CryptoService } from '../background/services/crypto-service';
import type { FieldSchema, FormState, ValidationRule } from '../types/form-manager';

/**
 * ValidationResult: 검증 결과
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Map<string, string>;  // fieldId -> error message
}

/**
 * FormManager 클래스
 *
 * 사용 예시:
 * ```typescript
 * const fields: FieldSchema[] = [
 *   { id: 'github-token', storageKey: 'githubToken_enc', type: 'password', encrypted: true },
 *   { id: 'show-buttons', storageKey: 'showButtons', type: 'checkbox', encrypted: false, defaultValue: true },
 * ];
 *
 * const manager = new FormManager(fields, new CryptoService());
 * manager.bindElements();
 * await manager.load();
 * ```
 */
export class FormManager {
  private readonly fields: FieldSchema[];
  private readonly crypto: CryptoService;
  private readonly elements: Map<string, HTMLElement>;
  private currentState: FormState;

  /**
   * FormManager 생성자
   *
   * @param fields 폼 필드 스키마 배열
   * @param crypto CryptoService 인스턴스 (암호화/복호화용)
   */
  constructor(fields: FieldSchema[], crypto: CryptoService) {
    if (!fields || fields.length === 0) {
      throw new Error('[FormManager] 필드 스키마가 비어있습니다.');
    }

    if (!crypto) {
      throw new Error('[FormManager] CryptoService 인스턴스가 필요합니다.');
    }

    this.fields = fields;
    this.crypto = crypto;
    this.elements = new Map<string, HTMLElement>();
    this.currentState = {};
  }

  /**
   * DOM 요소 바인딩
   *
   * 모든 필드의 DOM 요소를 캐시합니다.
   * 요소를 찾지 못하면 경고 로그를 출력하고 계속 진행합니다.
   */
  bindElements(): void {
    for (const field of this.fields) {
      const element = document.getElementById(field.id);

      if (!element) {
        console.warn(`[FormManager] Element not found: #${field.id}`);
        continue;
      }

      this.elements.set(field.id, element);
    }

    console.log(`[FormManager] ${this.elements.size}/${this.fields.length} elements bound`);
  }

  /**
   * 스토리지에서 설정 로드
   *
   * chrome.storage.local에서 값을 읽어와 DOM에 반영합니다.
   * 암호화된 필드는 자동으로 복호화합니다.
   */
  async load(): Promise<void> {
    // 저장 키 목록 생성
    const storageKeys = this.fields.map(f => f.storageKey);

    // 스토리지에서 일괄 조회
    const result = await chrome.storage.local.get(storageKeys);

    // 각 필드에 값 설정
    for (const field of this.fields) {
      const element = this.elements.get(field.id);
      if (!element) continue;

      let value = result[field.storageKey];

      // 값이 없으면 기본값 사용
      if (value === undefined || value === null) {
        value = field.defaultValue;
      }

      // 암호화된 필드 복호화
      if (field.encrypted && value && typeof value === 'string') {
        try {
          value = await this.crypto.decrypt(value);
        } catch (error) {
          console.warn(`[FormManager] Decryption failed for ${field.id}:`, error);
          value = '';  // 복호화 실패 시 빈 값으로 설정
        }
      }

      // DOM 요소에 값 설정
      this.setElementValue(element, field.type, value);

      // 현재 상태 업데이트
      this.currentState[field.id] = value;
    }

    // 가시성 업데이트
    this.updateVisibility();
  }

  /**
   * 설정을 스토리지에 저장
   *
   * DOM에서 값을 읽어 chrome.storage.local에 저장합니다.
   * 암호화된 필드는 자동으로 암호화합니다.
   * 빈 값은 스토리지에서 제거합니다.
   *
   * @returns 검증 결과 (검증 실패 시 저장하지 않음)
   */
  async save(): Promise<ValidationResult> {
    // 검증 먼저 수행
    const validationResult = this.validate();
    if (!validationResult.isValid) {
      return validationResult;
    }

    const dataToSave: Record<string, any> = {};
    const keysToRemove: string[] = [];

    // DOM에서 값 읽기
    for (const field of this.fields) {
      const element = this.elements.get(field.id);
      if (!element) continue;

      let value = this.getElementValue(element, field.type);

      // 현재 상태 업데이트
      this.currentState[field.id] = value;

      // 빈 값 처리
      const isEmpty = this.isEmptyValue(value, field.type);

      if (isEmpty) {
        keysToRemove.push(field.storageKey);
        continue;
      }

      // 암호화된 필드 암호화
      if (field.encrypted && typeof value === 'string') {
        try {
          value = await this.crypto.encrypt(value);
        } catch (error) {
          console.error(`[FormManager] Encryption failed for ${field.id}:`, error);
          throw new Error(`${field.id} 암호화 중 오류가 발생했습니다.`);
        }
      }

      dataToSave[field.storageKey] = value;
    }

    // 배치 저장 및 삭제 수행
    const operations: Promise<void>[] = [];

    // 값 저장
    if (Object.keys(dataToSave).length > 0) {
      operations.push(chrome.storage.local.set(dataToSave));
    }

    // 빈 값 삭제
    if (keysToRemove.length > 0) {
      operations.push(chrome.storage.local.remove(keysToRemove));
    }

    await Promise.all(operations);

    console.log(`[FormManager] Saved ${Object.keys(dataToSave).length} fields, removed ${keysToRemove.length} empty fields`);

    return validationResult;
  }

  /**
   * 폼 검증
   *
   * 모든 필드의 검증 규칙을 실행합니다.
   *
   * @returns ValidationResult
   */
  validate(): ValidationResult {
    const errors = new Map<string, string>();

    for (const field of this.fields) {
      if (!field.validation) continue;

      const element = this.elements.get(field.id);
      if (!element) continue;

      const value = this.getElementValue(element, field.type);
      const error = this.validateField(value, field.validation, field.id);

      if (error) {
        errors.set(field.id, error);
      }
    }

    return {
      isValid: errors.size === 0,
      errors
    };
  }

  /**
   * 조건부 가시성 업데이트
   *
   * 각 필드의 visible 함수를 실행하여 DOM 요소의 표시 여부를 결정합니다.
   */
  updateVisibility(): void {
    // 현재 상태 최신화
    this.refreshCurrentState();

    for (const field of this.fields) {
      if (!field.visible) continue;

      const element = this.elements.get(field.id);
      if (!element) continue;

      // visible 함수 실행
      const shouldShow = field.visible(this.currentState);

      // 부모 요소(그룹)의 가시성 조절
      // 1. .input-group 클래스 찾기
      // 2. .form-group 클래스 찾기
      // 3. 없으면 요소 자체
      const inputGroup = element.closest('.input-group') as HTMLElement;
      const formGroup = element.closest('.form-group') as HTMLElement;
      const targetElement = inputGroup || formGroup || element;

      if (shouldShow) {
        targetElement.style.display = '';
      } else {
        targetElement.style.display = 'none';
      }
    }
  }

  /**
   * 현재 폼 상태 반환
   */
  getState(): FormState {
    this.refreshCurrentState();
    return { ...this.currentState };
  }

  /**
   * 특정 필드 값 가져오기
   *
   * @param fieldId 필드 ID
   */
  getValue(fieldId: string): any {
    const element = this.elements.get(fieldId);
    if (!element) return undefined;

    const field = this.fields.find(f => f.id === fieldId);
    if (!field) return undefined;

    return this.getElementValue(element, field.type);
  }

  /**
   * 특정 필드 값 설정
   *
   * @param fieldId 필드 ID
   * @param value 설정할 값
   */
  setValue(fieldId: string, value: any): void {
    const element = this.elements.get(fieldId);
    if (!element) {
      console.warn(`[FormManager] Element not found for setValue: ${fieldId}`);
      return;
    }

    const field = this.fields.find(f => f.id === fieldId);
    if (!field) return;

    this.setElementValue(element, field.type, value);
    this.currentState[fieldId] = value;

    // 가시성 업데이트
    this.updateVisibility();
  }

  /**
   * 상태 변경 시 가시성 자동 업데이트를 위한 이벤트 리스너 등록
   */
  bindVisibilityUpdates(): void {
    for (const field of this.fields) {
      const element = this.elements.get(field.id);
      if (!element) continue;

      const eventType = this.getChangeEventType(field.type);
      element.addEventListener(eventType, () => {
        this.updateVisibility();
      });
    }
  }

  // --- Private Helper Methods ---

  /**
   * 현재 상태 최신화
   */
  private refreshCurrentState(): void {
    for (const field of this.fields) {
      const element = this.elements.get(field.id);
      if (!element) continue;

      this.currentState[field.id] = this.getElementValue(element, field.type);
    }
  }

  /**
   * DOM 요소에서 값 읽기
   */
  private getElementValue(element: HTMLElement, type: FieldSchema['type']): any {
    switch (type) {
      case 'checkbox':
        return (element as HTMLInputElement).checked;

      case 'select':
        return (element as HTMLSelectElement).value;

      case 'text':
      case 'password':
      default:
        return (element as HTMLInputElement).value.trim();
    }
  }

  /**
   * DOM 요소에 값 설정
   */
  private setElementValue(element: HTMLElement, type: FieldSchema['type'], value: any): void {
    switch (type) {
      case 'checkbox':
        (element as HTMLInputElement).checked = Boolean(value);
        break;

      case 'select':
        (element as HTMLSelectElement).value = String(value ?? '');
        break;

      case 'text':
      case 'password':
      default:
        (element as HTMLInputElement).value = String(value ?? '');
        break;
    }
  }

  /**
   * 빈 값 확인
   */
  private isEmptyValue(value: any, type: FieldSchema['type']): boolean {
    if (value === undefined || value === null) {
      return true;
    }

    switch (type) {
      case 'checkbox':
        // 체크박스는 false도 유효한 값으로 간주 (빈 값 아님)
        return false;

      case 'text':
      case 'password':
      case 'select':
      default:
        return typeof value === 'string' && value.trim() === '';
    }
  }

  /**
   * 필드 검증 실행
   *
   * @returns 에러 메시지 또는 null (성공 시)
   */
  private validateField(value: any, rules: ValidationRule, fieldId: string): string | null {
    // 필수 검증
    if (rules.required) {
      const isEmpty = (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '')
      );

      if (isEmpty) {
        return rules.message || `${fieldId}은(는) 필수 입력 항목입니다.`;
      }
    }

    // 패턴 검증 (문자열만)
    if (rules.pattern && typeof value === 'string' && value.trim() !== '') {
      if (!rules.pattern.test(value)) {
        return rules.message || `${fieldId}의 형식이 올바르지 않습니다.`;
      }
    }

    // 커스텀 검증
    if (rules.custom) {
      const result = rules.custom(value);

      if (result === false) {
        return rules.message || `${fieldId} 검증에 실패했습니다.`;
      }

      if (typeof result === 'string') {
        return result;  // 커스텀 함수가 에러 메시지 반환
      }
    }

    return null;  // 검증 성공
  }

  /**
   * 필드 타입에 따른 변경 이벤트 타입 반환
   */
  private getChangeEventType(type: FieldSchema['type']): string {
    switch (type) {
      case 'checkbox':
      case 'select':
        return 'change';

      case 'text':
      case 'password':
      default:
        return 'input';
    }
  }
}
