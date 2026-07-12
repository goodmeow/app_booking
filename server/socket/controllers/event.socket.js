export const onJoinRoom = (io, socket, message) => {
  console.log(`${message} Joined room`);
  socket.join(message);
};
