import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'ag-grid-community/styles': path.resolve(__dirname, 'node_modules/ag-grid-community/styles')
    }
  },
  optimizeDeps: {
    include: ['ag-grid-react', 'ag-grid-community']
  },
  envDir: './',
  define: {
    __ENV__: JSON.stringify(process.env)
  }
})
