import { onJoinRoom } from "./controllers/event.socket.js";

const initSocket = (io, socket) => {
  socket.on("room:join", async (message, acknowledge) => {
    try {
      const room = await onJoinRoom(socket, message);
      acknowledge?.({ ok: true, room: room._id });
    } catch {
      acknowledge?.({ ok: false });
    }
  });
};

export default initSocket;
