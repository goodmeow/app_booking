import assert from "node:assert/strict";
import test from "node:test";
import { configureWebsocketMiddleware } from "../redux/websocket-middleware.js";

const action = (type) => Object.assign(
  (payload) => ({ type, payload }),
  { match: (candidate) => candidate.type === type }
);

const actions = {
  wsConnect: action("ws/connect"),
  wsConnected: action("ws/connected"),
  wsDisconnect: action("ws/disconnect"),
  wsConnectionLost: action("ws/lost"),
  wsJoinRoom: action("ws/join"),
  wsEmit: action("ws/emit"),
};

const fakeSocket = () => {
  const listeners = new Map();
  const managerListeners = new Map();
  return {
    connected: false,
    emitted: [],
    closed: false,
    io: { on: (event, handler) => managerListeners.set(event, handler) },
    on: (event, handler) => listeners.set(event, handler),
    emit(event, payload) { this.emitted.push([event, payload]); },
    close() { this.closed = true; },
    trigger(event, payload) { listeners.get(event)?.(payload); },
    triggerManager(event, payload) { managerListeners.get(event)?.(payload); },
  };
};

test("websocket rejoins the authenticated room and invalidates events", () => {
  const socket = fakeSocket();
  const dispatched = [];
  const state = { websocket: { socket_room_list: [] } };
  const store = {
    getState: () => state,
    dispatch: (action) => {
      dispatched.push(action);
      return action;
    },
  };
  const next = (action) => {
    if (actions.wsJoinRoom.match(action)) state.websocket.socket_room_list.push(action.payload);
    return action;
  };
  const middleware = configureWebsocketMiddleware({
    connectSocket: () => socket,
    invalidateEvents: () => ({ type: "events/invalidate" }),
    actions,
  })(store)(next);

  middleware(actions.wsJoinRoom("user@example.test"));
  middleware(actions.wsConnect());
  socket.connected = true;
  socket.trigger("connect");
  assert.deepEqual(socket.emitted, [["room:join", "user@example.test"]]);

  socket.trigger("response:event", { any: "payload" });
  assert.ok(dispatched.some((candidate) => candidate.type === "events/invalidate"));

  socket.triggerManager("reconnect");
  socket.trigger("connect");
  assert.deepEqual(socket.emitted, [
    ["room:join", "user@example.test"],
    ["room:join", "user@example.test"],
  ]);
  assert.equal(dispatched.filter((candidate) => candidate.type === "events/invalidate").length, 2);

  middleware(actions.wsDisconnect());
  assert.equal(socket.closed, true);
});
