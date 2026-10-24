import bcrypt from "bcrypt";
import { withTransaction } from "../../db/pool.js";
import { badRequest, conflict, forbidden, HttpError, notFound } from "../../lib/http-error.js";
import {
  findAccountById,
  findAccountWithPassword,
  findUserCard,
  insertAccount,
  insertUserCard,
  listEmployeeDirectory,
  listEmployees,
  listUserCards,
  searchEmployeeDirectory,
  setMasterCard,
  setUserCardLost,
  softDeleteAccount,
  updateAccount,
  updatePassword,
} from "../accounts/account.repository.js";
import { normalizedEmail, normalizedUsername, validatedPassword } from "../accounts/identity.validation.js";
import { revokeRoomKioskDevices } from "../kiosk/kiosk.repository.js";

// UUID format; enough to reject arbitrary values before touching the DB,
// because a PostgreSQL uuid column throws 22P02 (HTTP 500) when the value gets through.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Employee IDs follow the HR code, which may contain dots (BioTime emp_code
// examples: "001-01.25"). Letters, digits, dot, dash, and underscore are
// allowed; whitespace and other punctuation are rejected. The database index
// compares lower(btrim(employee_id)), which makes the uniqueness check
// case-insensitive without changing the stored text.
const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;

// A user keeps a current badge and one spare. Lost cards stay in the table as
// history but no longer count towards this limit.
export const ACTIVE_CARD_LIMIT = 2;

const cleanIdentity = (body) => {
  const values = {
    ...body,
    name: body.name == null ? undefined : String(body.name).trim(),
    email: normalizedEmail(body.email, { required: body.email != null }),
  };
  if (Object.hasOwn(body, "username")) values.username = normalizedUsername(body.username);
  return values;
};

export const normalizedEmployeeId = (value, { required = false } = {}) => {
  const employeeId = String(value ?? "").trim();
  if (!employeeId) {
    if (required) throw badRequest("INVALID_EMPLOYEE_ID", "Employee ID is required");
    return null;
  }
  if (!EMPLOYEE_ID_PATTERN.test(employeeId)) {
    throw badRequest("INVALID_EMPLOYEE_ID", "Employee ID must be 1-40 letters, numbers, dots, dashes, or underscores");
  }
  return employeeId;
};

// A 23505 on the employee_id index is a different field error than a duplicate
// email or username, so the CMS can highlight the right input.
export const identityConflictCode = (error) => {
  if (error?.code !== "23505") return null;
  const constraint = String(error.constraint || "").toLowerCase();
  return constraint.includes("employee_id") ? "EMPLOYEE_ID_EXISTS" : "IDENTITY_EXISTS";
};

const mapIdentityError = (error) => {
  const code = identityConflictCode(error);
  if (!code) throw error;
  const message = code === "EMPLOYEE_ID_EXISTS"
    ? "Employee ID already exists"
    : "Email or username already exists";
  throw new HttpError(409, code, message);
};

const normalizedCardNumber = (value) => {
  const cardNumber = String(value ?? "").trim();
  if (!cardNumber) throw badRequest("INVALID_CARD", "Card number is required");
  return cardNumber;
};

const mapCardError = (error) => {
  if (error?.code === "23505") throw conflict("CARD_EXISTS", "Card number is already registered");
  throw error;
};

export const activeCardCount = (cards) => cards.filter((card) => card.status === "active").length;

export const activeCardLimitReached = (cards) => activeCardCount(cards) >= ACTIVE_CARD_LIMIT;

// Cards are global: one physical card cannot belong to two employees. The limit
// only counts active cards, so replacing a reported-lost card always fits.
export const addUserCard = async (userId, cardNumber, { execute } = {}) => {
  if (!UUID_PATTERN.test(String(userId))) throw notFound("User not found");
  const normalized = normalizedCardNumber(cardNumber);
  const user = await findAccountById(userId, "employee", execute);
  if (!user) throw notFound("User not found");
  const cards = await listUserCards(userId, execute);
  if (activeCardLimitReached(cards)) {
    throw conflict("CARD_LIMIT", `A user can hold at most ${ACTIVE_CARD_LIMIT} active cards`);
  }
  try {
    return await insertUserCard({ userId, cardNumber: normalized }, execute);
  } catch (error) {
    mapCardError(error);
  }
};

// A lost card is kept as a record, never deleted. The door master list is
// revoked at the same time so the physical card stops working immediately.
export const markUserCardLost = async (userId, cardId, principal) => {
  if (!UUID_PATTERN.test(String(userId)) || !UUID_PATTERN.test(String(cardId))) {
    throw notFound("Card not found");
  }
  const existing = await findUserCard(userId, cardId);
  if (!existing) throw notFound("Card not found");
  if (existing.status !== "active") throw conflict("CARD_ALREADY_LOST", "The card is already marked as lost");
  const lost = await setUserCardLost(cardId);
  if (!lost) throw conflict("CARD_ALREADY_LOST", "The card is already marked as lost");
  await setMasterCard(lost.card_number, false, principal?._id);
  return lost;
};

// The card number is a credential (check-in, finish, instant booking, door).
// Only admins may see the whole profile; other users only need the name list.
export const publicEmployee = ({ card_number, is_master_card, floor, employee_id, cards, ...rest }) => rest;

// employee_id is HR data for the admin list. The account owner still sees their
// own cards, because those are their door and kiosk credentials.
export const visibleAccount = (user, principal) => {
  if (principal?.role === "ADMIN") return user;
  const { employee_id, ...rest } = user;
  return rest;
};

// A one-character query would match most of the company, so the directory
// search starts at two characters. Shorter input is an error instead of an
// empty list, otherwise a client cannot tell "no match" from "type more".
const DIRECTORY_QUERY_MIN_LENGTH = 2;
const DIRECTORY_SEARCH_LIMIT = 20;

const normalizedFloor = (value) => String(value ?? "").trim();

// The directory projection is a whitelist instead of the publicEmployee
// blacklist: a column added to the table later stays private by default.
export const directoryEmployee = ({ _id, name, email, type }) => ({ _id, name, email, type });

const normalizedDirectorySearch = (value) => {
  const term = String(value ?? "").trim();
  if (!term) return "";
  if (term.length < DIRECTORY_QUERY_MIN_LENGTH) {
    throw badRequest("INVALID_QUERY", `Search needs at least ${DIRECTORY_QUERY_MIN_LENGTH} characters`);
  }
  return term;
};

// Which part of the employee directory a non-admin may read. Admins never reach
// this planner, they keep the full management list.
export const directoryScope = (principal, query = {}) => {
  const term = normalizedDirectorySearch(query.q);
  if (term) return { scope: "search", term, limit: DIRECTORY_SEARCH_LIMIT };

  const floor = normalizedFloor(principal?.floor);
  if (!floor) return { scope: "none" };

  // The "all" floor group is company-wide, so it lists the whole directory.
  return { scope: "floor", floor: floor.toLowerCase() === "all" ? null : floor };
};

export const getUsers = async (principal, query = {}) => {
  // Admins keep the complete list, including employee ID, cards, floor, and the
  // master-card flag; the search parameter does not apply to them.
  if (principal?.role === "ADMIN") return listEmployees();

  const { scope, term, floor, limit } = directoryScope(principal, query);
  if (scope === "none") return [];
  if (scope === "search") {
    const matches = await searchEmployeeDirectory({ term, limit });
    return matches.map(directoryEmployee);
  }
  const colleagues = await listEmployeeDirectory(floor);
  return colleagues.map(directoryEmployee);
};

export const getUser = async (id, principal) => {
  const user = await findAccountById(id, "employee");
  if (!user) throw notFound("User not found");
  return visibleAccount(user, principal);
};

// The legacy single card field is still accepted from older CMS builds and is
// registered as a card of the user, so a form that was not updated yet cannot
// create an account without door access.
const legacyCardNumber = (body) => String(body.card_number ?? "").trim();

const hasCardNumber = (cards, cardNumber) => cards.some(
  (card) => card.card_number.trim().toLowerCase() === cardNumber.toLowerCase()
);

export const createUser = async (body, principal) => {
  const values = cleanIdentity(body);
  if (!values.name || !values.email || !body.password || !body.roleId) throw badRequest("INVALID_USER", "Name, email, password, and role are required");
  if (!UUID_PATTERN.test(String(body.roleId))) throw badRequest("INVALID_USER", "Role must be a valid role identifier");
  const employeeId = normalizedEmployeeId(body.employee_id, { required: true });
  const cardNumber = legacyCardNumber(body);
  const passwordHash = await bcrypt.hash(validatedPassword(body.password), 12);
  try {
    const created = await withTransaction(async (client) => {
      const execute = (text, params) => client.query(text, params);
      const user = await insertAccount({
        ...values,
        employeeId,
        roleId: body.roleId,
        type: "employee",
        password: passwordHash,
      }, execute);
      if (cardNumber) {
        await addUserCard(user._id, cardNumber, { execute });
        if (body.master_card === true) await setMasterCard(cardNumber, true, principal?._id, execute);
      }
      return user;
    });
    return findAccountById(created._id, "employee");
  } catch (error) {
    mapIdentityError(error);
  }
};

export const editUser = async (id, body, principal) => {
  const values = cleanIdentity(body);
  const isAdmin = principal.role === "ADMIN";
  if (!isAdmin) {
    // Only admins may change the role, employee ID, floor, and cards.
    delete values.roleId;
    delete values.employee_id;
    delete values.card_number;
    delete values.floor;
  } else {
    if (values.roleId !== undefined && !UUID_PATTERN.test(String(values.roleId))) {
      throw badRequest("INVALID_USER", "Role must be a valid role identifier");
    }
    // Supplying the field means the admin wants to change it; clearing an
    // employee ID is not offered because new accounts always have one.
    if (Object.hasOwn(body, "employee_id")) {
      values.employeeId = normalizedEmployeeId(body.employee_id, { required: true });
    }
  }
  const cardNumber = isAdmin ? legacyCardNumber(body) : "";
  try {
    const user = await updateAccount(id, values, "employee");
    if (!user || user.type !== "employee") throw notFound("User not found");
    // Existing cards are never removed by a profile update. A new number is
    // registered as another card; a number the user already holds is a no-op so
    // resubmitting the old form does not fail.
    if (cardNumber) {
      const cards = await listUserCards(id);
      if (!hasCardNumber(cards, cardNumber)) await addUserCard(id, cardNumber);
      if (body.master_card !== undefined) {
        await setMasterCard(cardNumber, body.master_card === true, principal._id);
      }
    }
    return visibleAccount(await findAccountById(id, "employee"), principal);
  } catch (error) {
    mapIdentityError(error);
  }
};

export const changeUserPassword = async (body, principal) => {
  const targetId = body.userId || principal._id;
  if (principal.role !== "ADMIN" && String(targetId) !== String(principal._id)) throw forbidden();
  if (body.newPassword !== body.newPasswordConfirmation) throw badRequest("INVALID_PASSWORD", "New password confirmation must match");
  const newPassword = validatedPassword(body.newPassword);
  const account = await findAccountWithPassword(targetId);
  if (!account || account.is_deleted) throw notFound("Account not found");
  if (principal.role !== "ADMIN") {
    const valid = body.oldPassword && account.password && await bcrypt.compare(String(body.oldPassword), account.password);
    if (!valid) throw badRequest("INVALID_PASSWORD", "Current password is incorrect");
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  return withTransaction(async (client) => {
    const execute = (text, values) => client.query(text, values);
    await updatePassword(targetId, passwordHash, execute);
    return account.type === "room" ? revokeRoomKioskDevices(targetId, principal._id, execute) : [];
  });
};

export const deleteUser = async (id, principal) => {
  if (!UUID_PATTERN.test(String(id))) throw notFound("User not found");
  const cards = await listUserCards(id);
  const user = await softDeleteAccount(id, "employee");
  if (!user) throw notFound("User not found");
  // A deleted account must not leave a card that still opens the door.
  for (const card of cards) {
    await setMasterCard(card.card_number, false, principal?._id);
  }
  return user;
};
