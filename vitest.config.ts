import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));


export default defineConfig({
  root: __dirname,
  test: {
    name: 'tinyland-content',
    root: __dirname,
    globals: true,
    environment: 'node',
    // Under Bazel the vitest root is the bin dir, which also holds this
    // target's own runfiles tree; without this every test file runs twice.
    exclude: [...configDefaults.exclude, '**/*.runfiles/**'],
  },
});
