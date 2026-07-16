import i18n from "../i18n/index.js";
import { getApiError } from "../domain/api-error.js";

const sessionKey = "jwt";

const isSession = (value) => (
  Boolean(value?.token)
  && Boolean(value?.user?._id)
  && Boolean(value?.user?.email)
  && Boolean(value?.user?.role)
);

export const authenticate = (jwt, callback) => {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(sessionKey, JSON.stringify(jwt));
  }
  if (callback) callback();
};

export const isAuthenticated = () => {
  if (typeof window === "undefined") return false;
  const value = sessionStorage.getItem(sessionKey);
  if (!value) return false;
  try {
    const session = JSON.parse(value);
    if (isSession(session)) return session;
    sessionStorage.removeItem(sessionKey);
    return false;
  } catch {
    sessionStorage.removeItem(sessionKey);
    return false;
  }
};

export const clearJWT = (callback) => {
  if (typeof window !== "undefined") sessionStorage.removeItem(sessionKey);
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
