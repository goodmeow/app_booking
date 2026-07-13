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
    socket.join(socket.principal.kind === "kiosk"
      ? `room:${socket.principal.roomId}`
      : `user:${socket.principal._id}`);
    initSocket(io, socket);
  });
};

export default webSocket;
