/**
 * GitHub API Mock Handlers (MSW)
 */

import { http, HttpResponse } from 'msw';

export const githubHandlers = [
  // 1. User 정보 조회
  http.get('https://api.github.com/user', () => {
    return HttpResponse.json({
      login: 'test-user',
      id: 12345,
      name: 'Test User',
      email: 'test@example.com'
    });
  }),

  // 2. Repository 정보 조회
  http.get('https://api.github.com/repos/:owner/:repo', ({ params }) => {
    return HttpResponse.json({
      id: 1,
      name: params.repo,
      full_name: `${params.owner}/${params.repo}`,
      owner: {
        login: params.owner
      },
      default_branch: 'main'
    });
  }),

  // 3. Directory 조회 (.claude/ 감지)
  http.get('https://api.github.com/repos/:owner/:repo/contents/.claude', () => {
    return HttpResponse.json([
      {
        name: 'instructions',
        path: '.claude/instructions',
        type: 'dir',
        sha: 'abc123'
      },
      {
        name: 'skills',
        path: '.claude/skills',
        type: 'dir',
        sha: 'def456'
      }
    ]);
  }),

  // 4. .claude/instructions 디렉토리 조회
  http.get('https://api.github.com/repos/:owner/:repo/contents/.claude/instructions', () => {
    return HttpResponse.json([
      {
        name: 'naming.md',
        path: '.claude/instructions/naming.md',
        type: 'file',
        sha: 'file123'
      }
    ]);
  }),

  // 5. Branch 조회 (main)
  http.get('https://api.github.com/repos/:owner/:repo/git/ref/heads/main', () => {
    return HttpResponse.json({
      ref: 'refs/heads/main',
      object: {
        sha: 'main-sha-123',
        type: 'commit'
      }
    });
  }),

  // 6. Branch 생성
  http.post('https://api.github.com/repos/:owner/:repo/git/refs', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      ref: body.ref,
      object: {
        sha: 'new-branch-sha-456',
        type: 'commit'
      }
    }, { status: 201 });
  }),

  // 7. File 생성/업데이트
  http.put('https://api.github.com/repos/:owner/:repo/contents/:path*', async ({ request, params }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      content: {
        name: params.path,
        path: params.path,
        sha: 'file-sha-789'
      },
      commit: {
        message: body.message,
        sha: 'commit-sha-abc',
        url: `https://github.com/${params.owner}/${params.repo}/commit/commit-sha-abc`
      }
    });
  }),

  // 8. PR 생성
  http.post('https://api.github.com/repos/:owner/:repo/pulls', async ({ request, params }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      number: 123,
      html_url: `https://github.com/${params.owner}/${params.repo}/pull/123`,
      title: body.title,
      head: {
        ref: body.head
      },
      base: {
        ref: body.base
      },
      state: 'open'
    });
  }),

  // 9. Tree 생성 (multi-file commit)
  http.post('https://api.github.com/repos/:owner/:repo/git/trees', async ({ request }) => {
    return HttpResponse.json({
      sha: 'tree-sha-999',
      url: 'https://api.github.com/repos/test/repo/git/trees/tree-sha-999'
    });
  }),

  // 10. Commit 생성
  http.post('https://api.github.com/repos/:owner/:repo/git/commits', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      sha: 'commit-sha-xyz',
      message: body.message,
      url: 'https://api.github.com/repos/test/repo/git/commits/commit-sha-xyz'
    });
  }),

  // 11. Reference 업데이트
  http.patch('https://api.github.com/repos/:owner/:repo/git/refs/:ref*', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      ref: 'refs/heads/ai-instruction/add-test',
      object: {
        sha: body.sha
      }
    });
  })
];
