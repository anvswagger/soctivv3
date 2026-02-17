// vite.config.ts
import { defineConfig } from "file:///C:/Users/imanv/soctivcrm-4/soctivcrm/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/imanv/soctivcrm-4/soctivcrm/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/imanv/soctivcrm-4/soctivcrm/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\imanv\\soctivcrm-4\\soctivcrm";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080
  },
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env.npm_package_version ?? "0.0.0")
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      // Force single React instance (fixes "Invalid hook call" / dispatcher null)
      react: path.resolve(__vite_injected_original_dirname, "./node_modules/react"),
      "react-dom": path.resolve(__vite_injected_original_dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__vite_injected_original_dirname, "./node_modules/react/jsx-runtime")
    },
    // Prevent "Invalid hook call" caused by duplicate React copies
    dedupe: ["react", "react-dom", "react/jsx-runtime"]
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"]
  },
  build: {
    // Enable minification with esbuild for faster builds
    minify: "esbuild",
    // Generate source maps only for production debugging
    sourcemap: mode === "production",
    // Chunk size warning limit
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
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
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxpbWFudlxcXFxzb2N0aXZjcm0tNFxcXFxzb2N0aXZjcm1cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGltYW52XFxcXHNvY3RpdmNybS00XFxcXHNvY3RpdmNybVxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvaW1hbnYvc29jdGl2Y3JtLTQvc29jdGl2Y3JtL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjo6XCIsXG4gICAgcG9ydDogODA4MCxcbiAgfSxcbiAgZGVmaW5lOiB7XG4gICAgJ2ltcG9ydC5tZXRhLmVudi5WSVRFX0FQUF9WRVJTSU9OJzogSlNPTi5zdHJpbmdpZnkocHJvY2Vzcy5lbnYubnBtX3BhY2thZ2VfdmVyc2lvbiA/PyAnMC4wLjAnKSxcbiAgfSxcbiAgcGx1Z2luczogW3JlYWN0KCksIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBjb21wb25lbnRUYWdnZXIoKV0uZmlsdGVyKEJvb2xlYW4pLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgICAgLy8gRm9yY2Ugc2luZ2xlIFJlYWN0IGluc3RhbmNlIChmaXhlcyBcIkludmFsaWQgaG9vayBjYWxsXCIgLyBkaXNwYXRjaGVyIG51bGwpXG4gICAgICByZWFjdDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL25vZGVfbW9kdWxlcy9yZWFjdFwiKSxcbiAgICAgIFwicmVhY3QtZG9tXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9ub2RlX21vZHVsZXMvcmVhY3QtZG9tXCIpLFxuICAgICAgXCJyZWFjdC9qc3gtcnVudGltZVwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vbm9kZV9tb2R1bGVzL3JlYWN0L2pzeC1ydW50aW1lXCIpLFxuICAgIH0sXG4gICAgLy8gUHJldmVudCBcIkludmFsaWQgaG9vayBjYWxsXCIgY2F1c2VkIGJ5IGR1cGxpY2F0ZSBSZWFjdCBjb3BpZXNcbiAgICBkZWR1cGU6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwicmVhY3QvanN4LXJ1bnRpbWVcIl0sXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwicmVhY3QvanN4LXJ1bnRpbWVcIiwgXCJAdGFuc3RhY2svcmVhY3QtcXVlcnlcIl0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgLy8gRW5hYmxlIG1pbmlmaWNhdGlvbiB3aXRoIGVzYnVpbGQgZm9yIGZhc3RlciBidWlsZHNcbiAgICBtaW5pZnk6ICdlc2J1aWxkJyxcbiAgICAvLyBHZW5lcmF0ZSBzb3VyY2UgbWFwcyBvbmx5IGZvciBwcm9kdWN0aW9uIGRlYnVnZ2luZ1xuICAgIHNvdXJjZW1hcDogbW9kZSA9PT0gJ3Byb2R1Y3Rpb24nLFxuICAgIC8vIENodW5rIHNpemUgd2FybmluZyBsaW1pdFxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgaWYgKCFpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlc1wiKSkgcmV0dXJuO1xuICAgICAgICAgIC8vIEdyb3VwIHJlbGF0ZWQgcGFja2FnZXMgZm9yIGJldHRlciBjYWNoaW5nXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwicmVjaGFydHNcIikpIHJldHVybiBcImNoYXJ0cy12ZW5kb3JcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJmcmFtZXItbW90aW9uXCIpKSByZXR1cm4gXCJtb3Rpb24tdmVuZG9yXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiQGxvdHRpZWZpbGVzXCIpIHx8IGlkLmluY2x1ZGVzKFwibG90dGllLXJlYWN0XCIpKSByZXR1cm4gXCJsb3R0aWUtdmVuZG9yXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiQHJhZGl4LXVpXCIpKSByZXR1cm4gXCJyYWRpeC12ZW5kb3JcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJAdGFuc3RhY2tcIikpIHJldHVybiBcInRhbnN0YWNrLXZlbmRvclwiO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIkBzdXBhYmFzZVwiKSkgcmV0dXJuIFwic3VwYWJhc2UtdmVuZG9yXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwicmVhY3Qtcm91dGVyXCIpKSByZXR1cm4gXCJyb3V0ZXItdmVuZG9yXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibHVjaWRlLXJlYWN0XCIpKSByZXR1cm4gXCJpY29ucy12ZW5kb3JcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJyZWFjdFwiKSkgcmV0dXJuIFwicmVhY3QtdmVuZG9yXCI7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiZGF0ZS1mbnNcIikgfHwgaWQuaW5jbHVkZXMoXCJkYXlqc1wiKSkgcmV0dXJuIFwiZGF0ZS12ZW5kb3JcIjtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJ6b2RcIikpIHJldHVybiBcInZhbGlkYXRpb24tdmVuZG9yXCI7XG4gICAgICAgICAgcmV0dXJuIFwidmVuZG9yXCI7XG4gICAgICAgIH0sXG4gICAgICAgIC8vIEVuc3VyZSBjb25zaXN0ZW50IGNodW5rIG5hbWVzIGZvciBjYWNoaW5nXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL2pzL1tuYW1lXS1baGFzaF0uanMnLFxuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9qcy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6IChhc3NldEluZm8pID0+IHtcbiAgICAgICAgICBjb25zdCBpbmZvID0gYXNzZXRJbmZvLm5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgICBjb25zdCBleHQgPSBpbmZvW2luZm8ubGVuZ3RoIC0gMV07XG4gICAgICAgICAgaWYgKGV4dCA9PT0gJ2NzcycpIHJldHVybiAnYXNzZXRzL2Nzcy9bbmFtZV0tW2hhc2hdLltleHRdJztcbiAgICAgICAgICByZXR1cm4gJ2Fzc2V0cy9bZXh0XS9bbmFtZV0tW2hhc2hdLltleHRdJztcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICAvLyBFeHRlcm5hbCBwYWNrYWdlcyB0aGF0IHNob3VsZG4ndCBiZSBidW5kbGVkXG4gICAgICBleHRlcm5hbDogW10sXG4gICAgfSxcbiAgfSxcbn0pKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBd1MsU0FBUyxvQkFBb0I7QUFDclUsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHVCQUF1QjtBQUhoQyxJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixvQ0FBb0MsS0FBSyxVQUFVLFFBQVEsSUFBSSx1QkFBdUIsT0FBTztBQUFBLEVBQy9GO0FBQUEsRUFDQSxTQUFTLENBQUMsTUFBTSxHQUFHLFNBQVMsaUJBQWlCLGdCQUFnQixDQUFDLEVBQUUsT0FBTyxPQUFPO0FBQUEsRUFDOUUsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBO0FBQUEsTUFFcEMsT0FBTyxLQUFLLFFBQVEsa0NBQVcsc0JBQXNCO0FBQUEsTUFDckQsYUFBYSxLQUFLLFFBQVEsa0NBQVcsMEJBQTBCO0FBQUEsTUFDL0QscUJBQXFCLEtBQUssUUFBUSxrQ0FBVyxrQ0FBa0M7QUFBQSxJQUNqRjtBQUFBO0FBQUEsSUFFQSxRQUFRLENBQUMsU0FBUyxhQUFhLG1CQUFtQjtBQUFBLEVBQ3BEO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsU0FBUyxhQUFhLHFCQUFxQix1QkFBdUI7QUFBQSxFQUM5RTtBQUFBLEVBQ0EsT0FBTztBQUFBO0FBQUEsSUFFTCxRQUFRO0FBQUE7QUFBQSxJQUVSLFdBQVcsU0FBUztBQUFBO0FBQUEsSUFFcEIsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sYUFBYSxJQUFJO0FBQ2YsY0FBSSxDQUFDLEdBQUcsU0FBUyxjQUFjLEVBQUc7QUFFbEMsY0FBSSxHQUFHLFNBQVMsVUFBVSxFQUFHLFFBQU87QUFDcEMsY0FBSSxHQUFHLFNBQVMsZUFBZSxFQUFHLFFBQU87QUFDekMsY0FBSSxHQUFHLFNBQVMsY0FBYyxLQUFLLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUN2RSxjQUFJLEdBQUcsU0FBUyxXQUFXLEVBQUcsUUFBTztBQUNyQyxjQUFJLEdBQUcsU0FBUyxXQUFXLEVBQUcsUUFBTztBQUNyQyxjQUFJLEdBQUcsU0FBUyxXQUFXLEVBQUcsUUFBTztBQUNyQyxjQUFJLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUN4QyxjQUFJLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUN4QyxjQUFJLEdBQUcsU0FBUyxPQUFPLEVBQUcsUUFBTztBQUNqQyxjQUFJLEdBQUcsU0FBUyxVQUFVLEtBQUssR0FBRyxTQUFTLE9BQU8sRUFBRyxRQUFPO0FBQzVELGNBQUksR0FBRyxTQUFTLEtBQUssRUFBRyxRQUFPO0FBQy9CLGlCQUFPO0FBQUEsUUFDVDtBQUFBO0FBQUEsUUFFQSxnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0IsQ0FBQyxjQUFjO0FBQzdCLGdCQUFNLE9BQU8sVUFBVSxLQUFLLE1BQU0sR0FBRztBQUNyQyxnQkFBTSxNQUFNLEtBQUssS0FBSyxTQUFTLENBQUM7QUFDaEMsY0FBSSxRQUFRLE1BQU8sUUFBTztBQUMxQixpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUE7QUFBQSxNQUVBLFVBQVUsQ0FBQztBQUFBLElBQ2I7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
