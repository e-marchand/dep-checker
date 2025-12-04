export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  license: { key: string; name: string; spdx_id: string } | null;
  topics: string[];
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  html_url: string;
  body: string | null;
  author: { login: string; avatar_url: string; html_url: string };
  assets: GitHubAsset[];
}

export interface GitHubAsset {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface ComponentDependency {
  github?: string;
  version?: string;
  path?: string;
}

export interface DependenciesJson {
  dependencies?: Record<string, ComponentDependency>;
}

export interface ValidationResult {
  repository: string;
  valid: boolean;
  hasReleases: boolean;
  releases: ReleaseValidation[];
  errors: string[];
  githubInfo?: GitHubRepository;
}

export interface ReleaseValidation {
  tagName: string;
  hasMatchingZip: boolean;
  zipAssetName: string | null;
  componentValid: boolean;
  componentType: ComponentType | null;
  dependencies: DependenciesJson | null;
  errors: string[];
  githubRelease?: GitHubRelease;
}

export type ComponentType = '4Dbase' | '4DZ' | 'Project';
