/**
 * Icon Manager Service
 * 익스텐션 아이콘 상태 관리
 */

export type IconState = 'active' | 'locked' | 'off';

// Chrome API 호환 타입 (index signature 필요)
type IconPaths = Record<number, string>;

/**
 * 아이콘 상태 관리자
 */
export class IconManager {
  private currentState: IconState | null = null; // 초기값 null로 설정

  private readonly iconPaths: Record<IconState, IconPaths> = {
    active: {
      16: 'icons/active/active_16.png',
      32: 'icons/active/active_32.png',
      48: 'icons/active/active_48.png',
      128: 'icons/active/active_128.png'
    },
    locked: {
      16: 'icons/locked/locked_16.png',
      32: 'icons/locked/locked_32.png',
      48: 'icons/locked/locked_48.png',
      128: 'icons/locked/locked_128.png'
    },
    off: {
      16: 'icons/off/off_16.png',
      32: 'icons/off/off_32.png',
      48: 'icons/off/off_48.png',
      128: 'icons/off/off_128.png'
    }
  };

  /**
   * 아이콘 상태 설정
   */
  async setIconState(state: IconState, force: boolean = false): Promise<void> {
    console.log(`[IconManager] Attempting to change icon state from ${this.currentState} to ${state} (force: ${force})`);

    // force가 true이거나, 상태가 다를 때만 업데이트
    if (!force && this.currentState === state) {
      console.log(`[IconManager] Icon state already ${state}, skipping update`);
      return;
    }

    this.currentState = state;
    const paths = this.iconPaths[state];

    try {
      await chrome.action.setIcon({ path: paths });
      console.log(`[IconManager] Icon state successfully changed to: ${state}`);
    } catch (error) {
      console.error('[IconManager] Failed to set icon:', error);
    }
  }

  /**
   * 현재 아이콘 상태 가져오기
   */
  getCurrentState(): IconState | null {
    return this.currentState;
  }

  /**
   * 마스터 비밀번호 상태에 따라 아이콘 업데이트
   */
  async updateIconByPasswordState(hasPassword: boolean, isUnlocked: boolean): Promise<void> {
    if (!hasPassword) {
      // 마스터 비밀번호 미설정
      await this.setIconState('off');
    } else if (isUnlocked) {
      // 잠금 해제됨
      await this.setIconState('active');
    } else {
      // 잠금 상태
      await this.setIconState('locked');
    }
  }
}

// 전역 인스턴스
export const iconManager = new IconManager();
