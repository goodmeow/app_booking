import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { useHistory } from "react-router-dom";
import SigninBrandPanel from "./SigninBrandPanel.js";
import { getApiError } from "../domain/api-error.js";
import { buildSetupPayload, validateSetupForm } from "../domain/setup.js";
import { setupApi, useSubmitSetupMutation } from "../redux/services/setup.js";

const focusStyles = `
  .kiosk-auth button:focus-visible,
  .kiosk-auth input:focus-visible { outline: 3px solid #FFB800; outline-offset: 3px; }
  .kiosk-auth input::placeholder { color: #A9B3BF; opacity: 1; }
`;

const inputStyle = {
  boxSizing: "border-box",
  width: "100%",
  height: 52,
  padding: "0 18px",
  border: "1px solid #5B6673",
  borderRadius: 14,
  background: "#1A2027",
  fontSize: 17,
  color: "#F4F6F8",
};

const SetupField = ({ id, label, help, type = "text", autoComplete, value, onChange, required = true, autoFocus = false }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <label htmlFor={id} style={{ fontSize: 17, fontWeight: 600 }}>{label}</label>
    <input
      id={id}
      type={type}
      autoComplete={autoComplete}
      value={value}
      onChange={onChange}
      required={required}
      autoFocus={autoFocus}
      style={inputStyle}
    />
    {help ? <span style={{ fontSize: 15, color: "#A9B3BF" }}>{help}</span> : null}
  </div>
);

const InitialSetup = () => {
  const { t } = useTranslation(["auth", "common"]);
  const dispatch = useDispatch();
  const history = useHistory();
  const [form, setForm] = useState({ name: "", email: "", employeeId: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [submitSetup, { isLoading }] = useSubmitSetupMutation();

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const validationError = validateSetupForm(form);
    if (validationError) {
      setError(t(`auth:setup.errors.${validationError}`));
      return;
    }
    try {
      await submitSetup(buildSetupPayload(form)).unwrap();
      // Update the cached status before navigating; otherwise the gate still
      // believes setup is required and bounces sign-in back to this page.
      dispatch(setupApi.util.updateQueryData("getSetupStatus", undefined, (draft) => {
        draft.required = false;
      }));
      history.replace({ pathname: "/signin", state: { setupComplete: true } });
    } catch (reason) {
      setError(getApiError(reason, t("auth:setup.errors.generic")));
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
        <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {t("auth:setup.title")}
            </h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.5, color: "#A9B3BF" }}>{t("auth:setup.intro")}</p>
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
              <div style={{ fontSize: 17, lineHeight: 1.4, fontWeight: 600 }}>{error}</div>
            </div>
          ) : null}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <SetupField
              id="setup-name"
              label={t("auth:setup.name")}
              autoComplete="name"
              value={form.name}
              onChange={updateField("name")}
              autoFocus
            />
            <SetupField
              id="setup-email"
              label={t("auth:setup.email")}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={updateField("email")}
            />
            <SetupField
              id="setup-employee-id"
              label={t("auth:setup.employeeId")}
              help={t("auth:setup.employeeIdHelp")}
              autoComplete="off"
              value={form.employeeId}
              onChange={updateField("employeeId")}
              required={false}
            />
            <SetupField
              id="setup-password"
              label={t("auth:setup.password")}
              help={t("auth:setup.passwordRule")}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={updateField("password")}
            />
            <SetupField
              id="setup-confirm"
              label={t("auth:setup.confirm")}
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={updateField("confirm")}
            />

            <button
              type="submit"
              disabled={isLoading}
              style={{
                height: 58,
                marginTop: 4,
                border: 0,
                borderRadius: 16,
                background: "#FFFFFF",
                color: "#11151B",
                fontSize: 20,
                fontWeight: 800,
                cursor: isLoading ? "progress" : "pointer",
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? t("auth:setup.loading") : t("auth:setup.submit")}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default InitialSetup;
