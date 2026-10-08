import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = { '@shared': resolve(__dirname, 'src/shared') }

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: wfmedia: https://i.ytimg.com",
  "media-src 'self' blob: wfmedia:",
  "font-src 'self' data:",
  "connect-src 'self' wfmedia:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

/** Strict CSP in production; the dev server needs inline scripts and websockets for hot reload. */
function csp(): Plugin {
  return {
    name: 'worshipflow-csp',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const dev = !!ctx.server
        const policy = dev
          ? CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace(
              "connect-src 'self' wfmedia:",
              "connect-src 'self' wfmedia: ws://localhost:* http://localhost:*"
            )
          : CSP
        return html.replace('__CSP__', policy)
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: shared },
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: shared },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: { alias: { ...shared, '@': resolve(__dirname, 'src/renderer/src') } },
    plugins: [csp(), react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          output: resolve(__dirname, 'src/renderer/output.html')
        }
      }
    }
  }
})
