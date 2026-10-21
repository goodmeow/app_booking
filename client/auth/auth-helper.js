import i18n from "../i18n/index.js";
import { getApiError } from "../domain/api-error.js";

const sessionKey = "jwt";

const isSession = (value) => (
  Boolean(value?.token)
  && Boolean(value?.user?._id)
  && Boolean(value?.user?.email)
  && Boolean(value?.user?.role)
);

export const authenticate = (jwt, callback, persist = false) => {
  if (typeof window !== "undefined") {
    const target = persist ? window.localStorage : window.sessionStorage;
    const other = persist ? window.sessionStorage : window.localStorage;
    try {
      if (other) other.removeItem(sessionKey);
      if (target) target.setItem(sessionKey, JSON.stringify(jwt));
    } catch {
      // Private mode / storage penuh: sesi tetap berlaku selama tab hidup.
    }
  }
  if (callback) callback();
};

export const readStoredSession = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage?.getItem(sessionKey) || window.localStorage?.getItem(sessionKey) || null;
  } catch {
    return sessionStorage.getItem(sessionKey);
  }
};

export const isAuthenticated = () => {
  if (typeof window === "undefined") return false;
  const value = readStoredSession();
  if (!value) return false;
  try {
    const session = JSON.parse(value);
    if (isSession(session)) return session;
    clearStoredSession();
    return false;
  } catch {
    clearStoredSession();
    return false;
  }
};

export const clearStoredSession = () => {
  if (typeof window === "undefined") return;
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(sessionKey);
  if (typeof localStorage !== "undefined") localStorage.removeItem(sessionKey);
};

export const clearJWT = (callback) => {
  clearStoredSession();
  if (callback) callback();
};

export const signin = async (credentials) => {
  const response = await fetch("/api/auth/signin/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(credentials),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(getApiError({ data }, i18n.t("auth:signin.error")));
  }
  return data;
};

export const signup = async (account) => {
  const response = await fetch("/api/auth/signup/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(account),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(getApiError({ data }, i18n.t("auth:signup.error")));
  }
  return data;
};

export const signout = (callback) => {
  // The recovered client clears local authentication immediately. The server
  // request only clears its cookie and must not block navigation or route guards.
  clearJWT(callback);
  return fetch("/api/auth/signout/", { credentials: "include" }).catch(() => undefined);
};
