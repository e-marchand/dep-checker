# 4D Dependency Validator

A CLI tool to validate GitHub repositories for compatibility with 4D's Project Dependencies Manager.

## Installation

```bash
npm install
```

## Usage

### Validate a single repository

```bash
npx tsx src/index.ts --repo 4d/4D-ViewPro
```

### Validate multiple repositories from a file

```bash
npx tsx src/index.ts --file github.txt
```

The file should contain one repository per line (format: `owner/repo`):

```
4d/4D-NetKit
4d/4D-SVG
4d/4D-ViewPro
```

### Options

| Option | Description |
|--------|-------------|
| `--file, -f <path>` | Path to a file containing repository paths |
| `--repo, -r <path>` | Single repository path (e.g., `4d/4D-ViewPro`) |
| `--release <tag\|*>` | Validate specific release or `*` for all releases |
| `--verbose, -v` | Show detailed output |
| `--json` | Output results in JSON format |
| `--full` | Include full GitHub info in JSON (requires `--json`) |
| `--token, -t <token>` | GitHub API token (or set `GITHUB_TOKEN` env var) |
| `--temp-dir <path>` | Custom temporary directory for downloads |

### Examples

```bash
# Validate first release with matching ZIP (default)
npx tsx src/index.ts --repo 4d/4D-ViewPro

# Validate a specific release
npx tsx src/index.ts --repo 4d/4D-ViewPro --release 21.4

# Validate all releases
npx tsx src/index.ts --repo 4d/4D-ViewPro --release "*"

# Get JSON output
npx tsx src/index.ts --repo 4d/4D-ViewPro --json

# JSON with full GitHub info (repository + release details)
npx tsx src/index.ts --repo 4d/4D-ViewPro --json --full

# Verbose output
npx tsx src/index.ts --file github.txt --verbose
```

## Validation Criteria

A component is valid for the 4D Project Dependencies Manager if:

1. The repository exists on GitHub
2. Has at least one release with a ZIP file
3. The ZIP filename matches the project name (e.g., `4D-ViewPro.zip`)
4. The ZIP contains a valid 4D component:
   - A `.4Dbase` folder, OR
   - A `.4DZ` file, OR
   - A `Project/` folder with a `.4DProject` file

Optionally, the component may declare dependencies in `Project/Sources/dependencies.json`.

## JSON Output

When using `--json`, the output format is:

```json
{
  "summary": {
    "total": 1,
    "valid": 1,
    "invalid": 0
  },
  "results": [
    {
      "repository": "4d/4D-ViewPro",
      "valid": true,
      "hasReleases": true,
      "releases": [
        {
          "tagName": "21.4",
          "hasMatchingZip": true,
          "zipAssetName": "4D-ViewPro.zip",
          "componentValid": true,
          "componentType": "4Dbase",
          "dependencies": null,
          "errors": []
        }
      ],
      "errors": []
    }
  ]
}
```

When using `--json --full`, additional fields are included:

- `githubInfo`: Full repository metadata (description, stars, forks, license, topics, dates, etc.)
- `githubRelease`: Full release metadata for each validated release (author, dates, body, all assets, etc.)

## License

MIT
