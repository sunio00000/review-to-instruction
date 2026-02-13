/**
 * PreviewModal - Instruction Preview Modal (Phase 1: Transparency Enhancement)
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
 * Instruction Preview Modal Class
 */
export class PreviewModal {
  private modalElement: HTMLElement | null = null;
  private resolveAction: ((action: ModalAction) => void) | null = null;
  private isEditing = false;
  private originalContent = '';
  private onEditCallback: ((editedContent: string) => void) | null = null;

  /**
   * Show modal and wait for user action
   */
  async show(options: PreviewModalOptions): Promise<ModalAction> {
    this.cleanup(); // Remove existing modal
    this.onEditCallback = options.onEdit ?? null;

    return new Promise((resolve) => {
      this.resolveAction = resolve;
      this.createModal(options);
      document.body.appendChild(this.modalElement!);

      // Close with ESC key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (this.isEditing) {
            this.exitEditMode();
          } else {
            document.removeEventListener('keydown', handleEscape);
            this.handleAction('cancel');
          }
        }
      };
      document.addEventListener('keydown', handleEscape);
    });
  }

  /**
   * Create modal DOM
   */
  private createModal(options: PreviewModalOptions): void {
    const { result, warnings } = options;
    this.originalContent = result.content;

    // Modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'review-to-instruction-modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (this.isEditing) {
          this.exitEditMode();
        } else {
          this.handleAction('cancel');
        }
      }
    });

    // Modal container
    const modal = document.createElement('div');
    modal.className = 'review-to-instruction-modal';

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `
      <h2>🔍 Instruction Preview</h2>
      <button type="button" class="modal-close" title="Close">✕</button>
    `;
    header.querySelector('.modal-close')?.addEventListener('click', () => {
      if (this.isEditing) {
        this.exitEditMode();
      } else {
        this.handleAction('cancel');
      }
    });

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';

    // Instruction content
    const contentSection = this.createContentSection(result.content);
    body.appendChild(contentSection);

    // Validation warnings/suggestions (if any)
    if (warnings && warnings.length > 0) {
      const warningsSection = this.createWarningsSection(warnings);
      body.appendChild(warningsSection);
    }

    // Analysis reasoning
    const reasoningSection = this.createReasoningSection(result.reasoning);
    body.appendChild(reasoningSection);

    // Referenced comments
    const sourcesSection = this.createSourcesSection(result.sources);
    body.appendChild(sourcesSection);

    // Footer (buttons)
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const hasErrors = warnings?.some(w => w.type === 'error');

    footer.innerHTML = `
      <button type="button" class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
      <button type="button" class="modal-btn modal-btn-primary" data-action="edit">Edit</button>
      <button type="button" class="modal-btn modal-btn-success" data-action="confirm" ${hasErrors ? 'disabled' : ''}>
        Confirm and Create
      </button>
    `;

    // Edit 버튼은 enterEditMode 호출, 나머지는 기존 handleAction
    footer.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action as ModalAction;
        if (action === 'edit') {
          this.enterEditMode();
        } else {
          this.handleAction(action);
        }
      });
    });

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    this.modalElement = overlay;
  }

  /**
   * Instruction content section
   */
  private createContentSection(content: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'modal-section';

    const title = document.createElement('h3');
    title.textContent = 'Generated Instruction';

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
   * Validation warnings/suggestions section
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
   * Analysis reasoning section
   */
  private createReasoningSection(reasoning: ReasoningInfo): HTMLElement {
    const section = document.createElement('div');
    section.className = 'modal-section reasoning-section';

    const title = document.createElement('h3');
    title.textContent = '📊 Analysis Reasoning';

    const content = document.createElement('div');
    content.className = 'reasoning-content';

    // Detected intent
    if (reasoning.detectedIntent.length > 0) {
      content.innerHTML += `
        <div class="reasoning-item">
          <strong>Intent:</strong> ${reasoning.detectedIntent.map(i => this.escapeHtml(i)).join(', ')}
        </div>
      `;
    }

    // Key phrases
    if (reasoning.keyPhrases.length > 0) {
      content.innerHTML += `
        <div class="reasoning-item">
          <strong>Key Phrases:</strong> "${reasoning.keyPhrases.map(p => this.escapeHtml(p)).join('", "')}"
        </div>
      `;
    }

    // Code references
    if (reasoning.codeReferences.length > 0) {
      content.innerHTML += `
        <div class="reasoning-item">
          <strong>Code References:</strong> <code>${reasoning.codeReferences.map(r => this.escapeHtml(r)).join('</code>, <code>')}</code>
        </div>
      `;
    }

    // Confidence score
    const confidenceLevel = this.getConfidenceLevel(reasoning.confidenceScore);
    const confidenceColor = this.getConfidenceColor(reasoning.confidenceScore);
    content.innerHTML += `
      <div class="reasoning-item">
        <strong>Confidence:</strong>
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
   * Referenced comments section
   */
  private createSourcesSection(sources: CommentSource[]): HTMLElement {
    const section = document.createElement('div');
    section.className = 'modal-section sources-section';

    const title = document.createElement('h3');
    title.textContent = '📝 Referenced Comments';

    const content = document.createElement('div');
    content.className = 'sources-content';

    if (sources.length === 0) {
      content.innerHTML = '<p class="no-sources">No referenced comments.</p>';
    } else {
      sources.forEach((source, index) => {
        const weightPercent = Math.round(source.weight * 100);
        const sourceEl = document.createElement('div');
        sourceEl.className = 'source-item';
        sourceEl.innerHTML = `
          <div class="source-header">
            <strong>${index + 1}. @${this.escapeHtml(source.author)}</strong>
            <span class="source-weight">Weight: ${weightPercent}%</span>
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
   * Edit 모드 진입: <pre><code>를 <textarea>로 교체, footer 버튼 변경
   */
  private enterEditMode(): void {
    if (this.isEditing || !this.modalElement) return;
    this.isEditing = true;

    const contentBox = this.modalElement.querySelector('.instruction-content');
    if (!contentBox) return;

    // 현재 content 추출
    const codeEl = contentBox.querySelector('code');
    const currentContent = codeEl?.textContent ?? this.originalContent;

    // <pre><code>를 <textarea>로 교체
    contentBox.classList.add('editing');
    contentBox.innerHTML = '';

    const textarea = document.createElement('textarea');
    textarea.className = 'instruction-edit-textarea';
    textarea.value = currentContent;
    textarea.spellcheck = false;
    contentBox.appendChild(textarea);

    // textarea에 자동 포커스
    textarea.focus();

    // Footer 버튼을 Save + Cancel Edit로 변경
    this.updateFooterForEditMode();
  }

  /**
   * Edit 모드 종료: <textarea>를 <pre><code>로 복원, footer 원래대로
   */
  private exitEditMode(): void {
    if (!this.isEditing || !this.modalElement) return;
    this.isEditing = false;

    const contentBox = this.modalElement.querySelector('.instruction-content');
    if (!contentBox) return;

    // <textarea>를 <pre><code>로 복원
    contentBox.classList.remove('editing');
    contentBox.innerHTML = '';

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = this.originalContent;
    pre.appendChild(code);
    contentBox.appendChild(pre);

    // Footer 원래대로 복원
    this.updateFooterForPreviewMode();
  }

  /**
   * Edit 모드에서 Save: 수정된 내용을 콜백으로 전달 후 'edit' 액션으로 종료
   */
  private saveEdit(): void {
    if (!this.modalElement) return;

    const textarea = this.modalElement.querySelector('.instruction-edit-textarea') as HTMLTextAreaElement | null;
    const editedContent = textarea?.value ?? this.originalContent;

    if (this.onEditCallback) {
      this.onEditCallback(editedContent);
    }

    this.isEditing = false;
    this.handleAction('edit');
  }

  /**
   * Footer를 Edit 모드용 버튼으로 변경 (Cancel Edit + Save)
   */
  private updateFooterForEditMode(): void {
    const footer = this.modalElement?.querySelector('.modal-footer');
    if (!footer) return;

    footer.innerHTML = `
      <button type="button" class="modal-btn modal-btn-secondary" data-edit-action="cancel-edit">Cancel Edit</button>
      <button type="button" class="modal-btn modal-btn-success" data-edit-action="save">Save</button>
    `;

    footer.querySelector('[data-edit-action="cancel-edit"]')?.addEventListener('click', () => {
      this.exitEditMode();
    });

    footer.querySelector('[data-edit-action="save"]')?.addEventListener('click', () => {
      this.saveEdit();
    });
  }

  /**
   * Footer를 Preview 모드용 버튼으로 복원 (Cancel + Edit + Confirm and Create)
   */
  private updateFooterForPreviewMode(): void {
    const footer = this.modalElement?.querySelector('.modal-footer');
    if (!footer) return;

    footer.innerHTML = `
      <button type="button" class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
      <button type="button" class="modal-btn modal-btn-primary" data-action="edit">Edit</button>
      <button type="button" class="modal-btn modal-btn-success" data-action="confirm">
        Confirm and Create
      </button>
    `;

    footer.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action as ModalAction;
        if (action === 'edit') {
          this.enterEditMode();
        } else {
          this.handleAction(action);
        }
      });
    });
  }

  /**
   * Handle action
   */
  private handleAction(action: ModalAction): void {
    if (this.resolveAction) {
      this.resolveAction(action);
      this.resolveAction = null;
    }
    this.cleanup();
  }

  /**
   * Remove modal
   */
  private cleanup(): void {
    if (this.modalElement && this.modalElement.parentNode) {
      this.modalElement.parentNode.removeChild(this.modalElement);
    }
    this.modalElement = null;
  }

  /**
   * HTML escape
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Confidence level text
   */
  private getConfidenceLevel(score: number): string {
    if (score >= 90) return 'Very High';
    if (score >= 75) return 'High';
    if (score >= 60) return 'Medium';
    if (score >= 40) return 'Low';
    return 'Very Low';
  }

  /**
   * Confidence color
   */
  private getConfidenceColor(score: number): string {
    if (score >= 75) return '#2da44e';  // Green
    if (score >= 50) return '#fb8500';  // Orange
    return '#cf222e';  // Red
  }
}
