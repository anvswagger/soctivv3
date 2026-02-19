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

function manualChunks(id: string) {
  const normalizedId = id.replace(/\\/g, "/");

  if (id.includes("node_modules")) {
    if (normalizedId.includes("/node_modules/recharts/")) return "vendor-charts";
    if (normalizedId.includes("/node_modules/@supabase/")) return "vendor-supabase";
    if (normalizedId.includes("/node_modules/@tanstack/")) return "vendor-query";
    if (normalizedId.includes("/node_modules/@sentry/")) return "vendor-sentry";
    if (normalizedId.includes("/node_modules/@capacitor/")) return "vendor-capacitor";
    if (normalizedId.includes("/node_modules/date-fns/")) return "vendor-date";
    if (normalizedId.includes("/node_modules/zod/")) return "vendor-zod";
    if (normalizedId.includes("/node_modules/react-hook-form/") || normalizedId.includes("/node_modules/@hookform/")) return "vendor-forms";
    if (normalizedId.includes("/node_modules/@lottiefiles/dotlottie-react/")) return "vendor-lottie-dot";
    if (normalizedId.includes("/node_modules/@lottiefiles/react-lottie-player/")) return "vendor-lottie-player";
    if (normalizedId.includes("/node_modules/@lottiefiles/")) return "vendor-lottiefiles";
    if (normalizedId.includes("/node_modules/lottie-react/")) return "vendor-lottie-react";
    if (normalizedId.includes("/node_modules/react-router") || normalizedId.includes("/node_modules/@remix-run/router/")) return "vendor-router";
    if (normalizedId.includes("/node_modules/react/") || normalizedId.includes("/node_modules/react-dom/") || normalizedId.includes("/node_modules/scheduler/")) return "vendor-react";
    if (normalizedId.includes("/node_modules/@radix-ui/") || normalizedId.includes("/node_modules/lucide-react/") || normalizedId.includes("/node_modules/framer-motion/")) return "vendor-ui";
    return "vendor-misc";
  }

  if (id.includes("src/components/settings")) return "settings-components";
  if (id.includes("src/components/charts")) return "analytics-components";

  return undefined;
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
        // Let Rollup choose chunk boundaries to avoid circular vendor chunk dependencies.
        // Ensure consistent chunk names for caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        manualChunks,
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
