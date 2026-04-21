import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

function resolveAppVersion() {
  const explicitVersion = process.env.VITE_APP_VERSION;
  if (explicitVersion) return explicitVersion;

  const commitSha = process.env.GITHUB_SHA
    ?? process.env.COMMIT_REF
    ?? process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.CF_PAGES_COMMIT_SHA
    ?? process.env.SOURCE_VERSION;
  if (commitSha) return commitSha.slice(0, 12);

  const buildId = process.env.BUILD_ID
    ?? process.env.DEPLOY_ID
    ?? process.env.NETLIFY_BUILD_ID;
  if (buildId) return buildId.slice(0, 16);

  const packageVersion = process.env.npm_package_version ?? "0.0.0";
  const buildStamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${packageVersion}-${buildStamp}`;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 3000,
    hmr: mode === "development" ? {
      clientPort: 3000,
    } : false,
  },
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(resolveAppVersion()),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Image optimization for production
    ViteImageOptimizer({
      test: /\.(jpe?g|png|gif|tiff|webp|svg|avif)$/i,
      exclude: undefined,
      include: undefined,
      includePublic: true,
      logStats: true,
      ansiColors: true,
      svg: {
        multipass: true,
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                cleanupNumericValues: false,
                removeViewBox: false,
              },
            },
          },
          'sortAttrs',
          {
            name: 'addAttributesToSVGElement',
            params: {
              attributes: [{ xmlns: 'http://www.w3.org/2000/svg' }],
            },
          },
        ],
      },
      png: {
        quality: 80,
      },
      jpeg: {
        quality: 85,
        progressive: true,
      },
      jpg: {
        quality: 85,
        progressive: true,
      },
      webp: {
        quality: 85,
        lossless: false,
      },
      avif: {
        quality: 70,
      },
      cache: true,
      cacheLocation: undefined,
    }),
    // Custom plugin to clean production index.html from development artifacts
    {
      name: 'production-cleanup',
      transformIndexHtml(html: string) {
        if (mode === 'development') return html;
        return html
          .replace(/<script[^>]*refresh\.js[^>]*><\/script>/gi, '')
          .replace(/<script[^>]*lovable[^>]*><\/script>/gi, '')
          .replace(/<meta[^>]*twitter:site[^>]*content="@Lovable"[^>]*>/gi, '')
          .replace(/<link[^>]*href="\/@vite[^>]*>/gi, '');
      }
    }
  ].filter(Boolean),
  optimizeDeps: {
    include: ["react", "react-dom", "lucide-react", "react-dom/client", "react/jsx-runtime"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    // Enable aggressive minification with esbuild
    minify: 'esbuild',
    // Disable sourcemaps in production for smaller bundle size
    sourcemap: false,
    // Chunk size warning limit
    chunkSizeWarningLimit: 500,
    // CSS optimization
    cssMinify: 'esbuild',
    cssCodeSplit: true,
    // Assets inlining threshold
    assetsInlineLimit: 8192,
    // Enable tree shaking
    treeshake: true,
    // Copy public assets optimally
    copyPublicDir: true,
    rollupOptions: {
      output: {
        // Keep deterministic names while letting Rollup infer safe chunk graphs.
        // Ensure consistent chunk names for caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) return 'assets/[name]-[hash].[ext]';
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (ext === 'css') return 'assets/css/[name]-[hash].[ext]';
          return 'assets/[ext]/[name]-[hash].[ext]';
        },
        // Manual chunk splitting for optimal caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          utils: ['lucide-react', 'clsx', 'tailwind-merge'],
        },
        // Automatically split dynamic imports
        experimentalMinChunkSize: 10000,
      },
      // External packages that shouldn't be bundled
      external: [],
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
