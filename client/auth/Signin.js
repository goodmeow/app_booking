import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import { authenticate, signin } from "./auth-helper.js";
import SigninBrandPanel from "./SigninBrandPanel.js";

const HELPDESK_EMAIL = "helpdesk@integrasolution.id";

const focusStyles = `
  .kiosk-auth button:focus-visible,
  .kiosk-auth a:focus-visible,
  .kiosk-auth input:focus-visible { outline: 3px solid #FFB800; outline-offset: 3px; }
  .kiosk-auth input::placeholder { color: #A9B3BF; opacity: 1; }
`;

const Signin = () => {
  const { t } = useTranslation(["auth", "common"]);
  const history = useHistory();
  const location = useLocation();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const data = await signin({ email: login, password });
      setLoading(false);
      authenticate(data, () => {
        const destination = location.state?.from || "/";
        history.replace(typeof destination === "string" ? destination : {
          pathname: destination.pathname || "/",
          search: destination.search || "",
          hash: destination.hash || "",
        });
      }, remember);
    } catch (reason) {
      const message = String(reason?.message || "");
      const networkFailure = /fetch|network|timeout/i.test(message);
      setError(networkFailure ? t("common:states.error") : t("auth:signin.errorInvalid"));
      setLoading(false);
    }
  };

  return (
    <div
      className="kiosk-auth"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexWrap: "wrap",
        background: "#11151B",
        color: "#F4F6F8",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{focusStyles}</style>
      <SigninBrandPanel />

      <main
        style={{
          flex: "1 1 480px",
          boxSizing: "border-box",
          padding: "56px 40px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {t("auth:signin.title")}
            </h1>
            <p style={{ margin: 0, fontSize: 20, lineHeight: 1.4, color: "#A9B3BF" }}>{t("auth:signin.subtitle")}</p>
          </div>

          {error ? (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "16px 18px",
                borderRadius: 14,
                background: "#B3261E",
                color: "#FFFFFF",
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ flex: "none" }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
              <div style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 600 }}>{error}</div>
            </div>
          ) : null}

          {notice ? (
            <div
              role="status"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "16px 18px",
                borderRadius: 14,
                background: "#1F1500",
                color: "#FFD25A",
              }}
            >
              <div style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 600 }}>
                {notice}
                {notice === t("auth:signin.forgotNotice") ? (
                  <>
                    {" "}
                    <a href={`mailto:${HELPDESK_EMAIL}`} style={{ color: "#FFD25A", fontWeight: 700 }}>
                      {HELPDESK_EMAIL}
                    </a>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label htmlFor="email" style={{ fontSize: 18, fontWeight: 600 }}>
                {t("auth:signin.emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="email@example.com"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                required
                style={{
                  boxSizing: "border-box",
                  width: "100%",
                  height: 56,
                  padding: "0 18px",
                  border: "1px solid #5B6673",
                  borderRadius: 14,
                  background: "#1A2027",
                  fontSize: 18,
                  color: "#F4F6F8",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <label htmlFor="password" style={{ fontSize: 18, fontWeight: 600 }}>
                  {t("common:fields.password")}
                </label>
                <button
                  type="button"
                  onClick={() => setNotice(t("auth:signin.forgotNotice"))}
                  style={{
                    padding: "8px 0",
                    border: 0,
                    background: "transparent",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#A9B3BF",
                    cursor: "pointer",
                  }}
                >
                  {t("auth:signin.forgot")}
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={reveal ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  style={{
                    boxSizing: "border-box",
                    width: "100%",
                    height: 56,
                    padding: "0 130px 0 18px",
                    border: "1px solid #5B6673",
                    borderRadius: 14,
                    background: "#1A2027",
                    fontSize: 18,
                    color: "#F4F6F8",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setReveal((value) => !value)}
                  aria-label={reveal ? t("auth:signin.hide") : t("auth:signin.show")}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    height: 44,
                    padding: "0 16px",
                    border: 0,
                    borderRadius: 10,
                    background: "transparent",
                    color: "#F4F6F8",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {reveal ? t("auth:signin.hide") : t("auth:signin.show")}
                </button>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 44, fontSize: 18 }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                style={{ width: 24, height: 24, accentColor: "#FFB800" }}
              />
              {t("auth:signin.remember")}
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{
                height: 58,
                border: 0,
                borderRadius: 16,
                background: "#FFFFFF",
                color: "#11151B",
                fontSize: 20,
                fontWeight: 800,
                cursor: loading ? "progress" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? t("common:states.loading") : t("auth:signin.submit")}
            </button>
          </form>

        </div>
      </main>
    </div>
  );
};

export default Signin;
