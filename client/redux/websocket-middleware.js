export const configureWebsocketMiddleware = ({
  connectSocket,
  invalidateEvents,
  actions,
}) => (store) => {
  let socket;
  const joinKnownRooms = () => {
    const rooms = store.getState().websocket.socket_room_list;
    rooms.forEach((room) => socket?.emit("room:join", room));
  };

  return (next) => (action) => {
    if (actions.wsConnect.match(action) && !socket) {
      socket = connectSocket("/", { transports: ["websocket"] });
      socket.on("connect", () => {
        store.dispatch(actions.wsConnected());
        joinKnownRooms();
      });
      socket.on("disconnect", () => store.dispatch(actions.wsConnectionLost("disconnected")));
      socket.on("connect_error", () => store.dispatch(actions.wsConnectionLost("connect_error")));
      socket.io.on("reconnect", () => {
        store.dispatch(actions.wsConnected());
        store.dispatch(invalidateEvents());
      });
      socket.on("response:event", () => store.dispatch(invalidateEvents()));
    } else if (actions.wsJoinRoom.match(action) && socket?.connected) {
      socket.emit("room:join", action.payload);
    } else if (actions.wsEmit.match(action) && socket) {
      const { event, ...payload } = action.payload;
      socket.emit(event, payload);
    } else if (actions.wsDisconnect.match(action) && socket) {
      socket.close();
      socket = undefined;
    }
    return next(action);
  };
};
