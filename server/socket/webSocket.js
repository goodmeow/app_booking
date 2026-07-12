import initSocket from "./initSocket.js";

const webSocket = async (io) => {
  const namespace = io.of("/");
  namespace.on("connection", (socket) => {
    console.log("New user connected");
    socket.on("disconnect", () => {
      console.log("A user disconnected");
    });
    initSocket(io, socket);
  });
};

export default webSocket;
