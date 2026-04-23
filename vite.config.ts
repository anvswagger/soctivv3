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
    // On Cloudflare Pages, don't replace env vars so they can be injected at runtime
    ...(process.env.CF_PAGES ? {
      "import.meta.env": "window.__env__ || {}",
    } : {}),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Image optimization for production - optimized settings
    !process.env.CF_PAGES && ViteImageOptimizer({
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
        effort: 9,
      },
      jpeg: {
        quality: 82,
        progressive: true,
        effort: 9,
      },
      jpg: {
        quality: 82,
        progressive: true,
        effort: 9,
      },
      webp: {
        quality: 80,
        lossless: false,
        effort: 6,
      },
      avif: {
        quality: 65,
        effort: 9,
      },
      cache: true,
      cacheLocation: undefined,
    }),
    // Custom plugin to clean production index.html from development artifacts
    {
      name: 'production-cleanup',
      transformIndexHtml(html: string) {
        if (mode === 'development') return html;
        let finalHtml = html
          .replace(/<script[^>]*refresh\.js[^>]*><\/script>/gi, '')
          .replace(/<script[^>]*lovable[^>]*><\/script>/gi, '')
          .replace(/<meta[^>]*twitter:site[^>]*content="@Lovable"[^>]*>/gi, '')
          .replace(/<link[^>]*href="\/@vite[^>]*>/gi, '');
          
        return finalHtml.replace(
          /<link(?=[^>]*rel="stylesheet")[^>]*href="([^"]+\.css)"[^>]*>/gi,
          (match, href) => `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">`
        );
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
    // Enable aggressive minification with esbuild - maximum optimization
    minify: 'esbuild',
    esbuild: {
      target: 'es2020',
      drop: ['console', 'debugger'],
      legalComments: 'none',
      treeShaking: true,
    },
    // Disable sourcemaps in production for smaller bundle size
    sourcemap: false,
    // Chunk size warning limit
    chunkSizeWarningLimit: 500,
    // CSS optimization
    cssMinify: 'esbuild',
    cssCodeSplit: true,
    // Assets inlining threshold - increased for better caching
    assetsInlineLimit: 4096,
    // Enable tree shaking with maximum aggressiveness
    treeshake: {
      preset: 'smallest',
      moduleSideEffects: 'no-external',
    },
    // Copy public assets optimally
    copyPublicDir: true,
    // Don't preload all chunks on initial page load
    modulePreload: false,
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
          if (['webp', 'avif', 'jpg', 'jpeg', 'png', 'svg'].includes(ext)) return 'assets/images/[name]-[hash].[ext]';
          if (['woff2', 'woff', 'ttf'].includes(ext)) return 'assets/fonts/[name]-[hash].[ext]';
          return 'assets/[ext]/[name]-[hash].[ext]';
        },
        // Manual chunk splitting for optimal caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          utils: ['clsx', 'tailwind-merge'],
          landing: ['./src/pages/Landing.tsx'],
        },
        // Automatically split dynamic imports
        experimentalMinChunkSize: 10000,
        // More aggressive optimization
        hoistTransitiveImports: true,
        generatedCode: {
          preset: 'es2015',
          arrowFunctions: true,
          objectShorthand: true,
        },
      },
      // External packages that shouldn't be bundled
      external: [],
    },
    commonjsOptions: {
      transformMixedEsModules: true,
      strictRequires: true,
    },
    // Optimize for landing page delivery
    target: 'es2020',
    reportCompressedSize: true,
  },
}));
