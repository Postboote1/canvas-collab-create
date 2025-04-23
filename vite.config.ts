import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    proxy: {
      '/peerjs': {
        target: 'http://localhost:9001',
        ws: true,
        changeOrigin: true
      }
    },
    host: "::",
    port: 8080,
    // Enable mobile testing by making the server accessible on your local network
    hmr: {
      host: 'localhost',
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase'
    }
  }
}));
