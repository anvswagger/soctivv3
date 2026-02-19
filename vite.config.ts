import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
    host: "::",
    port: 8080,
  },
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(resolveAppVersion()),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Enable minification with esbuild for faster builds
    minify: 'esbuild',
    // Generate source maps only for production debugging
    sourcemap: mode === 'production',
    // Chunk size warning limit
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Keep deterministic names while letting Rollup infer safe chunk graphs.
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
