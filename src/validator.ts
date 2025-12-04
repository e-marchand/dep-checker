import { join } from 'node:path';
import { GitHubClient } from './github-client.js';
import { ZipHandler } from './zip-handler.js';
import { ComponentValidator } from './component-validator.js';
import type { GitHubRelease, GitHubAsset, ValidationResult, ReleaseValidation } from './types.js';

export interface ValidateOptions {
  /** Specific release tag to validate, '*' for all releases, or undefined for first valid */
  release?: string;
  /** Include full GitHub info (repository and release details) */
  full?: boolean;
}

export interface ValidatorOptions {
  token?: string;
  verbose?: boolean;
  tempDir?: string;
}

export class DependencyValidator {
  private github: GitHubClient;
  private zip: ZipHandler;
  private component: ComponentValidator;
  private verbose: boolean;

  constructor(options: ValidatorOptions = {}) {
    this.github = new GitHubClient(options.token);
    this.zip = new ZipHandler(options.tempDir);
    this.component = new ComponentValidator();
    this.verbose = options.verbose ?? false;
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`  ${message}`);
    }
  }

  async validateRepository(repoPath: string, options: ValidateOptions = {}): Promise<ValidationResult> {
    const result: ValidationResult = {
      repository: repoPath,
      valid: false,
      hasReleases: false,
      releases: [],
      errors: [],
    };

    try {
      const { owner, repo } = this.github.parseRepoPath(repoPath);

      // Fetch repository info if full mode is enabled
      if (options.full) {
        this.log(`Fetching repository info for ${owner}/${repo}...`);
        result.githubInfo = await this.github.getRepository(owner, repo);
      }

      this.log(`Fetching releases for ${owner}/${repo}...`);

      const releases = await this.github.getReleases(owner, repo);

      if (releases.length === 0) {
        result.errors.push('No releases found');
        return result;
      }

      result.hasReleases = true;
      this.log(`Found ${releases.length} release(s)`);

      // Determine which releases to check
      let releasesToCheck: GitHubRelease[];

      if (options.release === '*') {
        // Check all releases
        releasesToCheck = releases;
        this.log(`Checking all ${releases.length} releases`);
      } else if (options.release) {
        // Check specific release by tag name
        const specificRelease = releases.find(r => r.tag_name === options.release);
        if (!specificRelease) {
          result.errors.push(`Release "${options.release}" not found. Available: ${releases.map(r => r.tag_name).join(', ')}`);
          return result;
        }
        releasesToCheck = [specificRelease];
        this.log(`Checking specific release: ${options.release}`);
      } else {
        // Default: check releases until we find one with a matching ZIP
        releasesToCheck = releases;
        this.log(`Checking releases until first valid one found`);
      }

      for (const release of releasesToCheck) {
        // Skip releases without ZIP assets early (before downloading)
        const hasZip = release.assets.some(a => a.name.toLowerCase().endsWith('.zip'));
        if (!hasZip) {
          this.log(`Skipping ${release.tag_name}: no ZIP assets`);
          continue;
        }

        const releaseResult = await this.validateRelease(release, repo, options.full);
        result.releases.push(releaseResult);

        // Default behavior: stop on first release with a matching ZIP
        if (!options.release && releaseResult.hasMatchingZip) {
          this.log(`Found release with matching ZIP, stopping`);
          break;
        }
      }

      // Repository is valid if at least one release has a valid component
      result.valid = result.releases.some(r => r.componentValid);

      if (!result.valid) {
        if (result.releases.length === 0) {
          result.errors.push('No releases found with ZIP assets');
        } else {
          result.errors.push('No release contains a valid 4D component with matching ZIP name');
        }
      }

    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }

    return result;
  }

  private async validateRelease(release: GitHubRelease, expectedRepoName: string, includeFull?: boolean): Promise<ReleaseValidation> {
    const result: ReleaseValidation = {
      tagName: release.tag_name,
      hasMatchingZip: false,
      zipAssetName: null,
      componentValid: false,
      componentType: null,
      dependencies: null,
      errors: [],
    };

    // Include full release info if requested
    if (includeFull) {
      result.githubRelease = release;
    }

    // Find ZIP assets that match the project name
    // The ZIP should have the same name as the project (e.g., "4D-ViewPro.zip")
    const zipAssets = release.assets.filter(a =>
      a.name.toLowerCase().endsWith('.zip')
    );

    if (zipAssets.length === 0) {
      result.errors.push('No ZIP assets found in release');
      return result;
    }

    // Look for a ZIP that matches the repo name
    const matchingZip = zipAssets.find(a => {
      const nameWithoutExt = a.name.replace(/\.zip$/i, '');
      // Match exactly or match with version suffix (e.g., "4D-ViewPro-v1.0.0.zip")
      return nameWithoutExt.toLowerCase() === expectedRepoName.toLowerCase() ||
             nameWithoutExt.toLowerCase().startsWith(expectedRepoName.toLowerCase() + '-') ||
             nameWithoutExt.toLowerCase().startsWith(expectedRepoName.toLowerCase() + '_');
    });

    if (!matchingZip) {
      result.errors.push(`No ZIP file matching project name "${expectedRepoName}" found. Available: ${zipAssets.map(a => a.name).join(', ')}`);
      return result;
    }

    result.hasMatchingZip = true;
    result.zipAssetName = matchingZip.name;
    this.log(`Found matching ZIP: ${matchingZip.name}`);

    // Download and validate the ZIP
    let tempDir: string | null = null;
    try {
      tempDir = await this.zip.createTempDir();
      const zipPath = join(tempDir, matchingZip.name);

      this.log(`Downloading ${matchingZip.name}...`);
      await this.github.downloadAsset(matchingZip, zipPath);

      const extractDir = join(tempDir, 'extracted');
      this.log(`Extracting...`);
      await this.zip.extractZip(zipPath, extractDir);

      this.log(`Validating component...`);
      const componentResult = await this.component.validate(extractDir, expectedRepoName);

      result.componentValid = componentResult.valid;
      result.componentType = componentResult.componentType;
      result.dependencies = componentResult.dependencies;
      result.errors.push(...componentResult.errors);

      if (componentResult.valid) {
        this.log(`Valid ${componentResult.componentType} component found`);
      }

    } catch (err) {
      result.errors.push(`Failed to validate ZIP: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (tempDir) {
        await this.zip.cleanup(tempDir);
      }
    }

    return result;
  }
}
