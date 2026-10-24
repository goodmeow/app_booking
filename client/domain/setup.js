export const MIN_SETUP_PASSWORD_LENGTH = 8;

// Field checks run before the first-admin request. The server repeats the same
// rules; these only catch the obvious mistakes without a round trip.
export const validateSetupForm = ({ name, email, password, confirm } = {}) => {
  if (!String(name || "").trim()) return "nameRequired";
  if (!String(email || "").trim()) return "emailRequired";
  if (String(password || "").length < MIN_SETUP_PASSWORD_LENGTH) return "passwordTooShort";
  if (String(password) !== String(confirm || "")) return "passwordMismatch";
  return null;
};

// The employee ID is optional, so an empty field must be omitted instead of
// sending an empty string that the server would treat as a duplicate identity.
export const buildSetupPayload = ({ name, email, employeeId, password } = {}) => {
  const payload = {
    name: String(name || "").trim(),
    email: String(email || "").trim(),
    password: String(password || ""),
  };
  const trimmedEmployeeId = String(employeeId || "").trim();
  if (trimmedEmployeeId) payload.employeeId = trimmedEmployeeId;
  return payload;
};
