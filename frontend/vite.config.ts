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

  build: {
    // Split the heaviest libraries into separate, cacheable chunks so the
    // initial app bundle stays lean. three.js loads only with the hero/Pulse
    // scenes; recharts only with the Analytics route.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('three') || id.includes('@react-three')) return 'three'
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'charts'
          if (id.includes('@radix-ui')) return 'radix'
          if (id.includes('/motion') || id.includes('framer-motion') || id.includes('/gsap')) return 'motion'
        },
      },
    },
  },
})
