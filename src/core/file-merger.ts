/**
 * FileMerger - 중복 파일 감지 및 병합
 * 같은 경로의 파일들을 하나로 병합합니다
 */

import type { FileGenerationResult } from '../types';

export class FileMerger {
  /**
   * 중복 파일 경로 감지
   * @returns Map<filePath, FileGenerationResult[]>
   */
  detectDuplicates(files: FileGenerationResult[]): Map<string, FileGenerationResult[]> {
    const pathMap = new Map<string, FileGenerationResult[]>();

    for (const file of files) {
      const existing = pathMap.get(file.filePath) || [];
      existing.push(file);
      pathMap.set(file.filePath, existing);
    }

    // 2개 이상인 것만 반환
    const duplicates = new Map<string, FileGenerationResult[]>();
    for (const [path, fileList] of pathMap.entries()) {
      if (fileList.length > 1) {
        duplicates.set(path, fileList);
      }
    }

    return duplicates;
  }

  /**
   * 파일 병합
   * 중복 파일을 감지하고 병합합니다
   */
  mergeFiles(files: FileGenerationResult[]): FileGenerationResult[] {
    // 1. 중복 감지
    const duplicates = this.detectDuplicates(files);

    if (duplicates.size === 0) {
      return files;
    }

    // 2. 병합 결과 저장
    const result: FileGenerationResult[] = [];
    const processedPaths = new Set<string>();

    for (const file of files) {
      if (processedPaths.has(file.filePath)) {
        continue;
      }

      const duplicateFiles = duplicates.get(file.filePath);

      if (duplicateFiles) {
        // 중복 파일들을 병합
        const merged = this.mergeFileGroup(duplicateFiles);
        result.push(merged);
        processedPaths.add(file.filePath);
      } else {
        // 중복 아니면 그대로 추가
        result.push(file);
        processedPaths.add(file.filePath);
      }
    }

    return result;
  }

  /**
   * 같은 경로의 파일들을 하나로 병합
   */
  private mergeFileGroup(files: FileGenerationResult[]): FileGenerationResult {
    if (files.length === 0) {
      throw new Error('Cannot merge empty file group');
    }

    if (files.length === 1) {
      return files[0];
    }

    // 첫 번째 파일을 기준으로
    const first = files[0];

    // 모든 파일의 내용 병합
    const contents = files.map(f => f.content);
    const mergedContent = this.mergeMarkdownContent(contents);

    // isUpdate: 하나라도 true면 true
    const isUpdate = files.some(f => f.isUpdate);

    return {
      projectType: first.projectType,
      filePath: first.filePath,
      content: mergedContent,
      isUpdate
    };
  }

  /**
   * Markdown 내용 병합
   * - 제목은 첫 번째 파일의 것 사용
   * - 본문 섹션들을 모두 합침
   * - 중복 섹션은 내용을 병합
   */
  mergeMarkdownContent(contents: string[]): string {
    if (contents.length === 0) {
      return '';
    }

    if (contents.length === 1) {
      return contents[0];
    }

    // 빈 내용 제거
    const validContents = contents.filter(c => c && c.trim());

    if (validContents.length === 0) {
      return '';
    }

    if (validContents.length === 1) {
      return validContents[0];
    }

    // 1. 첫 번째 파일에서 제목 추출
    const firstContent = validContents[0];
    const lines = firstContent.split('\n');

    let title = '';

    // H1 제목 찾기
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('# ')) {
        title = lines[i];
        break;
      }
    }

    // 2. 모든 파일에서 섹션 추출 및 병합
    const sections = new Map<string, string[]>();

    for (const content of validContents) {
      const contentSections = this.extractSections(content);

      for (const [sectionTitle, sectionContent] of contentSections.entries()) {
        const existing = sections.get(sectionTitle) || [];
        existing.push(sectionContent);
        sections.set(sectionTitle, existing);
      }
    }

    // 3. 병합된 내용 생성
    const mergedLines: string[] = [];

    // 제목 추가
    if (title) {
      mergedLines.push(title);
      mergedLines.push('');
    }

    // 섹션들 추가
    for (const [sectionTitle, sectionContents] of sections.entries()) {
      mergedLines.push(`## ${sectionTitle}`);
      mergedLines.push('');

      // 섹션 내용 병합
      for (const sectionContent of sectionContents) {
        mergedLines.push(sectionContent.trim());
        mergedLines.push('');
      }
    }

    return mergedLines.join('\n').trim();
  }

  /**
   * Markdown에서 섹션(H2) 추출
   * @returns Map<섹션제목, 섹션내용>
   */
  private extractSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const lines = content.split('\n');

    let currentSection: string | null = null;
    let currentContent: string[] = [];
    let inH1 = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // H1은 건너뛰기
      if (line.startsWith('# ')) {
        inH1 = true;

        // 이전 섹션 저장
        if (currentSection !== null && currentContent.length > 0) {
          sections.set(currentSection, currentContent.join('\n'));
          currentContent = [];
        }

        continue;
      }

      // H1 직후의 빈 줄도 건너뛰기
      if (inH1 && line.trim() === '') {
        inH1 = false;
        continue;
      }

      // H2 섹션 시작
      if (line.startsWith('## ')) {
        // 이전 섹션 저장
        if (currentSection !== null && currentContent.length > 0) {
          sections.set(currentSection, currentContent.join('\n'));
        }

        // 새 섹션 시작
        currentSection = line.substring(3).trim();
        currentContent = [];
        inH1 = false;
        continue;
      }

      // 섹션 내용 추가
      if (currentSection !== null) {
        currentContent.push(line);
      }
    }

    // 마지막 섹션 저장
    if (currentSection !== null && currentContent.length > 0) {
      sections.set(currentSection, currentContent.join('\n'));
    }

    return sections;
  }
}
