import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force single React instance (fixes "Invalid hook call" / dispatcher null)
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime"),
    },
    // Prevent "Invalid hook call" caused by duplicate React copies
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
  build: {
    // Enable minification with esbuild for faster builds
    minify: 'esbuild',
    // Generate source maps only for production debugging
    sourcemap: mode === 'production',
    // Chunk size warning limit
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Group related packages for better caching
          if (id.includes("recharts")) return "charts-vendor";
          if (id.includes("framer-motion")) return "motion-vendor";
          if (id.includes("@lottiefiles") || id.includes("lottie-react")) return "lottie-vendor";
          if (id.includes("@radix-ui")) return "radix-vendor";
          if (id.includes("@tanstack")) return "tanstack-vendor";
          if (id.includes("@supabase")) return "supabase-vendor";
          if (id.includes("react-router")) return "router-vendor";
          if (id.includes("lucide-react")) return "icons-vendor";
          if (id.includes("react")) return "react-vendor";
          if (id.includes("date-fns") || id.includes("dayjs")) return "date-vendor";
          if (id.includes("zod")) return "validation-vendor";
          return "vendor";
        },
        // Ensure consistent chunk names for caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (ext === 'css') return 'assets/css/[name]-[hash].[ext]';
          return 'assets/[ext]/[name]-[hash].[ext]';
        },
      },
      // External packages that shouldn't be bundled
      external: [],
    },
  },
}));
