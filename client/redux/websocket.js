import { createSlice } from "@reduxjs/toolkit";
import { io } from "socket.io-client";
import { api } from "./api.js";
import { configureWebsocketMiddleware } from "./websocket-middleware.js";
import { isAuthenticated } from "../auth/auth-helper.js";

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

export const createWebsocketMiddleware = (connectSocket = io) => configureWebsocketMiddleware({
  connectSocket,
  getToken: () => isAuthenticated()?.token,
  invalidateEvents: () => api.util.invalidateTags(["events"]),
  actions: { wsConnect, wsConnected, wsDisconnect, wsConnectionLost, wsJoinRoom, wsEmit },
});

export const websocketMiddleware = createWebsocketMiddleware();
