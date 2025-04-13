import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      // This allows imports like 'import { Flow } from "flowlite"' to work
      'flowlite': resolve(__dirname, 'flowlite.js'),
      // This allows imports with relative paths to work
      '../../flowlite.js': resolve(__dirname, 'flowlite.js'),
      '../../../flowlite.js': resolve(__dirname, 'flowlite.js')
    }
  }
});
