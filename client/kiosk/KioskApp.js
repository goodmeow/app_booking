import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { io } from "socket.io-client";
import { useHistory } from "react-router-dom";
import {
  authenticateKiosk,
  deprovisionKiosk,
  fetchKioskContext,
  fetchKioskSchedule,
  refreshKioskSession,
} from "./kiosk-api.js";
import { clearKioskSession, readKioskSession, saveKioskSession } from "./kiosk-session.js";
import { deriveKioskState, formatKioskDate, formatKioskTime, kioskDayRange, kioskPalette } from "./kiosk-state.js";

const KioskSignin = ({ onAuthenticated }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deviceName, setDeviceName] = useState("Meeting Room Tablet");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await authenticateKiosk({ email, password, deviceName });
      saveKioskSession(session);
      setLoading(false);
      onAuthenticated(session);
      return;
    } catch (reason) {
      setError(reason.message);
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#07111f", display: "grid", placeItems: "center", p: 3 }}>
      <Paper component="form" onSubmit={submit} elevation={16} sx={{ width: "100%", maxWidth: 520, p: 5, borderRadius: 4 }}>
        <Typography variant="overline" color="primary" sx={{ letterSpacing: 3 }}>360 SCHEDULER</Typography>
        <Typography variant="h3" sx={{ mt: 1, mb: 1, fontWeight: 800 }}>Room Kiosk</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Provision this tablet with its meeting-room account.</Typography>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <TextField
          autoFocus
          fullWidth
          required
          label="Room email or username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          margin="normal"
        />
        <TextField
          fullWidth
          required
          label="Device name"
          value={deviceName}
          onChange={(event) => setDeviceName(event.target.value)}
          margin="normal"
          inputProps={{ maxLength: 80 }}
        />
        <TextField
          fullWidth
          required
          type="password"
          label="Room password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          margin="normal"
        />
        <Button fullWidth size="large" type="submit" variant="contained" disabled={loading} sx={{ mt: 3, py: 1.5 }}>
          {loading ? "Connecting..." : "Connect kiosk"}
        </Button>
      </Paper>
    </Box>
  );
};

const ScheduleItem = ({ event, now }) => {
  const active = new Date(event.start) <= now && now < new Date(event.end);
  const past = new Date(event.end) <= now;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "110px minmax(0, 1fr)", gap: 2, py: 2, opacity: past ? 0.45 : 1 }}>
      <Box>
        <Typography variant="h6" fontWeight={800}>{formatKioskTime(event.start)}</Typography>
        <Typography variant="body2" color="text.secondary">{formatKioskTime(event.end)}</Typography>
      </Box>
      <Box sx={{ borderLeft: 4, borderColor: active ? "error.main" : "primary.main", pl: 2, minWidth: 0 }}>
        <Typography variant="h6" noWrap>{event.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {active ? "Occupied now" : "Reserved"}
        </Typography>
      </Box>
    </Box>
  );
};

const KioskDisplay = ({ session, onDeprovision, onSessionUpdate }) => {
  const [context, setContext] = useState({ room: session.room, device: session.device, settings: {} });
  const [events, setEvents] = useState([]);
  const [scheduleFresh, setScheduleFresh] = useState(false);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const changeRoomTimer = useRef(null);
  const refreshPromise = useRef(null);
  const latestSession = useRef(session);
  const mounted = useRef(true);
  const loadSequence = useRef(0);

  useEffect(() => { latestSession.current = session; }, [session]);
  useEffect(() => () => { mounted.current = false; }, []);

  const refreshAccess = useCallback(async (staleToken) => {
    if (latestSession.current.token !== staleToken) return latestSession.current;
    if (!refreshPromise.current) {
      refreshPromise.current = refreshKioskSession(latestSession.current.refreshToken)
        .then(async (nextSession) => {
          if (!mounted.current) {
            try { await deprovisionKiosk(nextSession.token); } catch {}
            const error = new Error("Kiosk deprovisioned");
            error.status = 401;
            throw error;
          }
          latestSession.current = nextSession;
          saveKioskSession(nextSession);
          onSessionUpdate(nextSession);
          return nextSession;
        })
        .finally(() => { refreshPromise.current = null; });
    }
    return refreshPromise.current;
  }, [onSessionUpdate]);

  const withRefresh = useCallback(async (operation) => {
    const accessToken = latestSession.current.token;
    try {
      return await operation(accessToken);
    } catch (reason) {
      if (reason?.status !== 401) throw reason;
      const nextSession = await refreshAccess(accessToken);
      return operation(nextSession.token);
    }
  }, [refreshAccess, session.token]);

  const handleUnauthorized = useCallback((reason) => {
    if (reason?.status === 401) {
      clearKioskSession();
      onDeprovision();
      return true;
    }
    return false;
  }, [onDeprovision]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const requestSequence = ++loadSequence.current;
    const canApply = () => mounted.current && requestSequence === loadSequence.current;
    if (!quiet && mounted.current) setLoading(true);
    try {
      const [nextContext, nextEvents] = await Promise.all([
        withRefresh((token) => fetchKioskContext(token)),
        withRefresh((token) => fetchKioskSchedule(token, kioskDayRange(new Date()))),
      ]);
      if (!canApply()) return;
      setContext(nextContext);
      setEvents(Array.isArray(nextEvents) ? nextEvents : []);
      setScheduleFresh(true);
      setError("");
      setLoading(false);
    } catch (reason) {
      if (!canApply()) return;
      setScheduleFresh(false);
      if (handleUnauthorized(reason)) return;
      setError(reason.message);
      setLoading(false);
    }
  }, [handleUnauthorized, withRefresh]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    const refresh = setInterval(() => load({ quiet: true }), 60_000);
    return () => { clearInterval(clock); clearInterval(refresh); };
  }, [load]);
  useEffect(() => {
    const socket = io("/", { transports: ["websocket"], auth: { token: session.token } });
    const setConnection = (value) => { if (mounted.current) setConnected(value); };
    socket.on("connect", () => setConnection(true));
    socket.on("disconnect", () => setConnection(false));
    socket.on("connect_error", () => setConnection(false));
    socket.on("response:event", () => load({ quiet: true }));
    socket.on("response:kiosk-config", () => load({ quiet: true }));
    return () => socket.close();
  }, [load, session.token]);
  useEffect(() => () => clearTimeout(changeRoomTimer.current), []);

  const state = useMemo(
    () => scheduleFresh ? deriveKioskState(events, context.settings, now) : { mode: "unknown", current: null, next: null },
    [context.settings, events, now, scheduleFresh]
  );
  const palette = kioskPalette[state.mode];
  const ledChipColor = {
    occupied: "error",
    upcoming: "warning",
    available: "success",
    unknown: "default",
  }[state.mode] || "default";
  const featured = state.current || state.next;

  const cancelChangeRoom = () => {
    clearTimeout(changeRoomTimer.current);
    changeRoomTimer.current = null;
  };

  const armChangeRoom = () => {
    cancelChangeRoom();
    changeRoomTimer.current = setTimeout(onDeprovision, 2500);
  };

  if (loading) return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#07111f" }}><CircularProgress /></Box>;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#07111f", color: "common.white", p: { xs: 2, md: 3 }, overflow: "hidden" }}>
      <Box sx={{ maxWidth: 1500, mx: "auto" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: 3, opacity: 0.7 }}>360 SCHEDULER · ROOM KIOSK</Typography>
            <Typography variant="h4" fontWeight={800}>{context.room.name}</Typography>
            <Typography sx={{ opacity: 0.7 }}>{[context.room.building, context.room.floor && `Floor ${context.room.floor}`].filter(Boolean).join(" · ")}</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {context.device?.nfcEnabled ? <Chip label="NFC" color="info" variant="outlined" sx={{ color: "white" }} /> : null}
            {context.device?.ledEnabled ? <Chip label={`LED · ${palette.label}`} color={ledChipColor} variant="outlined" sx={{ color: "white" }} /> : null}
            <Chip label={connected ? "LIVE" : "OFFLINE"} color={connected ? "success" : "default"} variant="outlined" sx={{ color: "white" }} />
            <Button color="inherit" onClick={() => document.documentElement.requestFullscreen?.()}>Fullscreen</Button>
            <Button
              color="inherit"
              onPointerDown={armChangeRoom}
              onPointerUp={cancelChangeRoom}
              onPointerLeave={cancelChangeRoom}
              onPointerCancel={cancelChangeRoom}
            >Hold to change room</Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.8fr) minmax(360px, 1fr)" }, gap: 3 }}>
          <Paper sx={{ minHeight: { md: "calc(100vh - 150px)" }, p: { xs: 3, md: 5 }, borderRadius: 5, color: "common.white", background: `linear-gradient(145deg, ${palette.main}, ${palette.dark})`, display: "flex", flexDirection: "column" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Typography variant="h2" fontWeight={900} sx={{ letterSpacing: 2 }}>{palette.label}</Typography>
              <Box textAlign="right">
                <Typography variant="h2" fontWeight={300}>{formatKioskTime(now)}</Typography>
                <Typography sx={{ opacity: 0.85 }}>{formatKioskDate(now)}</Typography>
              </Box>
            </Stack>

            <Box sx={{ flex: 1, display: "grid", alignContent: "center", py: 5 }}>
              {state.mode === "unknown" ? (
                <>
                  <Typography variant="h3" fontWeight={800}>Schedule unavailable</Typography>
                  <Typography variant="h6" sx={{ mt: 2, opacity: 0.85 }}>Do not assume this room is free. Check the server connection.</Typography>
                </>
              ) : featured ? (
                <>
                  <Typography variant="overline" sx={{ letterSpacing: 2, opacity: 0.8 }}>
                    {state.current ? "Current meeting" : "Next meeting"}
                  </Typography>
                  <Typography variant="h3" fontWeight={800} sx={{ mt: 1 }}>{featured.title}</Typography>
                  <Typography variant="h5" sx={{ mt: 2, opacity: 0.9 }}>
                    {formatKioskTime(featured.start)} – {formatKioskTime(featured.end)}
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="h3" fontWeight={800}>Room is ready</Typography>
                  <Typography variant="h6" sx={{ mt: 2, opacity: 0.8 }}>No more meetings scheduled today.</Typography>
                </>
              )}
            </Box>

          </Paper>

          <Paper sx={{ minHeight: { md: "calc(100vh - 150px)" }, maxHeight: { md: "calc(100vh - 150px)" }, p: 3, borderRadius: 5, overflow: "auto" }}>
            <Typography variant="h4" fontWeight={800}>Today</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>{events.length} scheduled meeting{events.length === 1 ? "" : "s"}</Typography>
            {events.length ? events.map((event) => <ScheduleItem key={event.id} event={event} now={now} />) : (
              <Box sx={{ py: 8, textAlign: "center" }}><Typography color="text.secondary">Schedule is empty.</Typography></Box>
            )}
          </Paper>
        </Box>
      </Box>

    </Box>
  );
};

const KioskApp = ({ forceProvision = false }) => {
  const history = useHistory();
  const [session, setSession] = useState(() => readKioskSession());
  const [resetting, setResetting] = useState(forceProvision);

  const revokeSession = useCallback(async (target) => {
    try {
      await deprovisionKiosk(target.token);
    } catch (reason) {
      if (reason?.status !== 401 || !target.refreshToken) return;
      try {
        const refreshed = await refreshKioskSession(target.refreshToken);
        await deprovisionKiosk(refreshed.token);
      } catch {}
    }
  }, []);

  const clearProvisioning = useCallback(async () => {
    const target = session;
    clearKioskSession();
    setSession(null);
    if (target) await revokeSession(target);
  }, [revokeSession, session]);

  useEffect(() => {
    if (!forceProvision) return;
    let active = true;
    (async () => {
      await clearProvisioning();
      if (active) setResetting(false);
    })();
    return () => { active = false; };
  }, []);

  const completeProvision = (nextSession) => {
    setSession(nextSession);
    if (forceProvision) history.replace("/kiosk");
  };
  if (resetting) return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "#07111f" }}><CircularProgress /></Box>;
  if (!session) return <KioskSignin onAuthenticated={completeProvision} />;
  return <KioskDisplay session={session} onSessionUpdate={setSession} onDeprovision={clearProvisioning} />;
};

export default KioskApp;
