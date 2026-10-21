import i18n from "../i18n/index.js";
import { getApiError } from "../domain/api-error.js";

const kioskRequest = async (path, { token, method = "GET", body } = {}) => {
  const response = await fetch(`/api/kiosk${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(getApiError(
      { data: payload },
      i18n.t("kiosk:errors.requestFailed")
    ));
    error.status = response.status;
    error.code = payload.code;
    throw error;
  }
  return payload;
};

export const authenticateKiosk = (credentials) => kioskRequest("/auth", { method: "POST", body: credentials });
export const refreshKioskSession = (refreshToken) => kioskRequest("/refresh", { method: "POST", body: { refreshToken } });
export const deprovisionKiosk = (token) => kioskRequest("/device", { token, method: "DELETE" });
export const openKioskDoor = (token, cardNumber) => kioskRequest("/door-open", {
  token,
  method: "POST",
  body: { card_number: cardNumber },
});
export const fetchKioskContext = (token) => kioskRequest("/context", { token });
export const fetchKioskSchedule = (token, range) => kioskRequest(`/schedule?start=${range.start}&end=${range.end}`, { token });
export const checkInKioskMeeting = (token, eventId, cardNumber) => kioskRequest("/events/check-in", {
  token,
  method: "PUT",
  body: { event_id: eventId, card_number: cardNumber },
});
export const finishKioskMeeting = (token, eventId, cardNumber) => kioskRequest("/events/early-finish", {
  token,
  method: "PUT",
  body: { event_id: eventId, card_number: cardNumber },
});
