import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/mlproxy': {
        target: 'https://api.mercadolibre.com',
        changeOrigin: true,
        rewrite: (path) => {
           // We can't easily rewrite based on query params here
           return path;
        },
        configure: (proxy, options) => {
          proxy.on("proxyReq", (proxyReq, req, res) => {
            const url = new URL(req.url, "http://localhost");
            const targetUrl = url.searchParams.get("target");
            
            if (targetUrl) {
              const targetParsed = new URL(targetUrl);
              proxyReq.path = targetParsed.pathname + targetParsed.search;
              proxyReq.setHeader("host", "api.mercadolibre.com");
            }
          });
        }
      }
    }
  }
})
