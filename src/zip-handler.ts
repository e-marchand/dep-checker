import { createReadStream } from 'node:fs';
import { mkdir, rm, readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createUnzip, type Unzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

// Simple ZIP extraction using Node's built-in modules
// Note: For a production app, you might want to use a library like 'unzipper' or 'adm-zip'

export class ZipHandler {
  private tempDir: string;

  constructor(customTempDir?: string) {
    this.tempDir = customTempDir || join(tmpdir(), '4d-dep-validator');
  }

  async createTempDir(): Promise<string> {
    const uniqueDir = join(this.tempDir, `validate-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(uniqueDir, { recursive: true });
    return uniqueDir;
  }

  async cleanup(dir: string): Promise<void> {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  async extractZip(zipPath: string, destDir: string): Promise<void> {
    // We'll use the unzip command which is available on macOS and most Unix systems
    // For cross-platform, consider using a library like 'unzipper'
    const { spawn } = await import('node:child_process');

    return new Promise((resolve, reject) => {
      const unzip = spawn('unzip', ['-o', '-q', zipPath, '-d', destDir]);

      let stderr = '';
      unzip.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      unzip.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`unzip failed with code ${code}: ${stderr}`));
        }
      });

      unzip.on('error', (err) => {
        reject(new Error(`Failed to spawn unzip: ${err.message}`));
      });
    });
  }

  async listContents(dir: string): Promise<string[]> {
    const results: string[] = [];

    async function walk(currentDir: string, prefix: string = ''): Promise<void> {
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        results.push(relativePath);
        if (entry.isDirectory()) {
          await walk(join(currentDir, entry.name), relativePath);
        }
      }
    }

    await walk(dir);
    return results;
  }

  async readFileContent(filePath: string): Promise<string> {
    return readFile(filePath, 'utf-8');
  }
}
