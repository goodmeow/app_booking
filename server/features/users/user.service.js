import bcrypt from "bcrypt";
import { withTransaction } from "../../db/pool.js";
import { badRequest, forbidden, HttpError, notFound } from "../../lib/http-error.js";
import {
  findAccountById,
  findAccountWithPassword,
  insertAccount,
  listEmployees,
  setMasterCard,
  softDeleteAccount,
  updateAccount,
  updatePassword,
} from "../accounts/account.repository.js";
import { normalizedEmail, normalizedUsername, validatedPassword } from "../accounts/identity.validation.js";
import { revokeRoomKioskDevices } from "../kiosk/kiosk.repository.js";

// Format UUID; cukup untuk menolak nilai sembarang sebelum menyentuh DB,
// karena kolom uuid PostgreSQL melempar 22P02 (HTTP 500) bila nilainya lolos.
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

// Nomor kartu adalah kredensial (check-in, selesai, pakai langsung, pintu).
// Hanya admin yang boleh melihatnya; pengguna lain hanya perlu daftar nama.
export const publicEmployee = ({ card_number, is_master_card, floor, ...rest }) => rest;

export const getUsers = async (principal) => {
  const employees = await listEmployees();
  return principal?.role === "ADMIN" ? employees : employees.map(publicEmployee);
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
    // Hanya admin yang boleh mengubah role, nomor kartu, dan flag kartu master.
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
    // Ganti nomor kartu: kartu lama dicabut dari daftar master supaya kartu
    // yang hilang tidak tetap berlaku, dan statusnya pindah ke kartu baru
    // kecuali admin menetapkan master_card secara eksplisit.
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
  // Akun yang dihapus tidak boleh meninggalkan kartu master yang masih berlaku.
  if (existing?.card_number) await setMasterCard(existing.card_number, false, principal?._id);
  return user;
};
