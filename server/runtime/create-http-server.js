import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";

export const createHttpServer = (app, config) => {
  if (!config.isHttps) return http.createServer(app);
  const keyPath = path.resolve(config.tlsKeyPath);
  const certPath = path.resolve(config.tlsCertPath);
  return https.createServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  }, app);
};
