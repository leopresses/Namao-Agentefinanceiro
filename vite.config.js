import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
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
            src: 'app_icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'app_icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
