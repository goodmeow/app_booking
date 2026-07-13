import bcrypt from "bcrypt";
import { badRequest, forbidden, HttpError, notFound } from "../../lib/http-error.js";
import { findAccountById, findAccountWithPassword, insertAccount, listEmployees, softDeleteAccount, updateAccount, updatePassword } from "../accounts/account.repository.js";
import { normalizedEmail, normalizedUsername, validatedPassword } from "../accounts/identity.validation.js";

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

export const getUsers = () => listEmployees();

export const getUser = async (id) => {
  const user = await findAccountById(id, "employee");
  if (!user) throw notFound("User not found");
  return user;
};

export const createUser = async (body) => {
  const values = cleanIdentity(body);
  if (!values.name || !values.email || !body.password || !body.roleId) throw badRequest("INVALID_USER", "Name, email, password, and role are required");
  try {
    return await insertAccount({ ...values, roleId: body.roleId, cardNumber: body.card_number, type: "employee", password: await bcrypt.hash(validatedPassword(body.password), 12) });
  } catch (error) {
    mapIdentityError(error);
  }
};

export const editUser = async (id, body, principal) => {
  const values = cleanIdentity(body);
  if (principal.role !== "ADMIN") {
    delete values.roleId;
    delete values.card_number;
  }
  try {
    const user = await updateAccount(id, values, "employee");
    if (!user || user.type !== "employee") throw notFound("User not found");
    return user;
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
  await updatePassword(targetId, await bcrypt.hash(newPassword, 12));
};

export const deleteUser = async (id) => {
  const user = await softDeleteAccount(id, "employee");
  if (!user) throw notFound("User not found");
  return user;
};
