import { createSlice } from "@reduxjs/toolkit";
import { io } from "socket.io-client";
import { api } from "./api.js";

const initialState = {
  connected: false,
  status: "",
  autoReconnect: false,
  reconnected: false,
  socket_room_list: [],
  last_socket_emit: null,
};

const slice = createSlice({
  name: "websocket",
  initialState,
  reducers: {
    wsConnect: (state) => { state.status = "connecting"; },
    wsConnected: (state) => { state.connected = true; state.status = "connected"; },
    wsDisconnect: (state) => {
      state.connected = false;
      state.status = "disconnected";
      state.socket_room_list = [];
    },
    wsConnectionLost: (state, action) => {
      state.connected = false;
      state.status = action.payload || "disconnected";
    },
    wsJoinRoom: (state, action) => { state.socket_room_list = [...new Set([...state.socket_room_list, action.payload])]; },
    wsEmit: (state, action) => { state.last_socket_emit = action.payload; },
  },
});

export const { wsConnect, wsConnected, wsDisconnect, wsConnectionLost, wsJoinRoom, wsEmit } = slice.actions;
export const websocketReducer = slice.reducer;

export const websocketMiddleware = (store) => {
  let socket;
  const joinKnownRooms = () => {
    const rooms = store.getState().websocket.socket_room_list;
    rooms.forEach((room) => socket?.emit("room:join", room));
  };

  return (next) => (action) => {
    if (wsConnect.match(action) && !socket) {
      socket = io("/", { transports: ["websocket"] });
      socket.on("connect", () => {
        store.dispatch(wsConnected());
        joinKnownRooms();
      });
      socket.on("disconnect", () => store.dispatch(wsConnectionLost("disconnected")));
      socket.on("connect_error", () => store.dispatch(wsConnectionLost("connect_error")));
      socket.io.on("reconnect", () => {
        store.dispatch(wsConnected());
        store.dispatch(api.util.invalidateTags(["events"]));
      });
      socket.on("response:event", () => store.dispatch(api.util.invalidateTags(["events"])));
    } else if (wsJoinRoom.match(action) && socket?.connected) {
      socket.emit("room:join", action.payload);
    } else if (wsEmit.match(action) && socket) {
      const { event, ...payload } = action.payload;
      socket.emit(event, payload);
    } else if (wsDisconnect.match(action) && socket) {
      socket.close();
      socket = undefined;
    }
    return next(action);
  };
};
