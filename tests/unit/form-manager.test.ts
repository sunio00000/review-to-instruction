/**
 * FormManager 단위 테스트
 *
 * 테스트 커버리지:
 * 1. load() - 암호화 필드 복호화, 일반 필드 로드, 복호화 실패 처리, 기본값 적용
 * 2. save() - 암호화 필드 암호화, 일반 필드 저장, 빈 값 제거, 검증 실패 방지
 * 3. validate() - 필수 필드 검증, 패턴 검증, 커스텀 검증
 * 4. updateVisibility() - 조건부 필드 표시/숨김
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FormManager } from '../../src/utils/form-manager';
import { CryptoService } from '../../src/background/services/crypto-service';
import type { FieldSchema } from '../../src/types/form-manager';

describe('FormManager', () => {
  let formManager: FormManager;
  let cryptoService: CryptoService;
  let mockFields: FieldSchema[];

  beforeEach(() => {
    // DOM 초기화
    document.body.innerHTML = `
      <div>
        <input id="test-text" type="text" />
        <input id="test-password" type="password" />
        <input id="test-checkbox" type="checkbox" />
        <select id="test-select">
          <option value="option1">Option 1</option>
          <option value="option2">Option 2</option>
        </select>
        <div class="form-group">
          <input id="conditional-field" type="text" />
        </div>
      </div>
    `;

    // Mock 필드 스키마
    mockFields = [
      {
        id: 'test-text',
        storageKey: 'testText',
        type: 'text',
        encrypted: false,
        defaultValue: 'default-text'
      },
      {
        id: 'test-password',
        storageKey: 'testPassword_enc',
        type: 'password',
        encrypted: true
      },
      {
        id: 'test-checkbox',
        storageKey: 'testCheckbox',
        type: 'checkbox',
        encrypted: false,
        defaultValue: true
      },
      {
        id: 'test-select',
        storageKey: 'testSelect',
        type: 'select',
        encrypted: false,
        defaultValue: 'option1'
      },
      {
        id: 'conditional-field',
        storageKey: 'conditionalField',
        type: 'text',
        encrypted: false,
        visible: (state) => state['test-checkbox'] === true
      }
    ];

    cryptoService = new CryptoService();
    formManager = new FormManager(mockFields, cryptoService);

    // Chrome storage API 모킹 초기화
    vi.mocked(chrome.storage.local.get).mockReset();
    vi.mocked(chrome.storage.local.set).mockReset();
    vi.mocked(chrome.storage.local.remove).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('필드 스키마가 비어있으면 에러를 발생시킨다', () => {
      expect(() => new FormManager([], cryptoService)).toThrow('[FormManager] 필드 스키마가 비어있습니다.');
    });

    it('CryptoService가 없으면 에러를 발생시킨다', () => {
      expect(() => new FormManager(mockFields, null as any)).toThrow('[FormManager] CryptoService 인스턴스가 필요합니다.');
    });

    it('정상적으로 인스턴스가 생성된다', () => {
      expect(formManager).toBeInstanceOf(FormManager);
    });
  });

  describe('bindElements()', () => {
    it('모든 필드의 DOM 요소를 바인딩한다', () => {
      formManager.bindElements();

      expect(formManager.getValue('test-text')).toBeDefined();
      expect(formManager.getValue('test-password')).toBeDefined();
      expect(formManager.getValue('test-checkbox')).toBeDefined();
      expect(formManager.getValue('test-select')).toBeDefined();
    });

    it('존재하지 않는 요소는 경고만 출력하고 계속 진행한다', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fieldsWithMissing: FieldSchema[] = [
        ...mockFields,
        {
          id: 'non-existent',
          storageKey: 'nonExistent',
          type: 'text',
          encrypted: false
        }
      ];

      const manager = new FormManager(fieldsWithMissing, cryptoService);
      manager.bindElements();

      expect(consoleWarnSpy).toHaveBeenCalledWith('[FormManager] Element not found: #non-existent');
      consoleWarnSpy.mockRestore();
    });
  });

  describe('load()', () => {
    beforeEach(() => {
      formManager.bindElements();
    });

    it('일반 필드를 스토리지에서 로드하여 DOM에 반영한다', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        testText: 'loaded-text',
        testCheckbox: false,
        testSelect: 'option2'
      });

      await formManager.load();

      expect((document.getElementById('test-text') as HTMLInputElement).value).toBe('loaded-text');
      expect((document.getElementById('test-checkbox') as HTMLInputElement).checked).toBe(false);
      expect((document.getElementById('test-select') as HTMLSelectElement).value).toBe('option2');
    });

    it('암호화된 필드를 복호화하여 DOM에 반영한다', async () => {
      const plainPassword = 'my-secret-password';
      const encryptedPassword = await cryptoService.encrypt(plainPassword);

      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        testPassword_enc: encryptedPassword
      });

      await formManager.load();

      expect((document.getElementById('test-password') as HTMLInputElement).value).toBe(plainPassword);
    });

    it('복호화 실패 시 빈 값으로 설정한다', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        testPassword_enc: 'invalid-encrypted-data'
      });

      await formManager.load();

      expect((document.getElementById('test-password') as HTMLInputElement).value).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FormManager] Decryption failed for test-password'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('값이 없으면 기본값을 적용한다', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValue({});

      await formManager.load();

      expect((document.getElementById('test-text') as HTMLInputElement).value).toBe('default-text');
      expect((document.getElementById('test-checkbox') as HTMLInputElement).checked).toBe(true);
      expect((document.getElementById('test-select') as HTMLSelectElement).value).toBe('option1');
    });

    it('null 값이면 기본값을 적용한다', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        testText: null,
        testCheckbox: null
      });

      await formManager.load();

      expect((document.getElementById('test-text') as HTMLInputElement).value).toBe('default-text');
      expect((document.getElementById('test-checkbox') as HTMLInputElement).checked).toBe(true);
    });

    it('로드 후 가시성을 업데이트한다', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        testCheckbox: false
      });

      await formManager.load();

      const conditionalElement = document.getElementById('conditional-field')?.closest('.form-group') as HTMLElement;
      expect(conditionalElement?.style.display).toBe('none');
    });
  });

  describe('save()', () => {
    beforeEach(() => {
      formManager.bindElements();
    });

    it('일반 필드를 스토리지에 저장한다', async () => {
      (document.getElementById('test-text') as HTMLInputElement).value = 'saved-text';
      (document.getElementById('test-checkbox') as HTMLInputElement).checked = false;
      (document.getElementById('test-select') as HTMLSelectElement).value = 'option2';

      vi.mocked(chrome.storage.local.set).mockResolvedValue();
      vi.mocked(chrome.storage.local.remove).mockResolvedValue();

      const result = await formManager.save();

      expect(result.isValid).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          testText: 'saved-text',
          testCheckbox: false,
          testSelect: 'option2'
        })
      );
    });

    it('암호화된 필드를 암호화하여 저장한다', async () => {
      const plainPassword = 'my-secret-password';
      (document.getElementById('test-password') as HTMLInputElement).value = plainPassword;

      vi.mocked(chrome.storage.local.set).mockResolvedValue();
      vi.mocked(chrome.storage.local.remove).mockResolvedValue();

      const result = await formManager.save();

      expect(result.isValid).toBe(true);

      const savedData = vi.mocked(chrome.storage.local.set).mock.calls[0][0];
      expect(savedData.testPassword_enc).toBeDefined();
      expect(savedData.testPassword_enc).not.toBe(plainPassword);

      // 저장된 암호화 값을 복호화하면 원본과 같아야 함
      const decrypted = await cryptoService.decrypt(savedData.testPassword_enc);
      expect(decrypted).toBe(plainPassword);
    });

    it('빈 텍스트 값은 스토리지에서 제거한다', async () => {
      (document.getElementById('test-text') as HTMLInputElement).value = '   '; // 공백만
      (document.getElementById('test-password') as HTMLInputElement).value = '';

      vi.mocked(chrome.storage.local.set).mockResolvedValue();
      vi.mocked(chrome.storage.local.remove).mockResolvedValue();

      await formManager.save();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith(
        expect.arrayContaining(['testText', 'testPassword_enc'])
      );
    });

    it('체크박스는 false여도 빈 값으로 간주하지 않는다', async () => {
      (document.getElementById('test-checkbox') as HTMLInputElement).checked = false;

      vi.mocked(chrome.storage.local.set).mockResolvedValue();
      vi.mocked(chrome.storage.local.remove).mockResolvedValue();

      await formManager.save();

      const savedData = vi.mocked(chrome.storage.local.set).mock.calls[0][0];
      expect(savedData.testCheckbox).toBe(false);

      const removedKeys = vi.mocked(chrome.storage.local.remove).mock.calls[0]?.[0] || [];
      expect(removedKeys).not.toContain('testCheckbox');
    });

    it('검증 실패 시 저장하지 않는다', async () => {
      const fieldsWithValidation: FieldSchema[] = [
        {
          id: 'test-text',
          storageKey: 'testText',
          type: 'text',
          encrypted: false,
          validation: {
            required: true,
            message: '필수 입력 항목입니다.'
          }
        }
      ];

      const manager = new FormManager(fieldsWithValidation, cryptoService);
      manager.bindElements();

      (document.getElementById('test-text') as HTMLInputElement).value = '';

      const result = await manager.save();

      expect(result.isValid).toBe(false);
      expect(result.errors.get('test-text')).toBe('필수 입력 항목입니다.');
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('암호화 실패 시 에러를 발생시킨다', async () => {
      const mockCrypto = {
        encrypt: vi.fn().mockRejectedValue(new Error('Encryption error')),
        decrypt: vi.fn()
      } as any;

      const manager = new FormManager(mockFields, mockCrypto);
      manager.bindElements();

      (document.getElementById('test-password') as HTMLInputElement).value = 'password';

      await expect(manager.save()).rejects.toThrow('test-password 암호화 중 오류가 발생했습니다.');
    });
  });

  describe('validate()', () => {
    beforeEach(() => {
      formManager.bindElements();
    });

    it('필수 필드가 비어있으면 검증 실패한다', () => {
      const fieldsWithRequired: FieldSchema[] = [
        {
          id: 'test-text',
          storageKey: 'testText',
          type: 'text',
          encrypted: false,
          validation: {
            required: true,
            message: '필수 항목입니다.'
          }
        }
      ];

      const manager = new FormManager(fieldsWithRequired, cryptoService);
      manager.bindElements();

      (document.getElementById('test-text') as HTMLInputElement).value = '';

      const result = manager.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors.get('test-text')).toBe('필수 항목입니다.');
    });

    it('필수 필드가 공백만 있으면 검증 실패한다', () => {
      const fieldsWithRequired: FieldSchema[] = [
        {
          id: 'test-text',
          storageKey: 'testText',
          type: 'text',
          encrypted: false,
          validation: {
            required: true
          }
        }
      ];

      const manager = new FormManager(fieldsWithRequired, cryptoService);
      manager.bindElements();

      (document.getElementById('test-text') as HTMLInputElement).value = '   ';

      const result = manager.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors.has('test-text')).toBe(true);
    });

    it('패턴 검증이 실패하면 에러를 반환한다', () => {
      const fieldsWithPattern: FieldSchema[] = [
        {
          id: 'test-text',
          storageKey: 'testText',
          type: 'text',
          encrypted: false,
          validation: {
            pattern: /^[A-Z]{3}$/,
            message: '대문자 3글자를 입력하세요.'
          }
        }
      ];

      const manager = new FormManager(fieldsWithPattern, cryptoService);
      manager.bindElements();

      (document.getElementById('test-text') as HTMLInputElement).value = 'abc';

      const result = manager.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors.get('test-text')).toBe('대문자 3글자를 입력하세요.');
    });

    it('패턴 검증이 성공하면 통과한다', () => {
      const fieldsWithPattern: FieldSchema[] = [
        {
          id: 'test-text',
          storageKey: 'testText',
          type: 'text',
          encrypted: false,
          validation: {
            pattern: /^[A-Z]{3}$/
          }
        }
      ];

      const manager = new FormManager(fieldsWithPattern, cryptoService);
      manager.bindElements();

      (document.getElementById('test-text') as HTMLInputElement).value = 'ABC';

      const result = manager.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors.size).toBe(0);
    });

    it('빈 값에는 패턴 검증을 수행하지 않는다', () => {
      const fieldsWithPattern: FieldSchema[] = [
        {
          id: 'test-text',
          storageKey: 'testText',
          type: 'text',
          encrypted: false,
          validation: {
            pattern: /^[A-Z]{3}$/,
            message: '대문자 3글자를 입력하세요.'
          }
        }
      ];

      const manager = new FormManager(fieldsWithPattern, cryptoService);
      manager.bindElements();

      (document.getElementById('test-text') as HTMLInputElement).value = '';

      const result = manager.validate();

      expect(result.isValid).toBe(true);
    });

    it('커스텀 검증 함수가 false를 반환하면 실패한다', () => {
      const fieldsWithCustom: FieldSchema[] = [
        {
          id: 'test-text',
          storageKey: 'testText',
          type: 'text',
          encrypted: false,
          validation: {
            custom: (value) => value === 'valid',
            message: '유효하지 않은 값입니다.'
          }
        }
      ];

      const manager = new FormManager(fieldsWithCustom, cryptoService);
      manager.bindElements();

      (document.getElementById('test-text') as HTMLInputElement).value = 'invalid';

      const result = manager.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors.get('test-text')).toBe('유효하지 않은 값입니다.');
    });

    it('커스텀 검증 함수가 에러 메시지를 반환하면 실패한다', () => {
      const fieldsWithCustom: FieldSchema[] = [
        {
          id: 'test-text',
          storageKey: 'testText',
          type: 'text',
          encrypted: false,
          validation: {
            custom: (value) => value.length >= 5 ? true : '최소 5글자 이상 입력하세요.'
          }
        }
      ];

      const manager = new FormManager(fieldsWithCustom, cryptoService);
      manager.bindElements();

      (document.getElementById('test-text') as HTMLInputElement).value = 'abc';

      const result = manager.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors.get('test-text')).toBe('최소 5글자 이상 입력하세요.');
    });

    it('커스텀 검증 함수가 true를 반환하면 성공한다', () => {
      const fieldsWithCustom: FieldSchema[] = [
        {
          id: 'test-text',
          storageKey: 'testText',
          type: 'text',
          encrypted: false,
          validation: {
            custom: (value) => value === 'valid'
          }
        }
      ];

      const manager = new FormManager(fieldsWithCustom, cryptoService);
      manager.bindElements();

      (document.getElementById('test-text') as HTMLInputElement).value = 'valid';

      const result = manager.validate();

      expect(result.isValid).toBe(true);
    });

    it('여러 필드 검증 실패 시 모든 에러를 수집한다', () => {
      const fieldsWithMultipleValidation: FieldSchema[] = [
        {
          id: 'test-text',
          storageKey: 'testText',
          type: 'text',
          encrypted: false,
          validation: {
            required: true,
            message: 'Text 필수'
          }
        },
        {
          id: 'test-password',
          storageKey: 'testPassword',
          type: 'password',
          encrypted: false,
          validation: {
            required: true,
            message: 'Password 필수'
          }
        }
      ];

      const manager = new FormManager(fieldsWithMultipleValidation, cryptoService);
      manager.bindElements();

      (document.getElementById('test-text') as HTMLInputElement).value = '';
      (document.getElementById('test-password') as HTMLInputElement).value = '';

      const result = manager.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors.size).toBe(2);
      expect(result.errors.get('test-text')).toBe('Text 필수');
      expect(result.errors.get('test-password')).toBe('Password 필수');
    });
  });

  describe('updateVisibility()', () => {
    beforeEach(() => {
      formManager.bindElements();
    });

    it('visible 함수가 true를 반환하면 필드를 표시한다', () => {
      (document.getElementById('test-checkbox') as HTMLInputElement).checked = true;

      formManager.updateVisibility();

      const conditionalElement = document.getElementById('conditional-field')?.closest('.form-group') as HTMLElement;
      expect(conditionalElement?.style.display).toBe('');
    });

    it('visible 함수가 false를 반환하면 필드를 숨긴다', () => {
      (document.getElementById('test-checkbox') as HTMLInputElement).checked = false;

      formManager.updateVisibility();

      const conditionalElement = document.getElementById('conditional-field')?.closest('.form-group') as HTMLElement;
      expect(conditionalElement?.style.display).toBe('none');
    });

    it('상태 변경 시 가시성이 업데이트된다', () => {
      const checkbox = document.getElementById('test-checkbox') as HTMLInputElement;
      const conditionalElement = document.getElementById('conditional-field')?.closest('.form-group') as HTMLElement;

      checkbox.checked = true;
      formManager.updateVisibility();
      expect(conditionalElement?.style.display).toBe('');

      checkbox.checked = false;
      formManager.updateVisibility();
      expect(conditionalElement?.style.display).toBe('none');
    });

    it('form-group이 없으면 요소 자체의 가시성을 조절한다', () => {
      // form-group 없는 요소 추가
      document.body.innerHTML += '<input id="standalone-field" type="text" />';

      const standaloneFields: FieldSchema[] = [
        {
          id: 'standalone-field',
          storageKey: 'standaloneField',
          type: 'text',
          encrypted: false,
          visible: () => false
        }
      ];

      const manager = new FormManager(standaloneFields, cryptoService);
      manager.bindElements();
      manager.updateVisibility();

      const standaloneElement = document.getElementById('standalone-field') as HTMLElement;
      expect(standaloneElement?.style.display).toBe('none');
    });
  });

  describe('getState()', () => {
    beforeEach(() => {
      formManager.bindElements();
    });

    it('모든 필드의 현재 상태를 반환한다', () => {
      (document.getElementById('test-text') as HTMLInputElement).value = 'text-value';
      (document.getElementById('test-checkbox') as HTMLInputElement).checked = true;
      (document.getElementById('test-select') as HTMLSelectElement).value = 'option2';

      const state = formManager.getState();

      expect(state['test-text']).toBe('text-value');
      expect(state['test-checkbox']).toBe(true);
      expect(state['test-select']).toBe('option2');
    });

    it('반환된 상태 객체는 독립적인 복사본이다', () => {
      const state1 = formManager.getState();
      state1['test-text'] = 'modified';

      const state2 = formManager.getState();

      expect(state2['test-text']).not.toBe('modified');
    });
  });

  describe('getValue() / setValue()', () => {
    beforeEach(() => {
      formManager.bindElements();
    });

    it('getValue()는 특정 필드의 값을 반환한다', () => {
      (document.getElementById('test-text') as HTMLInputElement).value = 'test-value';

      expect(formManager.getValue('test-text')).toBe('test-value');
    });

    it('setValue()는 특정 필드의 값을 설정한다', () => {
      formManager.setValue('test-text', 'new-value');

      expect((document.getElementById('test-text') as HTMLInputElement).value).toBe('new-value');
    });

    it('setValue() 후 가시성이 업데이트된다', () => {
      formManager.setValue('test-checkbox', false);

      const conditionalElement = document.getElementById('conditional-field')?.closest('.form-group') as HTMLElement;
      expect(conditionalElement?.style.display).toBe('none');
    });

    it('존재하지 않는 필드에 getValue()를 호출하면 undefined를 반환한다', () => {
      expect(formManager.getValue('non-existent')).toBeUndefined();
    });

    it('존재하지 않는 필드에 setValue()를 호출하면 경고를 출력한다', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      formManager.setValue('non-existent', 'value');

      expect(consoleWarnSpy).toHaveBeenCalledWith('[FormManager] Element not found for setValue: non-existent');
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      formManager.bindElements();
    });

    it('trim()이 적용된 값을 저장한다', async () => {
      (document.getElementById('test-text') as HTMLInputElement).value = '  trimmed  ';

      vi.mocked(chrome.storage.local.set).mockResolvedValue();
      vi.mocked(chrome.storage.local.remove).mockResolvedValue();

      await formManager.save();

      const savedData = vi.mocked(chrome.storage.local.set).mock.calls[0][0];
      expect(savedData.testText).toBe('trimmed');
    });

    it('undefined/null 값을 빈 문자열로 처리한다', () => {
      formManager.setValue('test-text', undefined);
      expect((document.getElementById('test-text') as HTMLInputElement).value).toBe('');

      formManager.setValue('test-text', null);
      expect((document.getElementById('test-text') as HTMLInputElement).value).toBe('');
    });

    it('체크박스에 truthy/falsy 값을 설정한다', () => {
      formManager.setValue('test-checkbox', 'any-string');
      expect((document.getElementById('test-checkbox') as HTMLInputElement).checked).toBe(true);

      formManager.setValue('test-checkbox', 0);
      expect((document.getElementById('test-checkbox') as HTMLInputElement).checked).toBe(false);
    });

    it('select 요소에 null을 설정하면 빈 문자열이 된다', () => {
      formManager.setValue('test-select', null);
      expect((document.getElementById('test-select') as HTMLSelectElement).value).toBe('');
    });

    it('여러 필드를 동시에 저장하고 제거한다', async () => {
      (document.getElementById('test-text') as HTMLInputElement).value = 'saved';
      (document.getElementById('test-password') as HTMLInputElement).value = ''; // 제거될 필드

      vi.mocked(chrome.storage.local.set).mockResolvedValue();
      vi.mocked(chrome.storage.local.remove).mockResolvedValue();

      await formManager.save();

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.remove).toHaveBeenCalledTimes(1);
    });
  });
});
