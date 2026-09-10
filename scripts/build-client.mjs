import { build } from 'esbuild';

const ID = 'dsh-lexiforge';
const EXTERNALS = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
];

await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/client/index.js',
  external: EXTERNALS,
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: {
    js: `var module = { exports: {} }; var exports = module.exports; window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
  },
  footer: { js: 'return module.exports; } });' },
  logLevel: 'info',
});
