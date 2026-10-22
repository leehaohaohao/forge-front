import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Explicitly separate lab build. Never replaces the production application's entry.
export default defineConfig({ plugins:[react()], build:{outDir:'.vault-dist',rollupOptions:{input:'vault-prototype.html'}} });
