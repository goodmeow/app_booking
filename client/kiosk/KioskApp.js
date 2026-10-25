import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { io } from "socket.io-client";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../components/common/LanguageSwitcher.js";
import { normalizeLanguage } from "../i18n/languages.js";
import {
  authenticateKiosk,
  checkInKioskMeeting,
  deprovisionKiosk,
  fetchKioskContext,
  fetchKioskSchedule,
  refreshKioskSession,
} from "./kiosk-api.js";
import { clearKioskSession, readKioskSession, saveKioskSession } from "./kiosk-session.js";
import { deriveKioskState, formatKioskDate, formatKioskTime, kioskDayRange, kioskPalette } from "./kiosk-state.js";

const kioskSans = "'Public Sans', system-ui, sans-serif";
const kioskSerif = "'Source Serif 4', Georgia, serif";

const KioskSignin = ({ onAuthenticated }) => {
  const { t } = useTranslation(["kiosk", "common"]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const translatedDeviceName = t("setup.defaultDeviceName");
  const defaultDeviceNameRef = useRef(translatedDeviceName);
  const [deviceName, setDeviceName] = useState(translatedDeviceName);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDeviceName((current) => (
      current === defaultDeviceNameRef.current ? translatedDeviceName : current
    ));
    defaultDeviceNameRef.current = translatedDeviceName;
  }, [translatedDeviceName]);

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
    <Box sx={{ minHeight: "100vh", bgcolor: "#07111f", display: "grid", placeItems: "center", p: 3, fontFamily: kioskSans }}>
      <Paper component="form" onSubmit={submit} elevation={16} sx={{ width: "100%", maxWidth: 520, p: 5, borderRadius: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography variant="overline" color="primary" sx={{ letterSpacing: 3 }}>{t("common:brand.name")}</Typography>
            <Typography variant="h3" sx={{ mt: 1, mb: 1, fontWeight: 800 }}>{t("setup.title")}</Typography>
          </Box>
          <LanguageSwitcher />
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 3 }}>{t("setup.description")}</Typography>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <TextField
          autoFocus
          fullWidth
          required
          label={t("setup.roomLogin")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          margin="normal"
        />
        <TextField
          fullWidth
          required
          label={t("setup.deviceName")}
          value={deviceName}
          onChange={(event) => setDeviceName(event.target.value)}
          margin="normal"
          inputProps={{ maxLength: 80 }}
        />
        <TextField
          fullWidth
          required
          type="password"
          label={t("setup.roomPassword")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          margin="normal"
        />
        <Button fullWidth size="large" type="submit" variant="contained" disabled={loading} sx={{ mt: 3, py: 1.5 }}>
          {loading ? t("setup.connecting") : t("setup.connect")}
        </Button>
      </Paper>
    </Box>
  );
};

const ScheduleItem = ({ event, now, timeZone }) => {
  const { t } = useTranslation("kiosk");
  const active = new Date(event.start) <= now && now < new Date(event.end);
  const past = new Date(event.end) <= now;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "110px minmax(0, 1fr)", gap: 2, py: 2, opacity: past ? 0.45 : 1 }}>
      <Box>
        <Typography variant="h6" fontWeight={800}>{formatKioskTime(event.start, timeZone)}</Typography>
        <Typography variant="body2" color="text.secondary">{formatKioskTime(event.end, timeZone)}</Typography>
      </Box>
      <Box sx={{ borderLeft: 4, borderColor: active ? "error.main" : "primary.main", pl: 2, minWidth: 0 }}>
        <Typography variant="h6" noWrap sx={{ fontFamily: kioskSerif, fontWeight: 600 }}>{event.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {active ? t("schedule.occupiedNow") : t("schedule.reserved")}
        </Typography>
      </Box>
    </Box>
  );
};

const KioskDisplay = ({ session, onDeprovision, onSessionUpdate }) => {
  const { i18n, t } = useTranslation(["kiosk", "common"]);
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const [context, setContext] = useState({ room: session.room, device: session.device, settings: {} });
  const [events, setEvents] = useState([]);
  const [scheduleFresh, setScheduleFresh] = useState(false);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [checkInFor, setCheckInFor] = useState(null);
  const [cardNumber, setCardNumber] = useState("");
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const [notice, setNotice] = useState("");
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
            const error = new Error(t("errors.deprovisioned"));
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
  }, [onSessionUpdate, t]);

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
      // The schedule day is decided by the server time zone, so read the context first.
      const nextContext = await withRefresh((token) => fetchKioskContext(token));
      const nextEvents = await withRefresh((token) => fetchKioskSchedule(token, kioskDayRange(new Date(), nextContext.timezone)));
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
    () => deriveKioskState(events, context.settings, now, { fresh: scheduleFresh }),
    [context.settings, events, now, scheduleFresh]
  );
  const palette = kioskPalette[state.mode];
  const paletteLabel = t(palette.labelKey);
  const ledChipColor = {
    occupied: "error",
    awaitingCheckIn: "warning",
    available: "success",
    offline: "default",
    unknown: "default",
  }[state.mode] || "default";
  const featured = state.current || state.next;

  const openCheckIn = (event) => {
    setCheckInFor(event);
    setCardNumber("");
    setCheckInError("");
    setNotice("");
  };

  const closeCheckIn = () => {
    if (checkInBusy) return;
    setCheckInFor(null);
  };

  const submitCheckIn = async (event) => {
    event.preventDefault();
    const value = cardNumber.trim();
    if (!value) {
      setCheckInError(t("checkin.cardRequired"));
      return;
    }
    setCheckInBusy(true);
    setCheckInError("");
    try {
      await withRefresh((token) => checkInKioskMeeting(token, checkInFor.id, value));
      setCheckInFor(null);
      setCardNumber("");
      setNotice(t("checkin.success"));
      await load({ quiet: true });
    } catch (reason) {
      if (!handleUnauthorized(reason)) setCheckInError(reason.message || t("errors.requestFailed"));
    } finally {
      setCheckInBusy(false);
    }
  };

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
    <Box sx={{ minHeight: "100vh", bgcolor: "#07111f", color: "common.white", p: { xs: 2, md: 3 }, overflow: "hidden", fontFamily: kioskSans }}>
      <Box sx={{ maxWidth: 1500, mx: "auto" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="overline" sx={{ letterSpacing: 3, opacity: 0.7 }}>{t("common:brand.kiosk")}</Typography>
            <Typography variant="h4" fontWeight={700} sx={{ fontFamily: kioskSerif }}>{context.room.name}</Typography>
            <Typography sx={{ opacity: 0.7 }}>{[context.room.building, context.room.floor && t("schedule.floor", { floor: context.room.floor })].filter(Boolean).join(" · ")}</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {context.device?.nfcEnabled ? <Chip label="NFC" color="info" variant="outlined" sx={{ color: "white" }} /> : null}
            {context.device?.ledEnabled ? <Chip label={`LED · ${paletteLabel}`} color={ledChipColor} variant="outlined" sx={{ color: "white" }} /> : null}
            <Chip label={connected ? t("schedule.live") : t("schedule.offline")} color={connected ? "success" : "default"} variant="outlined" sx={{ color: "white" }} />
            <LanguageSwitcher />
            <Button color="inherit" onClick={() => document.documentElement.requestFullscreen?.()}>{t("schedule.fullscreen")}</Button>
            <Button
              color="inherit"
              onPointerDown={armChangeRoom}
              onPointerUp={cancelChangeRoom}
              onPointerLeave={cancelChangeRoom}
              onPointerCancel={cancelChangeRoom}
            >{t("schedule.changeRoom")}</Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {notice ? <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice("")}>{notice}</Alert> : null}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.8fr) minmax(360px, 1fr)" }, gap: 3 }}>
          <Paper sx={{ minHeight: { md: "calc(100vh - 150px)" }, p: { xs: 3, md: 5 }, borderRadius: 5, color: "common.white", background: `linear-gradient(145deg, ${palette.main}, ${palette.dark})`, display: "flex", flexDirection: "column" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Typography variant="h2" fontWeight={700} sx={{ letterSpacing: 2, fontFamily: kioskSerif }}>{paletteLabel}</Typography>
              <Box textAlign="right">
                <Typography variant="h2" fontWeight={600} sx={{ fontFamily: kioskSerif }}>{formatKioskTime(now, context.timezone)}</Typography>
                <Typography sx={{ opacity: 0.85 }}>{formatKioskDate(now, language, context.timezone)}</Typography>
              </Box>
            </Stack>

            <Box sx={{ flex: 1, display: "grid", alignContent: "center", py: 5 }}>
              {state.mode === "offline" || state.mode === "unknown" ? (
                <>
                  <Typography variant="h3" fontWeight={800}>{t("states.offline")}</Typography>
                  <Typography variant="h6" sx={{ mt: 2, opacity: 0.85 }}>{t("schedule.offlineHelp")}</Typography>
                </>
              ) : featured ? (
                <>
                  <Typography variant="overline" sx={{ letterSpacing: 2, opacity: 0.8 }}>
                    {state.current ? t("schedule.currentMeeting") : t("schedule.nextMeeting")}
                  </Typography>
                  <Typography variant="h3" fontWeight={700} sx={{ mt: 1, fontFamily: kioskSerif }}>{featured.title}</Typography>
                  <Typography variant="h5" sx={{ mt: 2, opacity: 0.9 }}>
                    {formatKioskTime(featured.start, context.timezone)} – {formatKioskTime(featured.end, context.timezone)}
                  </Typography>
                  {state.current?.canCheckIn ? (
                    <Box sx={{ mt: 3 }}>
                      <Button variant="contained" color="inherit" size="large" onClick={() => openCheckIn(state.current)}>
                        {t("checkin.action")}
                      </Button>
                    </Box>
                  ) : null}
                </>
              ) : (
                <>
                  <Typography variant="h3" fontWeight={800}>{t("schedule.ready")}</Typography>
                  <Typography variant="h6" sx={{ mt: 2, opacity: 0.8 }}>{t("schedule.noMore")}</Typography>
                </>
              )}
            </Box>

          </Paper>

          <Paper sx={{ minHeight: { md: "calc(100vh - 150px)" }, maxHeight: { md: "calc(100vh - 150px)" }, p: 3, borderRadius: 5, overflow: "auto" }}>
            <Typography variant="h4" fontWeight={800}>{t("schedule.today")}</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>{t("schedule.count", { count: events.length })}</Typography>
            {events.length ? events.map((event) => <ScheduleItem key={event.id} event={event} now={now} timeZone={context.timezone} />) : (
              <Box sx={{ py: 8, textAlign: "center" }}><Typography color="text.secondary">{t("schedule.empty")}</Typography></Box>
            )}
          </Paper>
        </Box>
      </Box>

      <Dialog open={Boolean(checkInFor)} onClose={closeCheckIn} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={submitCheckIn}>
          <DialogTitle>{t("checkin.title")}</DialogTitle>
          <DialogContent>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {checkInFor?.title}
            </Typography>
            {checkInError ? <Alert severity="error" sx={{ mb: 2 }}>{checkInError}</Alert> : null}
            <TextField
              autoFocus
              fullWidth
              inputMode="numeric"
              label={t("checkin.cardNumber")}
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeCheckIn} disabled={checkInBusy}>{t("checkin.cancel")}</Button>
            <Button type="submit" variant="contained" disabled={checkInBusy}>
              {checkInBusy ? t("checkin.submitting") : t("checkin.submit")}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

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
