import { defineConfig } from 'mygo-cli'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  name: 'Manga Layout Generator',
  identifier: 'com.jstdlee.mangalayout',
  version: pkg.version,
  copyright: '© 2026 Jstdlee',
  devUrl: 'http://localhost:5173',
  devCommand: 'npm run dev:web',
  buildCommand: 'npm run build:web',
  frontendDist: 'dist',
  out: 'build',
  linux: {
    maintainer: 'Jstdlee',
    comment: 'Deterministic manga panel layouts with storyboard planning tools',
    categories: ['Graphics', 'Utility'],
  },
})
