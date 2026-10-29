import i18n from "../i18n/index.js";

export const API_ERROR_KEYS = {
  AUTH_REQUIRED: "apiErrors.authenticationRequired",
  INVALID_TOKEN: "apiErrors.authenticationRequired",
  INACTIVE_PRINCIPAL: "apiErrors.authenticationRequired",
  INVALID_CREDENTIALS: "apiErrors.invalidCredentials",
  FORBIDDEN: "apiErrors.forbidden",
  CORS_ORIGIN: "apiErrors.corsOrigin",
  NOT_FOUND: "apiErrors.notFound",
  RATE_LIMITED: "apiErrors.rateLimited",
  IDENTITY_EXISTS: "apiErrors.identityExists",
  CARD_EXISTS: "apiErrors.cardExists",
  INVALID_EMAIL: "apiErrors.invalidEmail",
  INVALID_USERNAME: "apiErrors.invalidUsername",
  INVALID_PASSWORD: "apiErrors.invalidPassword",
  INVALID_CARD: "apiErrors.invalidCard",
  INVALID_ROOM: "apiErrors.invalidRoom",
  INVALID_USER: "apiErrors.invalidUser",
  INVALID_SIGNUP: "apiErrors.invalidRequest",
  INVALID_EVENT: "apiErrors.invalidRequest",
  INVALID_ATTENDEE: "apiErrors.invalidRequest",
  INVALID_BOOKING_KIND: "apiErrors.invalidRequest",
  INVALID_VISITOR: "apiErrors.invalidVisitor",
  INVALID_ORGANIZER: "apiErrors.invalidOrganizer",
  INVALID_SCOPE: "apiErrors.invalidRequest",
  INVALID_SETTINGS: "apiErrors.invalidRequest",
  INVALID_SETUP: "apiErrors.invalidRequest",
  EMPLOYEE_ID_EXISTS: "apiErrors.employeeIdExists",
  SETUP_COMPLETED: "apiErrors.setupCompleted",
  INVALID_TIME: "apiErrors.invalidTime",
  INVALID_TIMEZONE: "apiErrors.invalidTime",
  INVALID_LOCAL_TIME: "apiErrors.invalidTime",
  INVALID_RECURRENCE: "apiErrors.invalidRecurrence",
  ROOM_REQUIRED: "apiErrors.roomRequired",
  INVALID_RANGE: "apiErrors.invalidRange",
  START_IN_PAST: "apiErrors.startInPast",
  ROOM_CONFLICT: "apiErrors.roomConflict",
  BOOKING_DURATION_LIMIT: "apiErrors.bookingDurationLimit",
  RECURRENCE_LIMIT: "apiErrors.recurrenceLimit",
  ALREADY_CHECKED_IN: "apiErrors.alreadyCheckedIn",
  CHECK_IN_WINDOW: "apiErrors.checkInWindow",
  EARLY_FINISH_WINDOW: "apiErrors.earlyFinishWindow",
  INVALID_CHECK_IN: "apiErrors.invalidKioskAction",
  INVALID_KIOSK_ACTION: "apiErrors.invalidKioskAction",
  INVALID_KIOSK_CAPABILITIES: "apiErrors.invalidKioskAction",
  INVALID_KIOSK_CREDENTIALS: "apiErrors.invalidKioskCredentials",
  INVALID_KIOSK_REFRESH: "apiErrors.kioskProvisioningRequired",
  INVALID_KIOSK_TOKEN: "apiErrors.kioskAuthenticationRequired",
  KIOSK_AUTH_REQUIRED: "apiErrors.kioskAuthenticationRequired",
  INACTIVE_KIOSK_DEVICE: "apiErrors.kioskAuthenticationRequired",
  INTERNAL_ERROR: "apiErrors.requestFailed",
  REQUEST_ERROR: "apiErrors.requestFailed",
};

export const getApiError = (error, fallback, translate = i18n.t.bind(i18n)) => {
  const code = error?.data?.code || error?.code;
  // The server message carries the actual 200/366 limit; the generic
  // translation does not help the user correct the form.
  if (code === "RECURRENCE_LIMIT" && error?.data?.error) return error.data.error;
  const translationKey = API_ERROR_KEYS[code];
  if (translationKey) return translate(`common:${translationKey}`);
  if (code) return fallback || translate("common:apiErrors.requestFailed");

  return error?.data?.error
    || error?.error
    || error?.message
    || fallback
    || translate("common:states.error");
};
