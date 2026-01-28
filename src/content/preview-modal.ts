/**
 * PreviewModal - Instruction 미리보기 모달 (Phase 1: 투명성 강화)
 */

import type { InstructionResult, ReasoningInfo, CommentSource } from '../background/llm/types';

export type ModalAction = 'confirm' | 'edit' | 'cancel';

export interface ValidationWarning {
  type: 'warning' | 'error';
  message: string;
}

export interface PreviewModalOptions {
  result: InstructionResult;
  warnings?: ValidationWarning[];
  onEdit?: (editedContent: string) => void;
}

/**
 * Instruction 미리보기 모달 클래스
 */
export class PreviewModal {
  private modalElement: HTMLElement | null = null;
  private resolveAction: ((action: ModalAction) => void) | null = null;

  /**
   * 모달을 표시하고 사용자 액션을 기다림
   */
  async show(options: PreviewModalOptions): Promise<ModalAction> {
    this.cleanup(); // 기존 모달 제거

    return new Promise((resolve) => {
      this.resolveAction = resolve;
      this.createModal(options);
      document.body.appendChild(this.modalElement!);

      // ESC 키로 닫기
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', handleEscape);
          this.handleAction('cancel');
        }
      };
      document.addEventListener('keydown', handleEscape);
    });
  }

  /**
   * 모달 DOM 생성
   */
  private createModal(options: PreviewModalOptions): void {
    const { result, warnings } = options;

    // 모달 오버레이
    const overlay = document.createElement('div');
    overlay.className = 'review-to-instruction-modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.handleAction('cancel');
      }
    });

    // 모달 컨테이너
    const modal = document.createElement('div');
    modal.className = 'review-to-instruction-modal';

    // 헤더
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `
      <h2>🔍 Instruction 미리보기</h2>
      <button type="button" class="modal-close" title="닫기">✕</button>
    `;
    header.querySelector('.modal-close')?.addEventListener('click', () => {
      this.handleAction('cancel');
    });

    // 본문
    const body = document.createElement('div');
    body.className = 'modal-body';

    // Instruction 내용
    const contentSection = this.createContentSection(result.content);
    body.appendChild(contentSection);

    // 검증 경고/제안 (있는 경우)
    if (warnings && warnings.length > 0) {
      const warningsSection = this.createWarningsSection(warnings);
      body.appendChild(warningsSection);
    }

    // 분석 근거
    const reasoningSection = this.createReasoningSection(result.reasoning);
    body.appendChild(reasoningSection);

    // 참조 코멘트
    const sourcesSection = this.createSourcesSection(result.sources);
    body.appendChild(sourcesSection);

    // 푸터 (버튼)
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const hasErrors = warnings?.some(w => w.type === 'error');

    footer.innerHTML = `
      <button type="button" class="modal-btn modal-btn-secondary" data-action="cancel">취소</button>
      <button type="button" class="modal-btn modal-btn-primary" data-action="edit">수정</button>
      <button type="button" class="modal-btn modal-btn-success" data-action="confirm" ${hasErrors ? 'disabled' : ''}>
        확인 및 생성
      </button>
    `;

    footer.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action as ModalAction;
        this.handleAction(action);
      });
    });

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    this.modalElement = overlay;
  }

  /**
   * Instruction 내용 섹션
   */
  private createContentSection(content: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'modal-section';

    const title = document.createElement('h3');
    title.textContent = '생성된 Instruction';

    const contentBox = document.createElement('div');
    contentBox.className = 'instruction-content';

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = content;
    pre.appendChild(code);
    contentBox.appendChild(pre);

    section.appendChild(title);
    section.appendChild(contentBox);

    return section;
  }

  /**
   * 검증 경고/제안 섹션
   */
  private createWarningsSection(warnings: ValidationWarning[]): HTMLElement {
    const section = document.createElement('div');
    section.className = 'modal-section validation-section';

    warnings.forEach(warning => {
      const warningEl = document.createElement('div');
      warningEl.className = `validation-message validation-${warning.type}`;

      const icon = warning.type === 'error' ? '⛔' : '⚠️';
      warningEl.innerHTML = `
        <span class="validation-icon">${icon}</span>
        <span class="validation-text">${this.escapeHtml(warning.message)}</span>
      `;

      section.appendChild(warningEl);
    });

    return section;
  }

  /**
   * 분석 근거 섹션
   */
  private createReasoningSection(reasoning: ReasoningInfo): HTMLElement {
    const section = document.createElement('div');
    section.className = 'modal-section reasoning-section';

    const title = document.createElement('h3');
    title.textContent = '📊 분석 근거';

    const content = document.createElement('div');
    content.className = 'reasoning-content';

    // 감지된 의도
    if (reasoning.detectedIntent.length > 0) {
      content.innerHTML += `
        <div class="reasoning-item">
          <strong>의도:</strong> ${reasoning.detectedIntent.map(i => this.escapeHtml(i)).join(', ')}
        </div>
      `;
    }

    // 핵심 문구
    if (reasoning.keyPhrases.length > 0) {
      content.innerHTML += `
        <div class="reasoning-item">
          <strong>핵심 문구:</strong> "${reasoning.keyPhrases.map(p => this.escapeHtml(p)).join('", "')}"
        </div>
      `;
    }

    // 코드 참조
    if (reasoning.codeReferences.length > 0) {
      content.innerHTML += `
        <div class="reasoning-item">
          <strong>코드 참조:</strong> <code>${reasoning.codeReferences.map(r => this.escapeHtml(r)).join('</code>, <code>')}</code>
        </div>
      `;
    }

    // 신뢰도
    const confidenceLevel = this.getConfidenceLevel(reasoning.confidenceScore);
    const confidenceColor = this.getConfidenceColor(reasoning.confidenceScore);
    content.innerHTML += `
      <div class="reasoning-item">
        <strong>신뢰도:</strong>
        <span class="confidence-badge" style="background-color: ${confidenceColor}">
          ${reasoning.confidenceScore}% (${confidenceLevel})
        </span>
      </div>
    `;

    section.appendChild(title);
    section.appendChild(content);

    return section;
  }

  /**
   * 참조 코멘트 섹션
   */
  private createSourcesSection(sources: CommentSource[]): HTMLElement {
    const section = document.createElement('div');
    section.className = 'modal-section sources-section';

    const title = document.createElement('h3');
    title.textContent = '📝 참조한 코멘트';

    const content = document.createElement('div');
    content.className = 'sources-content';

    if (sources.length === 0) {
      content.innerHTML = '<p class="no-sources">참조한 코멘트가 없습니다.</p>';
    } else {
      sources.forEach((source, index) => {
        const weightPercent = Math.round(source.weight * 100);
        const sourceEl = document.createElement('div');
        sourceEl.className = 'source-item';
        sourceEl.innerHTML = `
          <div class="source-header">
            <strong>${index + 1}. @${this.escapeHtml(source.author)}</strong>
            <span class="source-weight">영향력: ${weightPercent}%</span>
          </div>
          <div class="source-excerpt">
            ${this.escapeHtml(source.excerpt)}
          </div>
        `;
        content.appendChild(sourceEl);
      });
    }

    section.appendChild(title);
    section.appendChild(content);

    return section;
  }

  /**
   * 액션 처리
   */
  private handleAction(action: ModalAction): void {
    if (this.resolveAction) {
      this.resolveAction(action);
      this.resolveAction = null;
    }
    this.cleanup();
  }

  /**
   * 모달 제거
   */
  private cleanup(): void {
    if (this.modalElement && this.modalElement.parentNode) {
      this.modalElement.parentNode.removeChild(this.modalElement);
    }
    this.modalElement = null;
  }

  /**
   * HTML 이스케이프
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 신뢰도 레벨 텍스트
   */
  private getConfidenceLevel(score: number): string {
    if (score >= 90) return '매우 높음';
    if (score >= 75) return '높음';
    if (score >= 60) return '보통';
    if (score >= 40) return '낮음';
    return '매우 낮음';
  }

  /**
   * 신뢰도 색상
   */
  private getConfidenceColor(score: number): string {
    if (score >= 75) return '#2da44e';  // 녹색
    if (score >= 50) return '#fb8500';  // 주황색
    return '#cf222e';  // 빨강색
  }
}
