import { getApiError } from "../../domain/api-error.js";

// Server codes that name a specific input in the user or card form. Explicit
// entries win over the generic API error texts.
const USER_ERROR_KEYS = {
  EMPLOYEE_ID_EXISTS: "users.employeeIdExists",
  INVALID_EMPLOYEE_ID: "users.employeeIdInvalid",
  CARD_LIMIT: "users.cardLimit",
  CARD_EXISTS: "users.cardExists",
};

export const userMutationError = (error, translate, fallback) => {
  const code = error?.data?.code || error?.code;
  const key = USER_ERROR_KEYS[code];
  if (key) return translate(key);
  return getApiError(error, fallback, translate);
};
