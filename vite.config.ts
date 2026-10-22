import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    plugins: [react(), {
      name: 'production-content-security-policy',
      transformIndexHtml(html) {
        if (mode !== 'pro') return html;
        // Styles remain inline for Ant Design; scripts never allow inline JS/eval.
        const policy = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'";
        return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" /><meta http-equiv="Content-Security-Policy" content="${policy}" />`);
      },
    }],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/forge': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8081',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: env.VITE_OUT_DIR || 'dist',
    },
  }
})
