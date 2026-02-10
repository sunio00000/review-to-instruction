/**
 * Review to Instruction - API Client
 * GitHub/GitLab REST API 클라이언트
 */

import type { Platform, Repository, PRReviewData, ApiReviewComment, ApiReviewThread } from '../types';

export interface ApiClientOptions {
  token: string;
  platform: Platform;
  gitlabUrl?: string;  // Self-hosted GitLab URL (선택)
}

export interface GitHubUser {
  login: string;
  name: string;
  email: string;
}

export interface GitLabUser {
  username: string;
  name: string;
  email: string;
}

export interface FileContent {
  path: string;
  content: string;  // Base64 encoded
  sha?: string;     // GitHub only
}

export interface DirectoryItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

export class ApiClient {
  private token: string;
  private platform: Platform;
  private baseUrl: string;

  constructor(options: ApiClientOptions) {
    this.token = options.token;
    this.platform = options.platform;

    // GitLab의 경우 사용자 지정 URL 또는 기본값 사용
    if (this.platform === 'github') {
      this.baseUrl = 'https://api.github.com';
    } else {
      const gitlabBaseUrl = options.gitlabUrl || 'https://gitlab.com';
      // URL 끝의 슬래시 제거
      const cleanUrl = gitlabBaseUrl.replace(/\/$/, '');
      this.baseUrl = `${cleanUrl}/api/v4`;
    }
  }

  /**
   * API 연결 테스트 (현재 사용자 정보 가져오기)
   */
  async testConnection(): Promise<{ success: boolean; user?: string; error?: string }> {
    try {
      if (this.platform === 'github') {
        const user = await this.getGitHubUser();
        return { success: true, user: user.login };
      } else {
        const user = await this.getGitLabUser();
        return { success: true, user: user.username };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * GitHub 사용자 정보 가져오기
   */
  private async getGitHubUser(): Promise<GitHubUser> {
    const response = await this.fetch(`${this.baseUrl}/user`);
    return response as GitHubUser;
  }

  /**
   * GitLab 사용자 정보 가져오기
   */
  private async getGitLabUser(): Promise<GitLabUser> {
    const response = await this.fetch(`${this.baseUrl}/user`);
    return response as GitLabUser;
  }

  /**
   * 디렉토리 내용 가져오기
   */
  async getDirectoryContents(
    repository: Repository,
    path: string
  ): Promise<DirectoryItem[]> {
    if (this.platform === 'github') {
      return this.getGitHubDirectoryContents(repository, path);
    } else {
      return this.getGitLabDirectoryContents(repository, path);
    }
  }

  /**
   * GitHub 디렉토리 내용
   */
  private async getGitHubDirectoryContents(
    repository: Repository,
    path: string
  ): Promise<DirectoryItem[]> {
    try {
      const url = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/contents/${path}?ref=${repository.branch}`;
      const response = await this.fetch(url);
      const items = Array.isArray(response) ? response : [response];

      return items.map((item: any) => ({
        name: item.name,
        path: item.path,
        type: item.type === 'dir' ? 'dir' : 'file'
      }));
    } catch (error) {
      // 404 (디렉토리가 없음)는 정상 - 빈 배열 반환
      if (error instanceof Error && error.message.includes('404')) {
        return [];
      }
      // 다른 에러는 재발생
      throw error;
    }
  }

  /**
   * GitLab 디렉토리 내용
   */
  private async getGitLabDirectoryContents(
    repository: Repository,
    path: string
  ): Promise<DirectoryItem[]> {
    try {
      const projectPath = encodeURIComponent(`${repository.owner}/${repository.name}`);
      const url = `${this.baseUrl}/projects/${projectPath}/repository/tree?path=${encodeURIComponent(path)}`;
      const response = await this.fetch(url);
      const items = Array.isArray(response) ? response : [];

      return items.map((item: any) => ({
        name: item.name,
        path: item.path,
        type: item.type === 'tree' ? 'dir' : 'file'
      }));
    } catch (error) {
      // 404 (디렉토리가 없음)는 정상 - 빈 배열 반환
      if (error instanceof Error && error.message.includes('404')) {
        return [];
      }
      // 다른 에러는 재발생
      throw error;
    }
  }

  /**
   * 파일 내용 가져오기
   */
  async getFileContent(
    repository: Repository,
    path: string
  ): Promise<FileContent | null> {
    try {
      if (this.platform === 'github') {
        return this.getGitHubFileContent(repository, path);
      } else {
        return this.getGitLabFileContent(repository, path);
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * GitHub 파일 내용
   */
  private async getGitHubFileContent(
    repository: Repository,
    path: string
  ): Promise<FileContent> {
    const url = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/contents/${path}?ref=${repository.branch}`;
    const response = await this.fetch(url);

    return {
      path: response.path,
      content: response.content,
      sha: response.sha
    };
  }

  /**
   * GitLab 파일 내용
   */
  private async getGitLabFileContent(
    repository: Repository,
    path: string
  ): Promise<FileContent> {
    const projectPath = encodeURIComponent(`${repository.owner}/${repository.name}`);
    const filePath = encodeURIComponent(path);
    const url = `${this.baseUrl}/projects/${projectPath}/repository/files/${filePath}?ref=${repository.branch}`;
    const response = await this.fetch(url);

    return {
      path: response.file_path,
      content: response.content
    };
  }

  /**
   * 파일 생성 또는 업데이트
   */
  async createOrUpdateFile(
    repository: Repository,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string,
    baseBranch?: string  // base 브랜치 (파일 존재 여부 확인용)
  ): Promise<boolean> {
    try {
      if (this.platform === 'github') {
        await this.createOrUpdateGitHubFile(repository, path, content, message, branch, sha);
      } else {
        await this.createOrUpdateGitLabFile(repository, path, content, message, branch, baseBranch);
      }
      return true;
    } catch (error) {
      console.error(`[ApiClient] Failed to commit file: ${path}`, error);
      // 에러를 다시 던져서 상위에서 처리할 수 있도록 함
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to commit file: ${path}\n\nReason: ${errorMessage}`);
    }
  }

  /**
   * 여러 파일을 하나의 커밋으로 생성 또는 업데이트
   */
  async createOrUpdateMultipleFiles(
    repository: Repository,
    files: Array<{ path: string; content: string }>,
    message: string,
    branch: string,
    baseBranch?: string
  ): Promise<boolean> {
    try {
      if (this.platform === 'github') {
        await this.createOrUpdateGitHubMultipleFiles(repository, files, message, branch);
      } else {
        await this.createOrUpdateGitLabMultipleFiles(repository, files, message, branch, baseBranch);
      }
      return true;
    } catch (error) {
      console.error(`[ApiClient] Failed to commit multiple files`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to commit multiple files\n\nReason: ${errorMessage}`);
    }
  }

  /**
   * GitHub 파일 생성/업데이트
   */
  private async createOrUpdateGitHubFile(
    repository: Repository,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string
  ): Promise<void> {
    const url = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/contents/${path}`;

    const body: any = {
      message,
      // UTF-8 to Base64 (unescape는 deprecated, TextEncoder 사용)
      content: btoa(String.fromCharCode(...new TextEncoder().encode(content))),
      branch
    };

    if (sha) {
      body.sha = sha;
    }

    await this.fetch(url, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  /**
   * GitLab 파일 생성/업데이트
   */
  private async createOrUpdateGitLabFile(
    repository: Repository,
    path: string,
    content: string,
    message: string,
    branch: string,
    baseBranch?: string
  ): Promise<void> {
    const projectPath = encodeURIComponent(`${repository.owner}/${repository.name}`);
    const filePath = encodeURIComponent(path);

    // 파일이 존재하는지 확인 (base 브랜치에서 확인)
    // 새로 생성된 브랜치에는 커밋이 없어서 404 에러가 발생할 수 있음
    let existingFile: FileContent | null = null;

    try {
      // base 브랜치가 제공되면 해당 브랜치에서 파일 확인
      if (baseBranch && baseBranch !== branch) {
        const checkUrl = `${this.baseUrl}/projects/${projectPath}/repository/files/${filePath}?ref=${encodeURIComponent(baseBranch)}`;
        const response = await this.fetch(checkUrl);
        existingFile = {
          path: response.file_path,
          content: response.content
        };
      } else {
        // base 브랜치가 없으면 현재 브랜치에서 확인
        existingFile = await this.getGitLabFileContent(repository, path);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 404 에러만 무시 (파일이 없음 - 정상)
      if (errorMessage.includes('404')) {
        existingFile = null;
      } else {
        // 다른 에러는 재발생 (인증 에러, 네트워크 에러 등)
        throw error;
      }
    }

    const action = existingFile ? 'update' : 'create';

    const url = `${this.baseUrl}/projects/${projectPath}/repository/files/${filePath}`;

    const body = {
      branch,
      content,
      commit_message: message,
      encoding: 'text'
    };

    await this.fetch(url, {
      method: action === 'create' ? 'POST' : 'PUT',
      body: JSON.stringify(body)
    });
  }

  /**
   * GitHub 다중 파일 생성/업데이트 (하나의 커밋으로)
   */
  private async createOrUpdateGitHubMultipleFiles(
    repository: Repository,
    files: Array<{ path: string; content: string }>,
    message: string,
    branch: string
  ): Promise<void> {
    // 1. 현재 브랜치의 최신 커밋 SHA 가져오기
    const refUrl = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/git/refs/heads/${encodeURIComponent(branch)}`;
    const refResponse = await this.fetch(refUrl);
    const latestCommitSha = refResponse.object.sha;

    // 2. 최신 커밋의 트리 SHA 가져오기
    const commitUrl = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/git/commits/${latestCommitSha}`;
    const commitResponse = await this.fetch(commitUrl);
    const baseTreeSha = commitResponse.tree.sha;

    // 3. 새 트리 생성 (여러 파일 포함)
    const treeUrl = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/git/trees`;
    const tree = files.map(file => ({
      path: file.path,
      mode: '100644',  // 일반 파일
      type: 'blob',
      content: file.content
    }));

    const treeResponse = await this.fetch(treeUrl, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree
      })
    });

    // 4. 새 커밋 생성
    const newCommitUrl = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/git/commits`;
    const newCommitResponse = await this.fetch(newCommitUrl, {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: treeResponse.sha,
        parents: [latestCommitSha]
      })
    });

    // 5. 브랜치 ref 업데이트
    await this.fetch(refUrl, {
      method: 'PATCH',
      body: JSON.stringify({
        sha: newCommitResponse.sha,
        force: false
      })
    });
  }

  /**
   * GitLab 다중 파일 생성/업데이트 (하나의 커밋으로)
   */
  private async createOrUpdateGitLabMultipleFiles(
    repository: Repository,
    files: Array<{ path: string; content: string }>,
    message: string,
    branch: string,
    baseBranch?: string
  ): Promise<void> {
    const projectPath = encodeURIComponent(`${repository.owner}/${repository.name}`);

    // 각 파일이 존재하는지 확인하여 action 결정
    const actions = await Promise.all(
      files.map(async (file) => {
        const filePath = encodeURIComponent(file.path);
        let exists = false;

        try {
          // base 브랜치가 제공되면 해당 브랜치에서 파일 확인
          if (baseBranch && baseBranch !== branch) {
            const checkUrl = `${this.baseUrl}/projects/${projectPath}/repository/files/${filePath}?ref=${encodeURIComponent(baseBranch)}`;
            await this.fetch(checkUrl);
            exists = true;
          } else {
            // base 브랜치가 없으면 현재 브랜치에서 확인
            const tempRepo = { ...repository, branch };
            await this.getGitLabFileContent(tempRepo, file.path);
            exists = true;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('404')) {
            // 404가 아닌 다른 에러는 재발생
            throw error;
          }
          // 404는 파일이 없음을 의미 (정상)
        }

        return {
          action: exists ? 'update' : 'create',
          file_path: file.path,
          content: file.content
        };
      })
    );

    // GitLab Commits API로 한 번에 커밋
    const url = `${this.baseUrl}/projects/${projectPath}/repository/commits`;
    await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        branch,
        commit_message: message,
        actions
      })
    });
  }

  /**
   * 브랜치 생성
   */
  async createBranch(
    repository: Repository,
    branchName: string,
    fromBranch: string
  ): Promise<boolean> {
    try {
      if (this.platform === 'github') {
        await this.createGitHubBranch(repository, branchName, fromBranch);
      } else {
        await this.createGitLabBranch(repository, branchName, fromBranch);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * GitHub 브랜치 생성
   */
  private async createGitHubBranch(
    repository: Repository,
    branchName: string,
    fromBranch: string
  ): Promise<void> {
    // 1. 기준 브랜치의 SHA 가져오기
    // 브랜치명에 슬래시가 있을 수 있으므로 URL 인코딩
    const encodedFromBranch = encodeURIComponent(fromBranch);
    const refUrl = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/git/refs/heads/${encodedFromBranch}`;

    let refResponse;
    try {
      refResponse = await this.fetch(refUrl);
    } catch (refError) {
      throw new Error(`Base branch '${fromBranch}' not found. Please check if this branch exists in the repository.`);
    }

    const sha = refResponse.object.sha;

    // 2. 새 브랜치 생성
    const createUrl = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/git/refs`;

    await this.fetch(createUrl, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha
      })
    });
  }

  /**
   * GitLab 브랜치 생성
   */
  private async createGitLabBranch(
    repository: Repository,
    branchName: string,
    fromBranch: string
  ): Promise<void> {
    const projectPath = encodeURIComponent(`${repository.owner}/${repository.name}`);
    const url = `${this.baseUrl}/projects/${projectPath}/repository/branches`;

    await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        branch: branchName,
        ref: fromBranch
      })
    });
  }

  /**
   * PR/MR 생성
   */
  async createPullRequest(
    repository: Repository,
    title: string,
    body: string,
    headBranch: string,
    baseBranch: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      if (this.platform === 'github') {
        const url = await this.createGitHubPR(repository, title, body, headBranch, baseBranch);
        return { success: true, url };
      } else {
        const url = await this.createGitLabMR(repository, title, body, headBranch, baseBranch);
        return { success: true, url };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * GitHub PR 생성
   */
  private async createGitHubPR(
    repository: Repository,
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<string> {
    const url = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/pulls`;
    const response = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        head,
        base
      })
    });

    return response.html_url;
  }

  /**
   * GitLab MR 생성
   */
  private async createGitLabMR(
    repository: Repository,
    title: string,
    description: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<string> {
    const projectPath = encodeURIComponent(`${repository.owner}/${repository.name}`);
    const url = `${this.baseUrl}/projects/${projectPath}/merge_requests`;
    const response = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        source_branch: sourceBranch,
        target_branch: targetBranch
      })
    });

    return response.web_url;
  }

  /**
   * 브랜치로 기존 PR/MR 찾기
   */
  async findPullRequestByBranch(
    repository: Repository,
    branchName: string
  ): Promise<{ url: string; number: number } | null> {
    try {
      if (this.platform === 'github') {
        return await this.findGitHubPR(repository, branchName);
      } else {
        return await this.findGitLabMR(repository, branchName);
      }
    } catch (error) {
      // PR/MR을 찾지 못하면 null 반환
      return null;
    }
  }

  /**
   * GitHub에서 브랜치로 PR 찾기
   */
  private async findGitHubPR(
    repository: Repository,
    branchName: string
  ): Promise<{ url: string; number: number } | null> {
    const url = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/pulls?head=${repository.owner}:${branchName}&state=open`;
    const response = await this.fetch(url);

    if (Array.isArray(response) && response.length > 0) {
      const pr = response[0];
      return {
        url: pr.html_url,
        number: pr.number
      };
    }

    return null;
  }

  /**
   * GitLab에서 브랜치로 MR 찾기
   */
  private async findGitLabMR(
    repository: Repository,
    branchName: string
  ): Promise<{ url: string; number: number } | null> {
    const projectPath = encodeURIComponent(`${repository.owner}/${repository.name}`);
    const url = `${this.baseUrl}/projects/${projectPath}/merge_requests?source_branch=${branchName}&state=opened`;
    const response = await this.fetch(url);

    if (Array.isArray(response) && response.length > 0) {
      const mr = response[0];
      return {
        url: mr.web_url,
        number: mr.iid
      };
    }

    return null;
  }

  /**
   * PR/MR 리뷰 데이터 조회 (스레드 + 일반 코멘트)
   */
  async getReviewData(repository: Repository): Promise<PRReviewData> {
    if (this.platform === 'github') {
      return this.getGitHubReviewData(repository);
    } else {
      return this.getGitLabReviewData(repository);
    }
  }

  /**
   * GitHub PR 리뷰 데이터 조회
   * - GET /repos/{owner}/{repo}/pulls/{pull_number}/comments (인라인 리뷰)
   * - GET /repos/{owner}/{repo}/issues/{issue_number}/comments (일반 코멘트)
   */
  private async getGitHubReviewData(repository: Repository): Promise<PRReviewData> {
    const { owner, name, prNumber } = repository;

    // 1. 인라인 리뷰 코멘트 조회 (페이지네이션)
    const reviewComments = await this.fetchAllPages<any>(
      `${this.baseUrl}/repos/${owner}/${name}/pulls/${prNumber}/comments?per_page=100`
    );

    // 2. 일반 PR 코멘트 조회 (페이지네이션)
    const issueComments = await this.fetchAllPages<any>(
      `${this.baseUrl}/repos/${owner}/${name}/issues/${prNumber}/comments?per_page=100`
    );

    // 3. 인라인 코멘트를 스레드로 그룹화 (in_reply_to_id 기반)
    const threads = this.groupGitHubCommentsIntoThreads(reviewComments);

    // 4. 일반 코멘트 변환
    const generalComments: ApiReviewComment[] = issueComments.map((c: any) => ({
      id: c.id,
      body: c.body || '',
      author: c.user?.login || 'Unknown',
      createdAt: c.created_at || new Date().toISOString()
    }));

    const totalCommentCount = reviewComments.length + issueComments.length;

    return { threads, generalComments, totalCommentCount };
  }

  /**
   * GitHub 인라인 코멘트를 스레드로 그룹화
   */
  private groupGitHubCommentsIntoThreads(comments: any[]): ApiReviewThread[] {
    const threadMap = new Map<number, ApiReviewComment[]>();

    // 각 코멘트를 스레드 루트 ID 기준으로 그룹화
    for (const c of comments) {
      const comment: ApiReviewComment = {
        id: c.id,
        body: c.body || '',
        author: c.user?.login || 'Unknown',
        path: c.path,
        line: c.line || c.original_line,
        diffHunk: c.diff_hunk,
        createdAt: c.created_at || new Date().toISOString(),
        inReplyToId: c.in_reply_to_id
      };

      // in_reply_to_id가 있으면 해당 스레드에 추가, 없으면 새 스레드 시작
      const rootId = c.in_reply_to_id || c.id;
      const existing = threadMap.get(rootId) || [];
      existing.push(comment);
      threadMap.set(rootId, existing);
    }

    // Map을 ApiReviewThread 배열로 변환
    const threads: ApiReviewThread[] = [];
    for (const [rootId, threadComments] of threadMap) {
      // 시간순 정렬
      threadComments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const first = threadComments[0];
      threads.push({
        id: String(rootId),
        comments: threadComments,
        path: first.path,
        line: first.line,
        diffHunk: first.diffHunk
      });
    }

    return threads;
  }

  /**
   * GitLab MR 리뷰 데이터 조회
   * - GET /projects/{id}/merge_requests/{mr_iid}/discussions
   */
  private async getGitLabReviewData(repository: Repository): Promise<PRReviewData> {
    const { owner, name, prNumber } = repository;
    const projectPath = encodeURIComponent(`${owner}/${name}`);

    // discussions 조회 (페이지네이션)
    const discussions = await this.fetchAllPages<any>(
      `${this.baseUrl}/projects/${projectPath}/merge_requests/${prNumber}/discussions?per_page=100`
    );

    const threads: ApiReviewThread[] = [];
    const generalComments: ApiReviewComment[] = [];
    let totalCommentCount = 0;

    for (const discussion of discussions) {
      const notes: any[] = discussion.notes || [];
      // 시스템 노트 제외
      const userNotes = notes.filter((n: any) => !n.system);
      if (userNotes.length === 0) continue;

      totalCommentCount += userNotes.length;

      const apiComments: ApiReviewComment[] = userNotes.map((n: any) => ({
        id: n.id,
        body: n.body || '',
        author: n.author?.username || 'Unknown',
        path: n.position?.new_path || n.position?.old_path,
        line: n.position?.new_line || n.position?.old_line,
        diffHunk: undefined, // GitLab discussions API는 diff_hunk를 직접 제공하지 않음
        createdAt: n.created_at || new Date().toISOString()
      }));

      const first = apiComments[0];
      const isInline = !!first.path;

      if (isInline) {
        threads.push({
          id: discussion.id,
          comments: apiComments,
          path: first.path,
          line: first.line
        });
      } else {
        generalComments.push(...apiComments);
      }
    }

    return { threads, generalComments, totalCommentCount };
  }

  /**
   * 페이지네이션을 처리하여 모든 결과 조회
   */
  private async fetchAllPages<T>(url: string): Promise<T[]> {
    const allItems: T[] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const response = await globalThis.fetch(nextUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(this.platform === 'github'
            ? { 'Authorization': `Bearer ${this.token}` }
            : { 'PRIVATE-TOKEN': this.token }
          )
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : [];
      allItems.push(...items);

      // Link 헤더에서 다음 페이지 URL 추출
      nextUrl = this.getNextPageUrl(response.headers.get('link'));
    }

    return allItems;
  }

  /**
   * Link 헤더에서 다음 페이지 URL 추출
   */
  private getNextPageUrl(linkHeader: string | null): string | null {
    if (!linkHeader) return null;

    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    return match ? match[1] : null;
  }

  /**
   * HTTP fetch 래퍼
   */
  private async fetch(url: string, options: RequestInit = {}): Promise<any> {
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(this.platform === 'github'
        ? { 'Authorization': `Bearer ${this.token}` }
        : { 'PRIVATE-TOKEN': this.token }
      )
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }
}
