/**
 * Review to Instruction - API Client
 * GitHub/GitLab REST API 클라이언트
 */

import type { Platform, Repository } from '../types';

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

    console.log('[ApiClient] Initialized with baseUrl:', this.baseUrl);
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
        console.log(`[ApiClient] Directory not found: ${path} (this is normal for new repos)`);
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
        console.log(`[ApiClient] Directory not found: ${path} (this is normal for new repos)`);
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
      console.error(`[ApiClient] Failed to get file content for ${path}:`, error);
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
    sha?: string
  ): Promise<boolean> {
    try {
      if (this.platform === 'github') {
        await this.createOrUpdateGitHubFile(repository, path, content, message, branch, sha);
      } else {
        await this.createOrUpdateGitLabFile(repository, path, content, message, branch);
      }
      return true;
    } catch (error) {
      console.error('[ApiClient] Failed to create/update file:', error);
      return false;
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
    branch: string
  ): Promise<void> {
    const projectPath = encodeURIComponent(`${repository.owner}/${repository.name}`);
    const filePath = encodeURIComponent(path);

    // 파일이 존재하는지 확인
    const existingFile = await this.getGitLabFileContent(repository, path);
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
   * 브랜치 생성
   */
  async createBranch(
    repository: Repository,
    branchName: string,
    fromBranch: string
  ): Promise<boolean> {
    try {
      console.log('[ApiClient] createBranch called with:', {
        repository: `${repository.owner}/${repository.name}`,
        branchName,
        fromBranch,
        platform: this.platform
      });

      if (this.platform === 'github') {
        await this.createGitHubBranch(repository, branchName, fromBranch);
      } else {
        await this.createGitLabBranch(repository, branchName, fromBranch);
      }
      return true;
    } catch (error) {
      console.error('[ApiClient] Failed to create branch:', error);
      if (error instanceof Error) {
        console.error('[ApiClient] Error message:', error.message);
        console.error('[ApiClient] Error stack:', error.stack);
      }
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
    try {
      console.log('[ApiClient] ===== Starting GitHub branch creation =====');
      console.log('[ApiClient] Parameters:', {
        branchName,
        fromBranch,
        repository: `${repository.owner}/${repository.name}`
      });

      // 1. 기준 브랜치의 SHA 가져오기
      // 브랜치명에 슬래시가 있을 수 있으므로 URL 인코딩
      const encodedFromBranch = encodeURIComponent(fromBranch);
      const refUrl = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/git/refs/heads/${encodedFromBranch}`;
      console.log('[ApiClient] Step 1: Getting ref for base branch');
      console.log('[ApiClient] Ref URL:', refUrl);
      console.log('[ApiClient] Encoded branch name:', encodedFromBranch);

      let refResponse;
      try {
        refResponse = await this.fetch(refUrl);
      } catch (refError) {
        console.error('[ApiClient] ❌ Failed to get base branch ref');
        console.error('[ApiClient] This usually means the branch does not exist');
        console.error('[ApiClient] Branch we tried:', fromBranch);
        console.error('[ApiClient] Full error:', refError);
        throw new Error(`Base branch '${fromBranch}' not found. Please check if this branch exists in the repository.`);
      }

      const sha = refResponse.object.sha;
      console.log('[ApiClient] ✓ Base branch SHA obtained:', sha);

      // 2. 새 브랜치 생성
      const createUrl = `${this.baseUrl}/repos/${repository.owner}/${repository.name}/git/refs`;
      console.log('[ApiClient] Step 2: Creating new branch');
      console.log('[ApiClient] Create URL:', createUrl);
      console.log('[ApiClient] New branch ref:', `refs/heads/${branchName}`);

      try {
        await this.fetch(createUrl, {
          method: 'POST',
          body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha
          })
        });
      } catch (createError) {
        console.error('[ApiClient] ❌ Failed to create new branch');
        console.error('[ApiClient] Branch name:', branchName);
        console.error('[ApiClient] Full error:', createError);
        throw createError;
      }

      console.log('[ApiClient] ✓ Branch created successfully:', branchName);
      console.log('[ApiClient] ===== Branch creation completed =====');
    } catch (error) {
      console.error('[ApiClient] ===== Branch creation FAILED =====');
      console.error('[ApiClient] Error details:', error);
      throw error;
    }
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
   * HTTP fetch 래퍼
   */
  private async fetch(url: string, options: RequestInit = {}): Promise<any> {
    // API 호출 로깅 (디버깅용)
    console.log(`[ApiClient] ${options.method || 'GET'} ${url}`);

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
      console.error(`[ApiClient] API request failed: ${options.method || 'GET'} ${url} -> ${response.status}`);
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log(`[ApiClient] ${options.method || 'GET'} ${url} -> ${response.status} OK`);
    return response.json();
  }
}
