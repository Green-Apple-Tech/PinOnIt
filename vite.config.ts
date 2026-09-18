/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      minify: false,
      includeAssets: ['pinonit_logo.png'],
      manifest: {
        name: 'PinOnIt',
        short_name: 'PinOnIt',
        description: 'Run your business by text.',
        theme_color: '#5864C6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/pinonit_logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pinonit_logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Static hashed assets only. Never precache HTML (SPA shell, seo-static, guest pages).
        globPatterns: ['assets/**/*.{js,css}', 'pinonit_logo.png'],
        globIgnores: ['**/seo-static/**', '**/embed.js', '**/screenshots/**', '**/Screenshot*'],
        // Plugin defaults navigateFallback to index.html; deny every navigation so
        // /d /q /r /c /s /poll, prerendered intent pages, and API/Supabase stay on the network.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/.*/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10_000,
    hookTimeout: 60_000,
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
