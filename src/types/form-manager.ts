/**
 * FormManager 타입 정의
 *
 * 폼 필드 관리를 위한 타입 시스템을 정의합니다.
 */

/**
 * FormState: 폼의 전체 상태를 표현하는 타입
 * 각 필드의 값을 저장합니다.
 */
export type FormState = Record<string, any>;

/**
 * ValidationRule: 필드 검증 규칙
 *
 * @property required - 필수 입력 여부
 * @property pattern - 정규식 패턴 검증
 * @property message - 검증 실패 시 표시할 메시지
 * @property custom - 커스텀 검증 함수 (true = 성공, false or string = 실패 메시지)
 */
export interface ValidationRule {
  required?: boolean;
  pattern?: RegExp;
  message?: string;
  custom?: (value: any) => boolean | string;
}

/**
 * FieldSchema: 폼 필드 스키마 정의
 *
 * @property id - DOM 엘리먼트 ID
 * @property storageKey - chrome.storage에 저장할 키
 * @property type - 필드 타입 (text, password, checkbox, select)
 * @property encrypted - 암호화 저장 여부
 * @property defaultValue - 기본값 (선택사항)
 * @property validation - 검증 규칙 (선택사항)
 * @property visible - 조건부 표시 함수 (선택사항)
 */
export interface FieldSchema {
  id: string;
  storageKey: string;
  type: 'text' | 'password' | 'checkbox' | 'select';
  encrypted: boolean;
  defaultValue?: string | boolean;
  validation?: ValidationRule;
  visible?: (state: FormState) => boolean;
}
