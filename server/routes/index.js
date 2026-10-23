import express from "express";
import authRoutes, { doorRoute } from "../features/auth/auth.routes.js";
import eventRoutes from "../features/events/event.routes.js";
import kioskRoutes from "../features/kiosk/kiosk.routes.js";
import roomRoutes from "../features/rooms/room.routes.js";
import settingRoutes from "../features/settings/setting.routes.js";
import userRoutes from "../features/users/user.routes.js";

const router = express.Router();

// Probe hidup untuk systemd/nginx tanpa kredensial. Sengaja tidak membuka
// informasi apa pun: cukup tanda bahwa listener menyala dan responsnya JSON.
router.get("/health", (req, res) => res.json({ ok: true }));

router.use("/auth", authRoutes);
router.use("/events", eventRoutes);
router.use("/kiosk", kioskRoutes);
router.use("/users", userRoutes);
router.use("/rooms", roomRoutes);
router.use("/settings", settingRoutes);
router.post("/door-open", ...doorRoute);

export default router;
