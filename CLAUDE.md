# CLAUDE.md - Project Guide for LLMs

## Project Overview

This is a TypeScript CLI tool that validates GitHub repositories for compatibility with 4D's Project Dependencies Manager. It checks if repositories contain properly structured 4D components that can be used as dependencies.

## Commands

```bash
npm run build          # Compile TypeScript to dist/
npm run start          # Run with tsx (pass args after --)
npm run validate       # Validate all repos in github.txt
npm run validate:verbose  # Same with detailed output
```

### CLI Usage

```bash
# Single repository (stops at first release with matching ZIP)
npx tsx src/index.ts --repo owner/repo

# File with multiple repos (one per line)
npx tsx src/index.ts --file github.txt

# Specific release
npx tsx src/index.ts --repo owner/repo --release v1.0.0

# All releases
npx tsx src/index.ts --repo owner/repo --release "*"

# Options: --verbose (-v), --token (-t) for GitHub API token
```

### Release Selection

- **Default (no --release)**: Stops at first release with a matching ZIP file
- **--release \<tag\>**: Validate a specific release by tag name
- **--release "\*"**: Validate all releases

## Architecture

```
src/
├── index.ts              # CLI entry point, argument parsing
├── types.ts              # TypeScript interfaces
├── github-client.ts      # GitHub API: fetch releases, download assets
├── zip-handler.ts        # ZIP extraction using system unzip command
├── component-validator.ts # 4D component structure validation
└── validator.ts          # Orchestrates the validation workflow
```

## 4D Component Validation Rules

A valid 4D component ZIP must contain one of:
1. **`.4dbase` folder** - 4D database format
2. **`.4DZ` file** - Compiled 4D component
3. **`Project/` folder with `.4DProject` file** - 4D project format

The ZIP filename must match the repository name (e.g., `4D-ViewPro.zip` for `4d/4D-ViewPro`).

Optional: `Project/Sources/dependencies.json` declares component dependencies.

## Key Implementation Details

- Uses native `fetch` for GitHub API calls (Node 18+)
- ZIP extraction uses system `unzip` command (macOS/Linux)
- Default: stops at first release with matching ZIP (fast validation)
- Temp files created in OS temp directory, cleaned up after validation
- Exit code 1 if any repository fails validation

## Environment Variables

- `GITHUB_TOKEN` - Optional GitHub API token for higher rate limits
