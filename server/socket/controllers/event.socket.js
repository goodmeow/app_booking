import { findActiveRoom } from "../../features/events/event.repository.js";

export const onJoinRoom = async (socket, identifier) => {
  if (socket.principal?.kind === "kiosk") {
    const ownIdentifiers = [socket.principal.roomId, socket.principal.email].map(String);
    if (!ownIdentifiers.includes(String(identifier))) throw new Error("Kiosk cannot join another room");
  }
  const room = await findActiveRoom(identifier);
  if (!room) throw new Error("Room not found");
  await socket.join(`room:${room._id}`);
  return room;
};

export const onLeaveRoom = async (socket, identifier) => {
  if (socket.principal?.kind === "kiosk") throw new Error("Kiosk cannot leave its assigned room");
  const room = await findActiveRoom(identifier);
  if (!room) throw new Error("Room not found");
  await socket.leave(`room:${room._id}`);
  return room;
};
