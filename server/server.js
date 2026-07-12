import fs from "node:fs";
import config from "../config/config.js";
import app from "./express.js";
import { Server } from "socket.io";
import webSocket from "./socket/webSocket.js";
import routes from "./routes/index.js";

let port = config.ssrMode ? config.port : config.serverPort;
let server;

if (config.isHttps) {
  const certificate = fs.readFileSync("cert/key.pem");
  const privateKey = fs.readFileSync("cert/key.key");
  const https = await import("https");
  server = https.createServer({ key: privateKey, cert: certificate }, app);
} else {
  const http = await import("http");
  server = http.createServer(app);
}

const io = new Server(server, {
  transports: ["websocket", "polling"],
  cors: { origin: "*", credentials: true },
});

webSocket(io);
app.use((req, res, next) => {
  req.io = io;
  next();
});
app.use("/api", routes);
app.use((err, req, res, next) => {
  if (err.name === "UnauthorizedError") {
    res.status(401).json({ error: `${err.name}: ${err.message}` });
  } else if (err) {
    res.status(400).json({ error: `${err.name}: ${err.message}` });
    console.log(err);
  } else {
    next();
  }
});

server.listen(port, (err) => {
  if (err) console.error(err);
  if (config.ssrMode) {
    console.info("Client & Server started on port %s.", config.baseUrl);
  } else {
    console.info("Server started on port %s.", config.serverBaseUrl);
  }
});
