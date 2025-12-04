#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DependencyValidator } from './validator.js';
import type { ValidationResult } from './types.js';

interface CLIOptions {
  file?: string;
  repo?: string;
  release?: string;
  verbose: boolean;
  json: boolean;
  full: boolean;
  token?: string;
  tempDir?: string;
}

function printUsage(): void {
  console.log(`
4D Dependency Manager Validator
===============================

Validates that GitHub repositories are compatible with 4D's Project Dependencies Manager.

Usage:
  npx tsx src/index.ts --file <path>         Validate repositories listed in a file
  npx tsx src/index.ts --repo <owner/repo>   Validate a single repository
  npx tsx src/index.ts --help                Show this help message

Options:
  --file, -f <path>       Path to a file containing repository paths (one per line)
  --repo, -r <path>       Single repository path (e.g., 4d/4D-ViewPro)
  --release <tag|*>       Release to validate:
                            - Omit: stop at first release with matching ZIP (default)
                            - <tag>: validate specific release (e.g., "21.4", "v1.0.0")
                            - "*": validate all releases
  --verbose, -v           Show detailed output
  --json                  Output results in JSON format
  --full                  Include full GitHub info in JSON (requires --json)
  --token, -t <token>     GitHub API token (or set GITHUB_TOKEN env var)
  --temp-dir <path>       Custom temporary directory for downloads

Examples:
  npx tsx src/index.ts --file github.txt
  npx tsx src/index.ts --repo 4d/4D-ViewPro
  npx tsx src/index.ts --repo 4d/4D-ViewPro --release 21.4
  npx tsx src/index.ts --repo 4d/4D-ViewPro --release "*"
  npx tsx src/index.ts --file github.txt --verbose

Validation Criteria:
  A component is valid if:
  1. The repository exists on GitHub
  2. Has at least one release with a ZIP file
  3. The ZIP has the same name as the project
  4. The ZIP contains a valid 4D component:
     - A .4Dbase folder, OR
     - A .4DZ file, OR
     - A Project/ folder with a .4DProject file

Optional: The component may have dependencies (Project/Sources/dependencies.json)
`);
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    verbose: false,
    json: false,
    full: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--file':
      case '-f':
        options.file = next;
        i++;
        break;
      case '--repo':
      case '-r':
        options.repo = next;
        i++;
        break;
      case '--release':
        options.release = next;
        i++;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--full':
        options.full = true;
        break;
      case '--token':
      case '-t':
        options.token = next;
        i++;
        break;
      case '--temp-dir':
        options.tempDir = next;
        i++;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }

  return options;
}

async function loadRepositoriesFromFile(filePath: string): Promise<string[]> {
  const absolutePath = resolve(filePath);
  const content = await readFile(absolutePath, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

function printResult(result: ValidationResult): void {
  const statusIcon = result.valid ? '✅' : '❌';
  console.log(`\n${statusIcon} ${result.repository}`);

  if (result.errors.length > 0 && !result.valid) {
    for (const error of result.errors) {
      console.log(`   ⚠️  ${error}`);
    }
  }

  if (result.releases.length > 0) {
    for (const release of result.releases) {
      if (release.componentValid) {
        console.log(`   📦 ${release.tagName}: ${release.componentType} component`);
        if (release.zipAssetName) {
          console.log(`      ZIP: ${release.zipAssetName}`);
        }
        if (release.dependencies?.dependencies) {
          const deps = Object.keys(release.dependencies.dependencies);
          if (deps.length > 0) {
            console.log(`      Dependencies: ${deps.join(', ')}`);
          }
        }
      } else if (release.errors.length > 0) {
        console.log(`   📦 ${release.tagName}: Invalid`);
        for (const error of release.errors) {
          console.log(`      - ${error}`);
        }
      }
    }
  }
}

function printSummary(results: ValidationResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const valid = results.filter(r => r.valid);
  const invalid = results.filter(r => !r.valid);

  console.log(`\nTotal repositories: ${results.length}`);
  console.log(`✅ Valid: ${valid.length}`);
  console.log(`❌ Invalid: ${invalid.length}`);

  if (valid.length > 0) {
    console.log('\nValid repositories:');
    for (const r of valid) {
      const types = r.releases
        .filter(rel => rel.componentValid)
        .map(rel => rel.componentType)
        .filter((v, i, a) => a.indexOf(v) === i);
      console.log(`  - ${r.repository} (${types.join(', ')})`);
    }
  }

  if (invalid.length > 0) {
    console.log('\nInvalid repositories:');
    for (const r of invalid) {
      const reason = r.errors[0] || 'Unknown error';
      console.log(`  - ${r.repository}: ${reason}`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const options = parseArgs(args);

  if (!options.file && !options.repo) {
    console.error('Error: Please specify --file or --repo');
    printUsage();
    process.exit(1);
  }

  let repositories: string[];

  if (options.file) {
    try {
      repositories = await loadRepositoriesFromFile(options.file);
      if (!options.json) {
        console.log(`Loaded ${repositories.length} repositories from ${options.file}`);
      }
    } catch (err) {
      if (options.json) {
        console.log(JSON.stringify({ error: `Error reading file: ${err instanceof Error ? err.message : String(err)}` }));
      } else {
        console.error(`Error reading file: ${err instanceof Error ? err.message : String(err)}`);
      }
      process.exit(1);
    }
  } else if (options.repo) {
    repositories = [options.repo];
  } else {
    repositories = [];
  }

  if (repositories.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ error: 'No repositories to validate' }));
    } else {
      console.error('No repositories to validate');
    }
    process.exit(1);
  }

  // Disable verbose output when using JSON format
  const validator = new DependencyValidator({
    token: options.token,
    verbose: options.json ? false : options.verbose,
    tempDir: options.tempDir,
  });
  const results: ValidationResult[] = [];

  if (!options.json) {
    const releaseMode = options.release === '*' ? 'all releases' :
                        options.release ? `release "${options.release}"` :
                        'first release with matching ZIP';
    console.log(`\nValidating repositories (${releaseMode})...\n`);
    console.log('='.repeat(60));
  }

  for (const repo of repositories) {
    if (!options.json) {
      console.log(`\nChecking ${repo}...`);
    }
    const result = await validator.validateRepository(repo, {
      release: options.release,
      full: options.json && options.full,
    });
    results.push(result);
    if (!options.json) {
      printResult(result);
    }
  }

  if (options.json) {
    const output = {
      summary: {
        total: results.length,
        valid: results.filter(r => r.valid).length,
        invalid: results.filter(r => !r.valid).length,
      },
      results,
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    printSummary(results);
  }

  // Exit with error code if any validation failed
  const hasFailures = results.some(r => !r.valid);
  process.exit(hasFailures ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
