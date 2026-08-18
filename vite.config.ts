import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

function vitePluginAnalytics(): import("vite").Plugin {
  return {
    name: "analytics-plugin",
    transformIndexHtml(html) {
      const endpoint = process.env.VITE_ANALYTICS_ENDPOINT;
      const websiteId = process.env.VITE_ANALYTICS_WEBSITE_ID;

      if (endpoint && websiteId) {
        return html.replace(
          "</body>",
          `  <script defer src="${endpoint}/umami" data-website-id="${websiteId}"></script>\n  </body>`
        );
      }
    },
  };
}

const plugins = [react(), tailwindcss(), vitePluginAnalytics()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
