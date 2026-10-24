import bcrypt from "bcrypt";
import { withTransaction } from "../../db/pool.js";
import { badRequest, forbidden, HttpError, notFound } from "../../lib/http-error.js";
import {
  findAccountById,
  findAccountWithPassword,
  insertAccount,
  listEmployeeDirectory,
  listEmployees,
  searchEmployeeDirectory,
  setMasterCard,
  softDeleteAccount,
  updateAccount,
  updatePassword,
} from "../accounts/account.repository.js";
import { normalizedEmail, normalizedUsername, validatedPassword } from "../accounts/identity.validation.js";
import { revokeRoomKioskDevices } from "../kiosk/kiosk.repository.js";

// UUID format; enough to reject arbitrary values before touching the DB,
// because a PostgreSQL uuid column throws 22P02 (HTTP 500) when the value gets through.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cleanIdentity = (body) => {
  const values = {
    ...body,
    name: body.name == null ? undefined : String(body.name).trim(),
    email: normalizedEmail(body.email, { required: body.email != null }),
  };
  if (Object.hasOwn(body, "username")) values.username = normalizedUsername(body.username);
  return values;
};

const mapIdentityError = (error) => {
  if (error.code === "23505") throw new HttpError(409, "IDENTITY_EXISTS", "Email or username already exists");
  throw error;
};

// The card number is a credential (check-in, finish, instant booking, door).
// Only admins may see it; other users only need the name list.
export const publicEmployee = ({ card_number, is_master_card, floor, ...rest }) => rest;

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
  // Admins keep the complete list, including card number, floor, and the
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

export const getUser = async (id) => {
  const user = await findAccountById(id, "employee");
  if (!user) throw notFound("User not found");
  return user;
};

export const createUser = async (body, principal) => {
  const values = cleanIdentity(body);
  if (!values.name || !values.email || !body.password || !body.roleId) throw badRequest("INVALID_USER", "Name, email, password, and role are required");
  if (!UUID_PATTERN.test(String(body.roleId))) throw badRequest("INVALID_USER", "Role must be a valid role identifier");
  try {
    const user = await insertAccount({
      ...values,
      roleId: body.roleId,
      cardNumber: body.card_number,
      type: "employee",
      password: await bcrypt.hash(validatedPassword(body.password), 12),
    });
    if (body.master_card === true && user.card_number) {
      await setMasterCard(user.card_number, true, principal?._id);
    }
    return { ...user, is_master_card: body.master_card === true && Boolean(user.card_number) };
  } catch (error) {
    mapIdentityError(error);
  }
};

export const editUser = async (id, body, principal) => {
  const values = cleanIdentity(body);
  const isAdmin = principal.role === "ADMIN";
  const before = isAdmin ? await findAccountById(id, "employee") : null;
  if (!isAdmin) {
    // Only admins may change the role, card number, and master-card flag.
    delete values.roleId;
    delete values.card_number;
    delete values.floor;
  } else if (values.roleId !== undefined && !UUID_PATTERN.test(String(values.roleId))) {
    throw badRequest("INVALID_USER", "Role must be a valid role identifier");
  }
  try {
    const user = await updateAccount(id, values, "employee");
    if (!user || user.type !== "employee") throw notFound("User not found");
    let isMasterCard = null;
    // Changing the card number: the old card is removed from the master list so a
    // lost card does not stay valid, and the status moves to the new card unless
    // the admin sets master_card explicitly.
    const oldCard = String(before?.card_number || "").trim();
    const newCard = String(user.card_number || "").trim();
    if (before && oldCard && oldCard.toLowerCase() !== newCard.toLowerCase()) {
      await setMasterCard(oldCard, false, principal._id);
      if (before.is_master_card && body.master_card === undefined && newCard) {
        await setMasterCard(newCard, true, principal._id);
        isMasterCard = true;
      }
    }
    if (isAdmin && body.master_card !== undefined) {
      if (user.card_number) {
        await setMasterCard(user.card_number, body.master_card === true, principal._id);
        isMasterCard = body.master_card === true;
      } else {
        isMasterCard = false;
      }
    }
    return { ...user, ...(isMasterCard === null ? {} : { is_master_card: isMasterCard }) };
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
  const existing = await findAccountById(id, "employee");
  const user = await softDeleteAccount(id, "employee");
  if (!user) throw notFound("User not found");
  // A deleted account must not leave a master card that is still valid.
  if (existing?.card_number) await setMasterCard(existing.card_number, false, principal?._id);
  return user;
};
