import type { GitHubRelease, GitHubAsset, GitHubRepository } from './types.js';

const GITHUB_API_BASE = 'https://api.github.com';

export class GitHubClient {
  private token: string | undefined;

  constructor(token?: string) {
    this.token = token || process.env['GITHUB_TOKEN'];
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': '4D-Dependency-Validator',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found`);
      }
      if (response.status === 403) {
        throw new Error(`API rate limit exceeded. Consider using a GITHUB_TOKEN`);
      }
      throw new Error(`Failed to fetch repository: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<GitHubRepository>;
  }

  async getReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found`);
      }
      if (response.status === 403) {
        throw new Error(`API rate limit exceeded. Consider using a GITHUB_TOKEN`);
      }
      throw new Error(`Failed to fetch releases: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<GitHubRelease[]>;
  }

  async downloadAsset(asset: GitHubAsset, destPath: string): Promise<void> {
    const response = await fetch(asset.browser_download_url, {
      headers: {
        'User-Agent': '4D-Dependency-Validator',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const fs = await import('node:fs/promises');
    await fs.writeFile(destPath, Buffer.from(buffer));
  }

  parseRepoPath(repoPath: string): { owner: string; repo: string } {
    const parts = repoPath.trim().split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid repository path: ${repoPath}. Expected format: owner/repo`);
    }
    return { owner: parts[0], repo: parts[1] };
  }
}
