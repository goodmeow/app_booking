import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs/promises";
import * as esbuild from "esbuild";

const sourceJSPattern = /\/client\/.*\.js$/;

const rollupPlugin = (matchers) => ({
  name: "js-in-jsx",
  async load(id) {
    if (matchers.some((matcher) => matcher.test(id))) {
      const file = await fs.readFile(id, { encoding: "utf-8" });
      return esbuild.transformSync(file, { loader: "jsx" });
    }
  },
});

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Get ports from environment
  const clientPort = parseInt(env.PORT);
  const serverPort = parseInt(env.SERVER_PORT);
  const host = env.HOST || "localhost";
  const isHttps = env.HTTPS === "true";

  return {
    base: "/", // Use absolute paths for SPA routing
    define: {
      "process.env": env,
    },
    plugins: [
      react({
        jsxRuntime: "classic",
      }),
    ],
    preview: {
      host: true,
      port: clientPort,
      https: isHttps,
      cors: false,
      proxy: {
        "/api": {
          target: `${isHttps ? "https" : "http"}://${host}:${serverPort}/api/`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/socket.io": {
          target: `${isHttps ? "wss" : "ws"}://${host}:${serverPort}`,
          ws: true,
        },
      },
    },
    server: {
      host: true,
      port: clientPort,
      https: isHttps,
      cors: false,
      proxy: {
        "/api": {
          target: `${isHttps ? "https" : "http"}://${host}:${serverPort}/api/`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/socket.io": {
          target: `${isHttps ? "wss" : "ws"}://${host}:${serverPort}`,
          ws: true,
        },
      },
    },
    build: {
      rollupOptions: {
        external: ["dotenv"],
        plugins: [rollupPlugin([sourceJSPattern])],
      },
      commonjsOptions: {
        transformMixedEsModules: true,
        ignore: ["dotenv"],
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
      },
    },
    esbuild: {
      loader: "jsx",
      include: [sourceJSPattern],
      exclude: [],
    },
  };
});
