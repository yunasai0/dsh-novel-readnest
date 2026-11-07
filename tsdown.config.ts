import { defineConfig } from 'tsdown';
import { fileURLToPath } from 'node:url';

export default defineConfig([
  {
    entry: {
      host: 'src/host.ts',
      agent: 'src/agent.ts',
      pruner: 'src/result-pruner.ts',
      compaction: 'src/compaction.ts',
    },
    outDir: 'lib',
    format: 'esm',
    target: 'node24',
    alias: { '@': fileURLToPath(new URL('./vendor/readest/apps/readest-app/src', import.meta.url)) },
    define: {
      'process.env.DSH_NOVEL_READER_HOST': '"1"',
      'process.env.NEXT_PUBLIC_APP_PLATFORM': '"web"',
      'process.env.WS_NO_BUFFER_UTIL': '"1"',
      'process.env.WS_NO_UTF_8_VALIDATE': '"1"',
    },
    fixedExtension: true,
  },
  {
    entry: { client: 'src/client.ts' },
    outDir: 'lib',
    platform: 'browser',
    format: 'cjs',
    external: ['react', 'react/jsx-runtime'],
    fixedExtension: true,
    clean: false,
    banner:
      'window.__ModuleLoader__.load({ id: "dsh-novel-readnest", factory(require) { const module = { exports: {} }; const exports = module.exports;',
    footer: 'return module.exports; } });',
  },
]);
