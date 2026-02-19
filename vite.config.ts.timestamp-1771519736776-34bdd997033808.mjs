// vite.config.ts
import { defineConfig } from "file:///C:/Users/imanv/SOCTIV_V2/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/imanv/SOCTIV_V2/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/imanv/SOCTIV_V2/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\imanv\\SOCTIV_V2";
function resolveAppVersion() {
  const explicitVersion = process.env.VITE_APP_VERSION;
  if (explicitVersion) return explicitVersion;
  const commitSha = process.env.GITHUB_SHA ?? process.env.COMMIT_REF ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? process.env.SOURCE_VERSION;
  if (commitSha) return commitSha.slice(0, 12);
  const buildId = process.env.BUILD_ID ?? process.env.DEPLOY_ID ?? process.env.NETLIFY_BUILD_ID;
  if (buildId) return buildId.slice(0, 16);
  const packageVersion = process.env.npm_package_version ?? "0.0.0";
  const buildStamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${packageVersion}-${buildStamp}`;
}
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      clientPort: 8080
    }
  },
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(resolveAppVersion())
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  optimizeDeps: {
    include: ["react", "react-dom", "lucide-react"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    },
    dedupe: ["react", "react-dom"]
  },
  build: {
    // Enable minification with esbuild for faster builds
    minify: "esbuild",
    // Generate source maps only for production debugging
    sourcemap: mode === "production",
    // Chunk size warning limit
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Keep deterministic names while letting Rollup infer safe chunk graphs.
        // Ensure consistent chunk names for caching
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) return "assets/[name]-[hash].[ext]";
          const info = assetInfo.name.split(".");
          const ext = info[info.length - 1];
          if (ext === "css") return "assets/css/[name]-[hash].[ext]";
          return "assets/[ext]/[name]-[hash].[ext]";
        }
      },
      // External packages that shouldn't be bundled
      external: []
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxpbWFudlxcXFxTT0NUSVZfVjJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGltYW52XFxcXFNPQ1RJVl9WMlxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvaW1hbnYvU09DVElWX1YyL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XG5cbmZ1bmN0aW9uIHJlc29sdmVBcHBWZXJzaW9uKCkge1xuICBjb25zdCBleHBsaWNpdFZlcnNpb24gPSBwcm9jZXNzLmVudi5WSVRFX0FQUF9WRVJTSU9OO1xuICBpZiAoZXhwbGljaXRWZXJzaW9uKSByZXR1cm4gZXhwbGljaXRWZXJzaW9uO1xuXG4gIGNvbnN0IGNvbW1pdFNoYSA9IHByb2Nlc3MuZW52LkdJVEhVQl9TSEFcbiAgICA/PyBwcm9jZXNzLmVudi5DT01NSVRfUkVGXG4gICAgPz8gcHJvY2Vzcy5lbnYuVkVSQ0VMX0dJVF9DT01NSVRfU0hBXG4gICAgPz8gcHJvY2Vzcy5lbnYuQ0ZfUEFHRVNfQ09NTUlUX1NIQVxuICAgID8/IHByb2Nlc3MuZW52LlNPVVJDRV9WRVJTSU9OO1xuICBpZiAoY29tbWl0U2hhKSByZXR1cm4gY29tbWl0U2hhLnNsaWNlKDAsIDEyKTtcblxuICBjb25zdCBidWlsZElkID0gcHJvY2Vzcy5lbnYuQlVJTERfSURcbiAgICA/PyBwcm9jZXNzLmVudi5ERVBMT1lfSURcbiAgICA/PyBwcm9jZXNzLmVudi5ORVRMSUZZX0JVSUxEX0lEO1xuICBpZiAoYnVpbGRJZCkgcmV0dXJuIGJ1aWxkSWQuc2xpY2UoMCwgMTYpO1xuXG4gIGNvbnN0IHBhY2thZ2VWZXJzaW9uID0gcHJvY2Vzcy5lbnYubnBtX3BhY2thZ2VfdmVyc2lvbiA/PyBcIjAuMC4wXCI7XG4gIGNvbnN0IGJ1aWxkU3RhbXAgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkucmVwbGFjZSgvWy06LlRaXS9nLCAnJykuc2xpY2UoMCwgMTQpO1xuICByZXR1cm4gYCR7cGFja2FnZVZlcnNpb259LSR7YnVpbGRTdGFtcH1gO1xufVxuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogXCI6OlwiLFxuICAgIHBvcnQ6IDgwODAsXG4gICAgaG1yOiB7XG4gICAgICBjbGllbnRQb3J0OiA4MDgwLFxuICAgIH0sXG4gIH0sXG4gIGRlZmluZToge1xuICAgIFwiaW1wb3J0Lm1ldGEuZW52LlZJVEVfQVBQX1ZFUlNJT05cIjogSlNPTi5zdHJpbmdpZnkocmVzb2x2ZUFwcFZlcnNpb24oKSksXG4gIH0sXG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBtb2RlID09PSBcImRldmVsb3BtZW50XCIgJiYgY29tcG9uZW50VGFnZ2VyKCldLmZpbHRlcihCb29sZWFuKSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgaW5jbHVkZTogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIiwgXCJsdWNpZGUtcmVhY3RcIl0sXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgfSxcbiAgICBkZWR1cGU6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCJdLFxuICB9LFxuICBidWlsZDoge1xuICAgIC8vIEVuYWJsZSBtaW5pZmljYXRpb24gd2l0aCBlc2J1aWxkIGZvciBmYXN0ZXIgYnVpbGRzXG4gICAgbWluaWZ5OiAnZXNidWlsZCcsXG4gICAgLy8gR2VuZXJhdGUgc291cmNlIG1hcHMgb25seSBmb3IgcHJvZHVjdGlvbiBkZWJ1Z2dpbmdcbiAgICBzb3VyY2VtYXA6IG1vZGUgPT09ICdwcm9kdWN0aW9uJyxcbiAgICAvLyBDaHVuayBzaXplIHdhcm5pbmcgbGltaXRcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDcwMCxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgLy8gS2VlcCBkZXRlcm1pbmlzdGljIG5hbWVzIHdoaWxlIGxldHRpbmcgUm9sbHVwIGluZmVyIHNhZmUgY2h1bmsgZ3JhcGhzLlxuICAgICAgICAvLyBFbnN1cmUgY29uc2lzdGVudCBjaHVuayBuYW1lcyBmb3IgY2FjaGluZ1xuICAgICAgICBjaHVua0ZpbGVOYW1lczogJ2Fzc2V0cy9qcy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdhc3NldHMvanMvW25hbWVdLVtoYXNoXS5qcycsXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiAoYXNzZXRJbmZvKSA9PiB7XG4gICAgICAgICAgaWYgKCFhc3NldEluZm8ubmFtZSkgcmV0dXJuICdhc3NldHMvW25hbWVdLVtoYXNoXS5bZXh0XSc7XG4gICAgICAgICAgY29uc3QgaW5mbyA9IGFzc2V0SW5mby5uYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgICAgY29uc3QgZXh0ID0gaW5mb1tpbmZvLmxlbmd0aCAtIDFdO1xuICAgICAgICAgIGlmIChleHQgPT09ICdjc3MnKSByZXR1cm4gJ2Fzc2V0cy9jc3MvW25hbWVdLVtoYXNoXS5bZXh0XSc7XG4gICAgICAgICAgcmV0dXJuICdhc3NldHMvW2V4dF0vW25hbWVdLVtoYXNoXS5bZXh0XSc7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgLy8gRXh0ZXJuYWwgcGFja2FnZXMgdGhhdCBzaG91bGRuJ3QgYmUgYnVuZGxlZFxuICAgICAgZXh0ZXJuYWw6IFtdLFxuICAgIH0sXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWtRLFNBQVMsb0JBQW9CO0FBQy9SLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFIaEMsSUFBTSxtQ0FBbUM7QUFLekMsU0FBUyxvQkFBb0I7QUFDM0IsUUFBTSxrQkFBa0IsUUFBUSxJQUFJO0FBQ3BDLE1BQUksZ0JBQWlCLFFBQU87QUFFNUIsUUFBTSxZQUFZLFFBQVEsSUFBSSxjQUN6QixRQUFRLElBQUksY0FDWixRQUFRLElBQUkseUJBQ1osUUFBUSxJQUFJLHVCQUNaLFFBQVEsSUFBSTtBQUNqQixNQUFJLFVBQVcsUUFBTyxVQUFVLE1BQU0sR0FBRyxFQUFFO0FBRTNDLFFBQU0sVUFBVSxRQUFRLElBQUksWUFDdkIsUUFBUSxJQUFJLGFBQ1osUUFBUSxJQUFJO0FBQ2pCLE1BQUksUUFBUyxRQUFPLFFBQVEsTUFBTSxHQUFHLEVBQUU7QUFFdkMsUUFBTSxpQkFBaUIsUUFBUSxJQUFJLHVCQUF1QjtBQUMxRCxRQUFNLGNBQWEsb0JBQUksS0FBSyxHQUFFLFlBQVksRUFBRSxRQUFRLFlBQVksRUFBRSxFQUFFLE1BQU0sR0FBRyxFQUFFO0FBQy9FLFNBQU8sR0FBRyxjQUFjLElBQUksVUFBVTtBQUN4QztBQUdBLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxPQUFPO0FBQUEsRUFDekMsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sS0FBSztBQUFBLE1BQ0gsWUFBWTtBQUFBLElBQ2Q7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixvQ0FBb0MsS0FBSyxVQUFVLGtCQUFrQixDQUFDO0FBQUEsRUFDeEU7QUFBQSxFQUNBLFNBQVMsQ0FBQyxNQUFNLEdBQUcsU0FBUyxpQkFBaUIsZ0JBQWdCLENBQUMsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUM5RSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsU0FBUyxhQUFhLGNBQWM7QUFBQSxFQUNoRDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsSUFDQSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQUEsRUFDL0I7QUFBQSxFQUNBLE9BQU87QUFBQTtBQUFBLElBRUwsUUFBUTtBQUFBO0FBQUEsSUFFUixXQUFXLFNBQVM7QUFBQTtBQUFBLElBRXBCLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQTtBQUFBO0FBQUEsUUFHTixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0IsQ0FBQyxjQUFjO0FBQzdCLGNBQUksQ0FBQyxVQUFVLEtBQU0sUUFBTztBQUM1QixnQkFBTSxPQUFPLFVBQVUsS0FBSyxNQUFNLEdBQUc7QUFDckMsZ0JBQU0sTUFBTSxLQUFLLEtBQUssU0FBUyxDQUFDO0FBQ2hDLGNBQUksUUFBUSxNQUFPLFFBQU87QUFDMUIsaUJBQU87QUFBQSxRQUNUO0FBQUEsTUFDRjtBQUFBO0FBQUEsTUFFQSxVQUFVLENBQUM7QUFBQSxJQUNiO0FBQUEsRUFDRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
