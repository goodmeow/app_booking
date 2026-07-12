import { onJoinRoom } from "./controllers/event.socket.js";

const initSocket = (io, socket) => {
  socket.on("room:join", (message) => {
    onJoinRoom(io, socket, message);
  });
};

export default initSocket;
