import initSocket from "./initSocket.js";
import { verifyPrincipalToken } from "../features/auth/auth.service.js";

const webSocket = async (io) => {
  const namespace = io.of("/");
  namespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.principal = await verifyPrincipalToken(token);
      next();
    } catch {
      next(new Error("Authentication required"));
    }
  });
  namespace.on("connection", (socket) => {
    socket.join(`user:${socket.principal._id}`);
    initSocket(io, socket);
  });
};

export default webSocket;
