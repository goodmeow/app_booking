const kioskSessionKey = "kiosk_jwt";

const browserStorage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const saveKioskSession = (session, storage = browserStorage()) => {
  if (!storage) return;
  try {
    storage.setItem(kioskSessionKey, JSON.stringify(session));
  } catch {
    // Kiosk can keep the in-memory session for this tab.
  }
};

export const readKioskSession = (storage = browserStorage(), now = Date.now()) => {
  if (!storage) return null;
  try {
    const session = JSON.parse(storage.getItem(kioskSessionKey));
    const refreshExpiresAt = new Date(session?.device?.refreshExpiresAt || 0).getTime();
    if (!session?.token || !session?.refreshToken || !session?.room?._id || !session?.device?.id || refreshExpiresAt <= now) {
      storage.removeItem(kioskSessionKey);
      return null;
    }
    return session;
  } catch {
    try { storage.removeItem(kioskSessionKey); } catch { /* storage unavailable */ }
    return null;
  }
};

export const clearKioskSession = (storage = browserStorage()) => {
  try { storage?.removeItem(kioskSessionKey); } catch { /* storage unavailable */ }
};
export { kioskSessionKey };
