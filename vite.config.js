import fs from "node:fs/promises";
import { transform } from "esbuild";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const sourceJSPattern = /\/client\/.*\.js$/;

const jsxInJsPlugin = {
  name: "jsx-in-js",
  enforce: "pre",
  async load(id) {
    if (!sourceJSPattern.test(id)) return null;

    const source = await fs.readFile(id, "utf8");
    const result = await transform(source, {
      loader: "jsx",
      jsx: "transform",
      sourcemap: true,
      sourcefile: id,
    });

    return {
      code: result.code,
      map: result.map,
      moduleType: "js",
    };
  },
};

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Get ports from environment
  const clientPort = parseInt(env.PORT);
  const serverPort = parseInt(env.SERVER_PORT);
  const host = env.HOST || "localhost";
  const isHttps = env.HTTPS === "true";

  return {
    base: "/", // Use absolute paths for SPA routing
    plugins: [
      jsxInJsPlugin,
      react({
        jsxRuntime: "classic",
        include: sourceJSPattern,
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
      rolldownOptions: {},
    },
  };
});
