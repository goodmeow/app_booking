import { findActiveRoom } from "../../features/events/event.repository.js";

export const onJoinRoom = async (socket, identifier) => {
  const room = await findActiveRoom(identifier);
  if (!room) throw new Error("Room not found");
  await socket.join(`room:${room._id}`);
  return room;
};
