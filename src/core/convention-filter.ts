/**
 * ConventionFilter - 컨벤션 코멘트 필터링
 * Wrapup 시 컨벤션이 아닌 코멘트를 제외합니다
 */

import type { Comment } from '../types';

export class ConventionFilter {
  // 컨벤션 키워드 (영문, 한글)
  private readonly conventionKeywords = [
    'should', 'must', 'always', 'never', 'avoid', 'prefer', 'recommend',
    'best practice', 'convention', 'pattern', 'standard',
    '해야', '말아야', '권장', '지양', '패턴', '컨벤션', '규칙'
  ];

  // 감사 인사 키워드
  private readonly thanksKeywords = [
    'thanks', 'thank you', 'lgtm', 'looks good', 'nice work', 'great job',
    'well done', 'perfect', 'awesome', 'excellent',
    '감사', '고마', '좋아', '잘했', '굿'
  ];

  // 일회성 지적 키워드
  private readonly oneTimeKeywords = [
    'typo', 'fix', 'remove', 'delete', 'here', 'this line',
    'indentation', 'formatting', 'console.log',
    '오타', '수정', '삭제', '여기', '이 줄'
  ];

  /**
   * 컨벤션 코멘트인지 판별
   */
  isConventionComment(comment: Comment): boolean {
    const content = comment.content.trim();
    const contentLower = content.toLowerCase();

    // 1. 너무 짧은 코멘트 제외 (20자 이하)
    if (content.length < 20) {
      return false;
    }

    // 2. 이모지만 있는 코멘트 제외
    if (this.isOnlyEmojis(content)) {
      return false;
    }

    // 3. 감사 인사 제외
    if (this.isThanksComment(contentLower)) {
      return false;
    }

    // 4. 단순 질문 제외 (짧고 ?로 끝나는 경우)
    if (this.isSimpleQuestion(content)) {
      return false;
    }

    // 5. 일회성 지적 제외
    if (this.isOneTimeComment(contentLower)) {
      return false;
    }

    // 6. 불확실성 표현이 있으면 제외 (컨벤션이 아님)
    if (this.hasUncertainty(contentLower)) {
      return false;
    }

    // 7. 컨벤션 키워드가 있으면 포함
    if (this.hasConventionKeyword(contentLower)) {
      return true;
    }

    // 8. 코드 예시가 있으면 포함
    if (this.hasCodeExample(content)) {
      return true;
    }

    // 9. 50자 이상이고 일반적인 규칙/패턴을 설명하면 포함
    if (content.length >= 50 && this.isGeneralPattern(content)) {
      return true;
    }

    // 기본: 제외
    return false;
  }

  /**
   * 여러 코멘트 중 컨벤션만 필터링
   */
  filterConventionComments(comments: Comment[]): Comment[] {
    return comments.filter(comment => this.isConventionComment(comment));
  }

  /**
   * 이모지만 있는지 확인
   */
  private isOnlyEmojis(content: string): boolean {
    // 이모지와 공백만 있는지 확인
    const withoutEmojis = content.replace(/[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Presentation}]/gu, '').replace(/\s/g, '');
    return withoutEmojis.length === 0;
  }

  /**
   * 감사 인사인지 확인
   */
  private isThanksComment(contentLower: string): boolean {
    return this.thanksKeywords.some(keyword => contentLower.includes(keyword));
  }

  /**
   * 단순 질문인지 확인
   */
  private isSimpleQuestion(content: string): boolean {
    // 50자 이하이고 ?로 끝나는 경우
    return content.length < 50 && content.trim().endsWith('?');
  }

  /**
   * 일회성 지적인지 확인
   */
  private isOneTimeComment(contentLower: string): boolean {
    // 일회성 키워드가 2개 이상 포함되면 일회성 지적으로 판단
    const matchCount = this.oneTimeKeywords.filter(keyword =>
      contentLower.includes(keyword)
    ).length;

    return matchCount >= 2;
  }

  /**
   * 컨벤션 키워드가 있는지 확인
   */
  private hasConventionKeyword(contentLower: string): boolean {
    return this.conventionKeywords.some(keyword => contentLower.includes(keyword));
  }

  /**
   * 코드 예시가 있는지 확인
   */
  private hasCodeExample(content: string): boolean {
    // 코드 블록 (```) 또는 인라인 코드 (`)가 있는지 확인
    return content.includes('```') || /`[^`]+`/.test(content);
  }

  /**
   * 불확실성 표현이 있는지 확인
   */
  private hasUncertainty(contentLower: string): boolean {
    const uncertaintyKeywords = [
      'i think', 'maybe', 'perhaps', 'not sure', 'hmm',
      'what do you think', 'should we', 'could we',
      '생각', '아마', '혹시', '확실'
    ];

    return uncertaintyKeywords.some(keyword => contentLower.includes(keyword));
  }

  /**
   * 일반적인 규칙/패턴을 설명하는지 확인
   */
  private isGeneralPattern(content: string): boolean {
    const contentLower = content.toLowerCase();

    // 일반화 키워드 체크
    const generalizationKeywords = [
      'when', 'if', 'always', 'all', 'any', 'every', 'each',
      'generally', 'typically', 'usually', 'should',
      '할 때', '경우', '모든', '항상', '일반적'
    ];

    return generalizationKeywords.some(keyword => contentLower.includes(keyword));
  }
}
