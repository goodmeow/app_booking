import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, ConfigProvider, Input, Modal, Space, Spin, Tag, Typography } from "antd";
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
import { createAppTheme } from "../theme.js";

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
    <div style={{ minHeight: "100vh", background: "#07111f", display: "grid", placeItems: "center", padding: 24, fontFamily: kioskSans }}>
      <Card style={{ width: "100%", maxWidth: 520 }} styles={{ body: { padding: 40 } }}>
        <Space align="start" style={{ width: "100%", justifyContent: "space-between" }}>
          <div>
            <Typography.Text style={{ color: "#2FB46A", letterSpacing: 3, textTransform: "uppercase" }}>
              {t("common:brand.name")}
            </Typography.Text>
            <Typography.Title level={2} style={{ marginTop: 8, marginBottom: 8 }}>
              {t("setup.title")}
            </Typography.Title>
          </div>
          <LanguageSwitcher />
        </Space>
        <Typography.Paragraph type="secondary">{t("setup.description")}</Typography.Paragraph>

        <form onSubmit={submit}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {error ? <Alert type="error" showIcon message={error} /> : null}
            <div>
              <Typography.Text strong>{t("setup.roomLogin")}</Typography.Text>
              <Input
                autoFocus
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <Typography.Text strong>{t("setup.deviceName")}</Typography.Text>
              <Input
                required
                maxLength={80}
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
              />
            </div>
            <div>
              <Typography.Text strong>{t("setup.roomPassword")}</Typography.Text>
              <Input.Password
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              {loading ? t("setup.connecting") : t("setup.connect")}
            </Button>
          </Space>
        </form>
      </Card>
    </div>
  );
};

const ScheduleItem = ({ event, now, timeZone }) => {
  const { t } = useTranslation("kiosk");
  const active = new Date(event.start) <= now && now < new Date(event.end);
  const past = new Date(event.end) <= now;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px minmax(0, 1fr)",
        gap: 16,
        padding: "12px 0",
        opacity: past ? 0.45 : 1,
      }}
    >
      <div>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {formatKioskTime(event.start, timeZone)}
        </Typography.Title>
        <Typography.Text type="secondary">{formatKioskTime(event.end, timeZone)}</Typography.Text>
      </div>
      <div
        style={{
          borderLeft: `4px solid ${active ? "#FF8A80" : "#2FB46A"}`,
          paddingLeft: 12,
          minWidth: 0,
        }}
      >
        <Typography.Title
          level={5}
          ellipsis
          style={{ margin: 0, fontFamily: kioskSerif, fontWeight: 600 }}
        >
          {event.title}
        </Typography.Title>
        <Typography.Text type="secondary">
          {active ? t("schedule.occupiedNow") : t("schedule.reserved")}
        </Typography.Text>
      </div>
    </div>
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
  const ledTagColor = {
    occupied: "red",
    awaitingCheckIn: "gold",
    available: "green",
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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07111f" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07111f",
        color: "#EDF2F6",
        padding: 24,
        overflow: "hidden",
        fontFamily: kioskSans,
      }}
    >
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <Space
          align="center"
          style={{ width: "100%", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}
        >
          <div>
            <Typography.Text style={{ letterSpacing: 3, opacity: 0.7, textTransform: "uppercase" }}>
              {t("common:brand.kiosk")}
            </Typography.Text>
            <Typography.Title level={3} style={{ margin: "4px 0", fontFamily: kioskSerif }}>
              {context.room.name}
            </Typography.Title>
            <Typography.Text style={{ opacity: 0.7 }}>
              {[context.room.building, context.room.floor && t("schedule.floor", { floor: context.room.floor })]
                .filter(Boolean)
                .join(" · ")}
            </Typography.Text>
          </div>
          <Space wrap>
            {context.device?.nfcEnabled ? (
              <Tag color="blue" style={{ color: "#EDF2F6" }}>NFC</Tag>
            ) : null}
            {context.device?.ledEnabled ? (
              <Tag color={ledTagColor} style={{ color: "#EDF2F6" }}>
                LED · {paletteLabel}
              </Tag>
            ) : null}
            <Tag color={connected ? "green" : "default"} style={{ color: "#EDF2F6" }}>
              {connected ? t("schedule.live") : t("schedule.offline")}
            </Tag>
            <LanguageSwitcher />
            <Button
              type="text"
              style={{ color: "#EDF2F6" }}
              onClick={() => document.documentElement.requestFullscreen?.()}
            >
              {t("schedule.fullscreen")}
            </Button>
            <Button
              type="text"
              style={{ color: "#EDF2F6" }}
              onPointerDown={armChangeRoom}
              onPointerUp={cancelChangeRoom}
              onPointerLeave={cancelChangeRoom}
              onPointerCancel={cancelChangeRoom}
            >
              {t("schedule.changeRoom")}
            </Button>
          </Space>
        </Space>

        {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
        {notice ? (
          <Alert
            type="success"
            showIcon
            closable
            message={notice}
            onClose={() => setNotice("")}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.8fr) minmax(360px, 1fr)",
            gap: 24,
          }}
        >
          <Card
            bordered={false}
            style={{
              minHeight: "calc(100vh - 150px)",
              borderRadius: 20,
              color: "#FFFFFF",
              background: `linear-gradient(145deg, ${palette.main}, ${palette.dark})`,
            }}
            styles={{
              body: {
                padding: 40,
                minHeight: "calc(100vh - 150px)",
                display: "flex",
                flexDirection: "column",
              },
            }}
          >
            <Space align="start" style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Title
                level={1}
                style={{ margin: 0, letterSpacing: 2, fontFamily: kioskSerif, color: "#FFFFFF" }}
              >
                {paletteLabel}
              </Typography.Title>
              <div style={{ textAlign: "right" }}>
                <Typography.Title level={1} style={{ margin: 0, fontFamily: kioskSerif, color: "#FFFFFF" }}>
                  {formatKioskTime(now, context.timezone)}
                </Typography.Title>
                <Typography.Text style={{ opacity: 0.85, color: "#FFFFFF" }}>
                  {formatKioskDate(now, language, context.timezone)}
                </Typography.Text>
              </div>
            </Space>

            <div style={{ flex: 1, display: "grid", alignContent: "center", padding: "40px 0" }}>
              {state.mode === "offline" || state.mode === "unknown" ? (
                <>
                  <Typography.Title level={2} style={{ margin: 0, color: "#FFFFFF" }}>
                    {t("states.offline")}
                  </Typography.Title>
                  <Typography.Title level={4} style={{ marginTop: 16, opacity: 0.85, color: "#FFFFFF" }}>
                    {t("schedule.offlineHelp")}
                  </Typography.Title>
                </>
              ) : featured ? (
                <>
                  <Typography.Text style={{ letterSpacing: 2, opacity: 0.8, textTransform: "uppercase" }}>
                    {state.current ? t("schedule.currentMeeting") : t("schedule.nextMeeting")}
                  </Typography.Text>
                  <Typography.Title
                    level={2}
                    style={{ marginTop: 8, fontFamily: kioskSerif, color: "#FFFFFF" }}
                  >
                    {featured.title}
                  </Typography.Title>
                  <Typography.Title level={4} style={{ marginTop: 16, opacity: 0.9, color: "#FFFFFF" }}>
                    {formatKioskTime(featured.start, context.timezone)} – {formatKioskTime(featured.end, context.timezone)}
                  </Typography.Title>
                  {state.current?.canCheckIn ? (
                    <div style={{ marginTop: 24 }}>
                      <Button
                        size="large"
                        onClick={() => openCheckIn(state.current)}
                        style={{ background: "#FFFFFF", color: "#11151B", fontWeight: 700 }}
                      >
                        {t("checkin.action")}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <Typography.Title level={2} style={{ margin: 0, color: "#FFFFFF" }}>
                    {t("schedule.ready")}
                  </Typography.Title>
                  <Typography.Title level={4} style={{ marginTop: 16, opacity: 0.8, color: "#FFFFFF" }}>
                    {t("schedule.noMore")}
                  </Typography.Title>
                </>
              )}
            </div>
          </Card>

          <Card
            style={{
              minHeight: "calc(100vh - 150px)",
              maxHeight: "calc(100vh - 150px)",
              borderRadius: 20,
            }}
            styles={{ body: { padding: 24, overflow: "auto", maxHeight: "calc(100vh - 150px)" } }}
          >
            <Typography.Title level={3} style={{ marginTop: 0 }}>{t("schedule.today")}</Typography.Title>
            <Typography.Paragraph type="secondary">
              {t("schedule.count", { count: events.length })}
            </Typography.Paragraph>
            {events.length ? events.map((event) => (
              <ScheduleItem key={event.id} event={event} now={now} timeZone={context.timezone} />
            )) : (
              <div style={{ padding: "64px 0", textAlign: "center" }}>
                <Typography.Text type="secondary">{t("schedule.empty")}</Typography.Text>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(checkInFor)}
        title={t("checkin.title")}
        width={420}
        onCancel={closeCheckIn}
        maskClosable={!checkInBusy}
        closable={!checkInBusy}
        footer={[
          <Button key="cancel" onClick={closeCheckIn} disabled={checkInBusy}>
            {t("checkin.cancel")}
          </Button>,
          <Button
            key="submit"
            type="primary"
            htmlType="submit"
            form="kiosk-checkin-form"
            loading={checkInBusy}
          >
            {checkInBusy ? t("checkin.submitting") : t("checkin.submit")}
          </Button>,
        ]}
      >
        <form id="kiosk-checkin-form" onSubmit={submitCheckIn}>
          <Space direction="vertical" size="middle" style={{ width: "100%", marginTop: 8 }}>
            <Typography.Text type="secondary">{checkInFor?.title}</Typography.Text>
            {checkInError ? <Alert type="error" showIcon message={checkInError} /> : null}
            <Input
              autoFocus
              inputMode="numeric"
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </Space>
        </form>
      </Modal>
    </div>
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
  const content = resetting ? (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07111f" }}>
      <Spin size="large" />
    </div>
  ) : !session ? (
    <KioskSignin onAuthenticated={completeProvision} />
  ) : (
    <KioskDisplay session={session} onSessionUpdate={setSession} onDeprovision={clearProvisioning} />
  );

  // The kiosk is a fixed dark appliance even when the CMS is in light mode.
  return <ConfigProvider theme={createAppTheme("dark")}>{content}</ConfigProvider>;
};

export default KioskApp;
