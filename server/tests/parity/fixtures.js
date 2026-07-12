import jwt from "jsonwebtoken";
import { testSecret } from "./harness.js";

export const identities = {
  admin: {
    _id: "20000000-0000-4000-8000-000000000001",
    email: "admin@example.test",
    name: "Test Admin",
    role: "ADMIN",
  },
  user: {
    _id: "20000000-0000-4000-8000-000000000002",
    email: "user@example.test",
    name: "Test User",
    role: "USER",
  },
  room: {
    _id: "30000000-0000-4000-8000-000000000001",
    email: "room-one@room.com",
    name: "Test Room One",
    role: "USER",
  },
};

export const tokens = Object.fromEntries(
  Object.entries(identities).map(([name, identity]) => [
    name,
    jwt.sign(identity, testSecret, { noTimestamp: true }),
  ])
);

export const bearer = (name) => ({
  Authorization: `Bearer ${tokens[name]}`,
  "Content-Type": "application/json",
});

export const ids = {
  event: "60000000-0000-4000-8000-000000000001",
  eventDetail: "70000000-0000-4000-8000-000000000001",
  settings: "40000000-0000-4000-8000-000000000001",
  masterCard: "50000000-0000-4000-8000-000000000001",
};
