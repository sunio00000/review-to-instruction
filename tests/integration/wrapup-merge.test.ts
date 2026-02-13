/**
 * Wrapup 파일 병합 통합 테스트
 * 같은 주제의 여러 코멘트가 하나의 파일로 병합되는지 검증
 */

import { describe, it, expect, vi } from 'vitest';
import { PullRequestServiceImpl } from '../../src/background/services/pr-service';
import type { Repository, EnhancedComment, Comment, FileGenerationResult } from '../../src/types';
import type { ApiClient } from '../../src/background/api-client';

describe('Wrapup 파일 병합 통합 테스트', () => {
  it('같은 경로의 파일들이 하나로 병합되어야 함', async () => {
    // Mock API Client
    const mockApiClient = {
      createBranch: vi.fn().mockResolvedValue(true),
      createOrUpdateFile: vi.fn().mockResolvedValue(true),
      createOrUpdateMultipleFiles: vi.fn().mockResolvedValue(true),
      createPullRequest: vi.fn().mockResolvedValue({
        success: true,
        url: 'https://github.com/test/repo/pull/123'
      }),
      findPullRequestByBranch: vi.fn().mockResolvedValue(null)
    } as unknown as ApiClient;

    // Mock Repository
    const mockRepository: Repository = {
      owner: 'test',
      name: 'repo',
      branch: 'main',
      baseBranch: 'main',
      prNumber: 456,
      platform: 'github'
    };

    // Mock Comments & Files - 같은 주제(naming conventions)
    const mockResults = [
      {
        enhancedComment: {
          category: 'naming',
          keywords: ['PascalCase', 'components'],
          content: 'Use PascalCase for React components',
          codeExamples: [],
          suggestedFileName: 'naming-conventions.md',
          llmEnhanced: false
        } as EnhancedComment,
        comment: {
          id: 'comment-1',
          author: 'reviewer1',
          content: 'Use PascalCase for React components',
          htmlContent: '',
          url: 'https://github.com/test/repo/pull/456#comment-1',
          createdAt: new Date().toISOString(),
          platform: 'github'
        } as Comment,
        files: [
          {
            projectType: 'claude-code',
            filePath: '.claude/rules/naming-conventions.md',
            content: '# Naming Conventions\n\n## Component Naming\nUse PascalCase for React components',
            isUpdate: false
          }
        ] as FileGenerationResult[]
      },
      {
        enhancedComment: {
          category: 'naming',
          keywords: ['kebab-case', 'files'],
          content: 'Use kebab-case for file names',
          codeExamples: [],
          suggestedFileName: 'naming-conventions.md',
          llmEnhanced: false
        } as EnhancedComment,
        comment: {
          id: 'comment-2',
          author: 'reviewer2',
          content: 'Use kebab-case for file names',
          htmlContent: '',
          url: 'https://github.com/test/repo/pull/456#comment-2',
          createdAt: new Date().toISOString(),
          platform: 'github'
        } as Comment,
        files: [
          {
            projectType: 'claude-code',
            filePath: '.claude/rules/naming-conventions.md',
            content: '# Naming Conventions\n\n## File Naming\nUse kebab-case for file names',
            isUpdate: false
          }
        ] as FileGenerationResult[]
      }
    ];

    // Execute
    const prService = new PullRequestServiceImpl();
    const result = await prService.createMultiFileWrapup(
      mockApiClient,
      mockRepository,
      mockResults
    );

    // Verify
    expect(result.prUrl).toBe('https://github.com/test/repo/pull/123');

    // createOrUpdateMultipleFiles가 1번 호출되어야 함
    expect(mockApiClient.createOrUpdateMultipleFiles).toHaveBeenCalledTimes(1);

    // 병합된 파일 내용 확인
    const fileCall = (mockApiClient.createOrUpdateMultipleFiles as any).mock.calls[0];
    const files = fileCall[1] as Array<{ path: string; content: string }>; // files 파라미터

    // 2개 파일이 1개로 병합되어야 함
    expect(files.length).toBe(1);

    const mergedContent = files[0].content;

    // 두 코멘트의 내용이 모두 포함되어야 함
    expect(mergedContent).toContain('Component Naming');
    expect(mergedContent).toContain('PascalCase');
    expect(mergedContent).toContain('File Naming');
    expect(mergedContent).toContain('kebab-case');

    // 제목은 한 번만 나타나야 함
    const titleMatches = mergedContent.match(/# Naming Conventions/g);
    expect(titleMatches?.length).toBe(1);
  });

  it('다른 경로의 파일들은 별도로 유지되어야 함', async () => {
    // Mock API Client
    const mockApiClient = {
      createBranch: vi.fn().mockResolvedValue(true),
      createOrUpdateFile: vi.fn().mockResolvedValue(true),
      createOrUpdateMultipleFiles: vi.fn().mockResolvedValue(true),
      createPullRequest: vi.fn().mockResolvedValue({
        success: true,
        url: 'https://github.com/test/repo/pull/123'
      }),
      findPullRequestByBranch: vi.fn().mockResolvedValue(null)
    } as unknown as ApiClient;

    const mockRepository: Repository = {
      owner: 'test',
      name: 'repo',
      branch: 'main',
      baseBranch: 'main',
      prNumber: 456,
      platform: 'github'
    };

    // Mock Comments & Files - 다른 주제
    const mockResults = [
      {
        enhancedComment: {
          category: 'naming',
          keywords: ['PascalCase'],
          content: 'Use PascalCase',
          codeExamples: [],
          suggestedFileName: 'naming-conventions.md',
          llmEnhanced: false
        } as EnhancedComment,
        comment: {
          id: 'comment-1',
          author: 'reviewer1',
          content: 'Use PascalCase',
          htmlContent: '',
          url: 'https://github.com/test/repo/pull/456#comment-1',
          createdAt: new Date().toISOString(),
          platform: 'github'
        } as Comment,
        files: [
          {
            projectType: 'claude-code',
            filePath: '.claude/rules/naming-conventions.md',
            content: '# Naming Conventions\nContent A',
            isUpdate: false
          }
        ]
      },
      {
        enhancedComment: {
          category: 'error-handling',
          keywords: ['try-catch'],
          content: 'Always use try-catch',
          codeExamples: [],
          suggestedFileName: 'error-handling.md',
          llmEnhanced: false
        } as EnhancedComment,
        comment: {
          id: 'comment-2',
          author: 'reviewer2',
          content: 'Always use try-catch',
          htmlContent: '',
          url: 'https://github.com/test/repo/pull/456#comment-2',
          createdAt: new Date().toISOString(),
          platform: 'github'
        } as Comment,
        files: [
          {
            projectType: 'claude-code',
            filePath: '.claude/rules/error-handling.md',
            content: '# Error Handling\nContent B',
            isUpdate: false
          }
        ]
      }
    ];

    // Execute
    const prService = new PullRequestServiceImpl();
    const result = await prService.createMultiFileWrapup(
      mockApiClient,
      mockRepository,
      mockResults
    );

    // Verify
    expect(result.prUrl).toBe('https://github.com/test/repo/pull/123');

    // createOrUpdateMultipleFiles가 1번 호출되어야 함 (모든 파일을 하나의 커밋으로)
    expect(mockApiClient.createOrUpdateMultipleFiles).toHaveBeenCalledTimes(1);

    // 병합되지 않은 2개 파일이 전달되어야 함 (경로가 다르므로)
    const fileCall = (mockApiClient.createOrUpdateMultipleFiles as any).mock.calls[0];
    const files = fileCall[1] as Array<{ path: string; content: string }>;

    expect(files.length).toBe(2);

    const filePaths = files.map((f: { path: string }) => f.path);
    expect(filePaths).toContain('.claude/rules/naming-conventions.md');
    expect(filePaths).toContain('.claude/rules/error-handling.md');
  });

  it('3개 이상의 같은 경로 파일도 병합되어야 함', async () => {
    // Mock API Client
    const mockApiClient = {
      createBranch: vi.fn().mockResolvedValue(true),
      createOrUpdateFile: vi.fn().mockResolvedValue(true),
      createOrUpdateMultipleFiles: vi.fn().mockResolvedValue(true),
      createPullRequest: vi.fn().mockResolvedValue({
        success: true,
        url: 'https://github.com/test/repo/pull/123'
      }),
      findPullRequestByBranch: vi.fn().mockResolvedValue(null)
    } as unknown as ApiClient;

    const mockRepository: Repository = {
      owner: 'test',
      name: 'repo',
      branch: 'main',
      baseBranch: 'main',
      prNumber: 456,
      platform: 'github'
    };

    // 3개의 같은 경로 파일
    const mockResults = [
      {
        enhancedComment: {
          category: 'testing',
          keywords: ['unit-tests'],
          content: 'Write unit tests',
          codeExamples: [],
          suggestedFileName: 'testing.md',
          llmEnhanced: false
        } as EnhancedComment,
        comment: {
          id: 'comment-1',
          author: 'reviewer1',
          content: 'Write unit tests',
          htmlContent: '',
          url: 'https://github.com/test/repo/pull/456#comment-1',
          createdAt: new Date().toISOString(),
          platform: 'github'
        } as Comment,
        files: [
          {
            projectType: 'claude-code',
            filePath: '.claude/rules/testing.md',
            content: '# Testing\n\n## Unit Tests\nWrite unit tests',
            isUpdate: false
          }
        ]
      },
      {
        enhancedComment: {
          category: 'testing',
          keywords: ['integration-tests'],
          content: 'Write integration tests',
          codeExamples: [],
          suggestedFileName: 'testing.md',
          llmEnhanced: false
        } as EnhancedComment,
        comment: {
          id: 'comment-2',
          author: 'reviewer2',
          content: 'Write integration tests',
          htmlContent: '',
          url: 'https://github.com/test/repo/pull/456#comment-2',
          createdAt: new Date().toISOString(),
          platform: 'github'
        } as Comment,
        files: [
          {
            projectType: 'claude-code',
            filePath: '.claude/rules/testing.md',
            content: '# Testing\n\n## Integration Tests\nWrite integration tests',
            isUpdate: false
          }
        ]
      },
      {
        enhancedComment: {
          category: 'testing',
          keywords: ['e2e-tests'],
          content: 'Write E2E tests',
          codeExamples: [],
          suggestedFileName: 'testing.md',
          llmEnhanced: false
        } as EnhancedComment,
        comment: {
          id: 'comment-3',
          author: 'reviewer3',
          content: 'Write E2E tests',
          htmlContent: '',
          url: 'https://github.com/test/repo/pull/456#comment-3',
          createdAt: new Date().toISOString(),
          platform: 'github'
        } as Comment,
        files: [
          {
            projectType: 'claude-code',
            filePath: '.claude/rules/testing.md',
            content: '# Testing\n\n## E2E Tests\nWrite E2E tests',
            isUpdate: false
          }
        ]
      }
    ];

    // Execute
    const prService = new PullRequestServiceImpl();
    const result = await prService.createMultiFileWrapup(
      mockApiClient,
      mockRepository,
      mockResults
    );

    // Verify
    expect(result.prUrl).toBe('https://github.com/test/repo/pull/123');

    // createOrUpdateMultipleFiles가 1번 호출되어야 함 (3개 파일이 1개로 병합)
    expect(mockApiClient.createOrUpdateMultipleFiles).toHaveBeenCalledTimes(1);

    // 병합된 파일 내용 확인
    const fileCall = (mockApiClient.createOrUpdateMultipleFiles as any).mock.calls[0];
    const files = fileCall[1] as Array<{ path: string; content: string }>;

    expect(files.length).toBe(1);

    const mergedContent = files[0].content;

    // 세 코멘트의 내용이 모두 포함되어야 함
    expect(mergedContent).toContain('Unit Tests');
    expect(mergedContent).toContain('Integration Tests');
    expect(mergedContent).toContain('E2E Tests');
  });
});
