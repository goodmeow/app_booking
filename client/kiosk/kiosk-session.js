const kioskSessionKey = "kiosk_jwt";

const browserStorage = () => typeof window === "undefined" ? null : window.localStorage;

export const saveKioskSession = (session, storage = browserStorage()) => {
  if (!storage) return;
  storage.setItem(kioskSessionKey, JSON.stringify(session));
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
    storage.removeItem(kioskSessionKey);
    return null;
  }
};

export const clearKioskSession = (storage = browserStorage()) => storage?.removeItem(kioskSessionKey);
export { kioskSessionKey };
