import { badRequest } from "../../lib/http-error.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[\p{L}\p{N}._-]{3,64}$/u;

export const normalizedEmail = (value, { required = true } = {}) => {
  if (value == null && !required) return undefined;
  const email = String(value || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw badRequest("INVALID_EMAIL", "A valid email address is required");
  return email;
};

export const normalizedUsername = (value, { required = false } = {}) => {
  if ((value == null || value === "") && !required) return value == null ? value : null;
  const username = String(value || "").trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw badRequest("INVALID_USERNAME", "Username must be 3-64 letters, numbers, dots, underscores, or hyphens");
  }
  return username;
};

export const validatedPassword = (value) => {
  const password = String(value || "");
  const bytes = Buffer.byteLength(password, "utf8");
  if (bytes < 8 || bytes > 72) throw badRequest("INVALID_PASSWORD", "Password must be 8-72 UTF-8 bytes");
  return password;
};
