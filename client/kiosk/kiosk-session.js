const kioskSessionKey = "kiosk_jwt";

const browserStorage = () => typeof window === "undefined" ? null : window.localStorage;

const tokenExpiry = (token) => {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    return Number(payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
};

export const saveKioskSession = (session, storage = browserStorage()) => {
  if (!storage) return;
  storage.setItem(kioskSessionKey, JSON.stringify(session));
};

export const readKioskSession = (storage = browserStorage(), now = Date.now()) => {
  if (!storage) return null;
  try {
    const session = JSON.parse(storage.getItem(kioskSessionKey));
    if (!session?.token || !session?.room?._id || tokenExpiry(session.token) <= now) {
      storage.removeItem(kioskSessionKey);
      return null;
    }
    return session;
  } catch {
    storage.removeItem(kioskSessionKey);
    return null;
  }
};

export const clearKioskSession = (storage = browserStorage()) => storage?.removeItem(kioskSessionKey);
export { kioskSessionKey };
