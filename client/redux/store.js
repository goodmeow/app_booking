import { configureStore } from "@reduxjs/toolkit";
import { api } from "./api.js";
import { websocketMiddleware, websocketReducer } from "./websocket.js";
import "./services/users.js";
import "./services/rooms.js";
import "./services/events.js";
import "./services/settings.js";
import "./services/kiosk-devices.js";

const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    websocket: websocketReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).concat(
      api.middleware,
      websocketMiddleware
    ),
});

export default store;
