import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('package metadata: runtime imports are declared as dependencies', () => {
  // Regression: QA-001 — extension entry imports Type from "typebox" at runtime.
  // It must be a dependency, not only a peerDependency, so package consumers can load the extension entry.
  assert.equal(typeof pkg.dependencies?.typebox, 'string');
  assert.ok(!pkg.peerDependencies?.typebox, 'typebox should not be peer-only because it is runtime-imported');
});

test('package metadata: integration test script is available for manual QA', () => {
  assert.equal(pkg.scripts?.['test:integration'], 'node --experimental-strip-types tests/integration-test.mjs');
});
