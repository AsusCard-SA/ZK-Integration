import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('Saudi profile starts with an empty, separate Edara destination store', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'zk-saudi-'));
  try {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./src/services/edaraService.js')"], {
      cwd: new URL('../', import.meta.url),
      env: {
        ...process.env,
        EDARA_DATA_DIR: dataDir,
        EDARA_IMPORT_LEGACY: 'false',
        EDARA_SEED_ON_EMPTY: 'false',
        EDARA_API_URL: 'https://example.invalid/test',
        EDARA_API_KEY: 'test-only'
      },
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(readFileSync(join(dataDir, 'edaraServers.json'), 'utf8')).length, 0);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
