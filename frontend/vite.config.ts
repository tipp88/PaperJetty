import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/ (updated for 1.3.1)
import fs from 'fs'
import path from 'path'

// Check if SSL certificates exist (for dev server only)
const keyPath = path.resolve(__dirname, '../localhost-key.pem')
const certPath = path.resolve(__dirname, '../localhost-cert.pem')
const hasSSL = fs.existsSync(keyPath) && fs.existsSync(certPath)
const packageJsonPath = path.resolve(__dirname, 'package.json')
const appVersion = fs.existsSync(packageJsonPath)
  ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).version ?? '0.0.0'
  : '0.0.0'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Document Scanner',
        short_name: 'DocuScan',
        description: 'Privacy-first mobile document scanning app',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        globIgnores: ['**/opencv/**'],
        maximumFileSizeToCacheInBytes: 3000000,
      }
    })
  ],
  server: {
    // Only use HTTPS for dev server if certificates exist
    ...(hasSSL && {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    }),
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
