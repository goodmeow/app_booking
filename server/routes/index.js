import express from "express";
import authRoutes, { doorRoute } from "../features/auth/auth.routes.js";
import eventRoutes from "../features/events/event.routes.js";
import kioskRoutes from "../features/kiosk/kiosk.routes.js";
import roomRoutes from "../features/rooms/room.routes.js";
import settingRoutes from "../features/settings/setting.routes.js";
import userRoutes from "../features/users/user.routes.js";

const router = express.Router();

// Liveness probe for systemd/nginx without credentials. It deliberately exposes
// no information: only a sign that the listener is up and the response is JSON.
router.get("/health", (req, res) => res.json({ ok: true }));

router.use("/auth", authRoutes);
router.use("/events", eventRoutes);
router.use("/kiosk", kioskRoutes);
router.use("/users", userRoutes);
router.use("/rooms", roomRoutes);
router.use("/settings", settingRoutes);
router.post("/door-open", ...doorRoute);

export default router;
