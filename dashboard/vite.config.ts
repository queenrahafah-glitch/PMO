import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `--mode singlefile` inlines all JS/CSS into one self-contained index.html
// (for hosting on platforms where a bundle of separate assets is awkward, or
// for opening the dashboard directly). The default build is unchanged.
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
}))
