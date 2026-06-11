import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function customAssetResolver() {
  return {
    name: 'custom-asset-resolver',
    resolveId(id) {
      if (id.startsWith('custom:asset/')) {
        const filename = id.replace('custom:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  server: {
    port: 3000,
    host: true,
  },
  plugins: [
    customAssetResolver(),
    // The React and Tailwind plugins are both required, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
