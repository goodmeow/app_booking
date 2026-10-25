import initSocket from "./initSocket.js";
import { verifyPrincipalToken } from "../features/auth/auth.service.js";
import { verifyKioskToken } from "../features/kiosk/kiosk.service.js";

const verifySocketToken = async (token) => {
  try {
    return await verifyPrincipalToken(token);
  } catch {
    return verifyKioskToken(token);
  }
};

const webSocket = async (io) => {
  const namespace = io.of("/");
  namespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.principal = await verifySocketToken(token);
      next();
    } catch {
      next(new Error("Authentication required"));
    }
  });
  namespace.on("connection", (socket) => {
    if (socket.principal.kind === "kiosk") {
      socket.join(`room:${socket.principal.roomId}`);
      socket.join(`device:${socket.principal.deviceId}`);
    } else {
      socket.join(`user:${socket.principal._id}`);
    }
    initSocket(io, socket);
  });
};

export default webSocket;
