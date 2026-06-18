import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createEmptyState } from './core.mjs';

export async function loadState(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return {
      ...createEmptyState(),
      ...JSON.parse(raw),
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return createEmptyState();
    }
    throw error;
  }
}

export async function saveState(filePath, state) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}
