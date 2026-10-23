import { defineConfig } from 'vite';

// Builds a reusable ESM bundle into the existing HITEL site's /sdk/ directory.
// Run AFTER the ordinary Vite frontend build to retain that site's assets.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/communication-sdk/index.ts',
      formats: ['es'],
      fileName: () => 'sdk/communication.esm.js',
    },
  },
});
