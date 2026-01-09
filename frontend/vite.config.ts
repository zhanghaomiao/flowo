// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tanstackRouter from '@tanstack/router-plugin/vite';
import svgr from 'vite-plugin-svgr'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    
    // 2. React 插件
    react(),
    
    // 3. 其他插件
    svgr({
      svgrOptions: {
        icon: true,
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000', 
        changeOrigin: true,
      },
    },
  },
})