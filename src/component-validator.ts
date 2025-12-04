import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ComponentType, DependenciesJson } from './types.js';

export interface ComponentValidationResult {
  valid: boolean;
  componentType: ComponentType | null;
  dependencies: DependenciesJson | null;
  errors: string[];
}

export class ComponentValidator {
  /**
   * Validates if the extracted ZIP contains a valid 4D component.
   * A component is valid if it contains:
   * - A .4Dbase folder (database), OR
   * - A .4DZ file (compiled component), OR
   * - A Project/ folder with a .4DProject file inside
   */
  async validate(extractedDir: string, expectedName: string): Promise<ComponentValidationResult> {
    const errors: string[] = [];
    let componentType: ComponentType | null = null;
    let dependencies: DependenciesJson | null = null;

    try {
      const entries = await readdir(extractedDir, { withFileTypes: true });

      // Try to find component at root level first
      let result = await this.findComponent(extractedDir, entries);

      // If not found and there's a single directory at root (wrapper folder), look inside it
      // But NOT if that directory is itself a .4dbase folder
      if (!result.componentType) {
        const directories = entries.filter(e => e.isDirectory());
        const files = entries.filter(e => e.isFile());

        if (directories.length === 1 && files.length === 0) {
          const rootDir = directories[0];
          if (rootDir && !rootDir.name.toLowerCase().endsWith('.4dbase')) {
            const innerDir = join(extractedDir, rootDir.name);
            const innerEntries = await readdir(innerDir, { withFileTypes: true });
            result = await this.findComponent(innerDir, innerEntries);
          }
        }
      }

      componentType = result.componentType;
      dependencies = result.dependencies;

      if (!componentType) {
        errors.push('No valid 4D component found (no .4Dbase folder, .4DZ file, or Project folder with .4DProject)');
      }

    } catch (err) {
      errors.push(`Failed to validate component: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      valid: componentType !== null,
      componentType,
      dependencies,
      errors,
    };
  }

  private async findComponent(
    searchDir: string,
    entries: import('node:fs').Dirent[]
  ): Promise<{ componentType: ComponentType | null; dependencies: DependenciesJson | null }> {
    let componentType: ComponentType | null = null;
    let dependencies: DependenciesJson | null = null;

    // Check for .4Dbase folder (case-insensitive)
    const fourDBase = entries.find(e =>
      e.isDirectory() && e.name.toLowerCase().endsWith('.4dbase')
    );
    if (fourDBase) {
      componentType = '4Dbase';
      dependencies = await this.findDependencies(join(searchDir, fourDBase.name));
      return { componentType, dependencies };
    }

    // Check for .4DZ file (case-insensitive)
    const fourDZ = entries.find(e =>
      e.isFile() && e.name.toLowerCase().endsWith('.4dz')
    );
    if (fourDZ) {
      componentType = '4DZ';
      return { componentType, dependencies };
    }

    // Check for Project/ folder with .4DProject file
    const projectFolder = entries.find(e =>
      e.isDirectory() && e.name.toLowerCase() === 'project'
    );
    if (projectFolder) {
      const projectDir = join(searchDir, projectFolder.name);
      const projectContents = await readdir(projectDir, { withFileTypes: true });
      const fourDProject = projectContents.find(e =>
        e.isFile() && e.name.endsWith('.4DProject')
      );
      if (fourDProject) {
        componentType = 'Project';
        dependencies = await this.findDependencies(searchDir);
        return { componentType, dependencies };
      }
    }

    return { componentType, dependencies };
  }

  /**
   * Look for dependencies.json in Project/Sources/
   */
  private async findDependencies(baseDir: string): Promise<DependenciesJson | null> {
    const possiblePaths = [
      join(baseDir, 'Project', 'Sources', 'dependencies.json'),
      join(baseDir, 'Sources', 'dependencies.json'),
    ];

    for (const depPath of possiblePaths) {
      try {
        const content = await readFile(depPath, 'utf-8');
        return JSON.parse(content) as DependenciesJson;
      } catch {
        // File doesn't exist or can't be parsed, try next path
      }
    }

    return null;
  }
}
