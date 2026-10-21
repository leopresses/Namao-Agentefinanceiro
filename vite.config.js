import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { localChatApi } from './dev/localChatApi.js'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const apiOrigin = env.APP_ORIGIN || 'https://namao-agentefinanceiro.vercel.app';
  return {
  server: {
    proxy: { '/api': { target: apiOrigin, changeOrigin: true, headers: { Origin: apiOrigin } } },
  },
  plugins: [
    localChatApi(env),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'NaMão - Agente Financeiro',
        short_name: 'NaMão',
        description: 'Seu agente financeiro pessoal com IA',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        theme_color: '#FDFBF7',
        background_color: '#FDFBF7',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo.png?v=20260901',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      }
    })
  ],
  };
})
