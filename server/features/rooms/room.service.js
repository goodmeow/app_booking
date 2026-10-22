import bcrypt from "bcrypt";
import config from "../../../config/config.js";
import { badRequest, HttpError, notFound } from "../../lib/http-error.js";
import { isValidLocalDate, parseInstant } from "../events/event-time.js";
import { findRoomById, insertAccount, listAvailableRooms, listRoomStatus, listRooms, roomUsageReport, softDeleteAccount, updateAccount } from "../accounts/account.repository.js";
import { normalizedEmail, normalizedUsername, validatedPassword } from "../accounts/identity.validation.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const validDateOnly = (value) => {
  if (!DATE_ONLY.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  return isValidLocalDate({ year, month, day });
};

const mapIdentityError = (error) => {
  if (error.code === "23505") throw new HttpError(409, "IDENTITY_EXISTS", "Email or username already exists");
  throw error;
};

export const getRooms = (filters, principal) => listRooms(filters, principal.role === "ADMIN");

export const getRoom = async (id, principal) => {
  const room = await findRoomById(id, principal.role === "ADMIN");
  if (!room) throw notFound("Room not found");
  return room;
};

export const createRoom = async (body) => {
  const name = String(body.name || "").trim();
  const email = normalizedEmail(body.email);
  if (!name || !email) throw badRequest("INVALID_ROOM", "Name and email are required");
  try {
    return await insertAccount({
      name,
      email,
      username: normalizedUsername(body.username),
      password: body.password ? await bcrypt.hash(validatedPassword(body.password), 12) : null,
      roleId: null,
      type: "room",
      floor: body.floor,
      capacity: body.capacity,
      building: body.building,
      feature: body.feature,
    });
  } catch (error) {
    mapIdentityError(error);
  }
};

export const editRoom = async (id, body) => {
  try {
    const values = {
      name: body.name == null ? undefined : String(body.name).trim(),
      email: normalizedEmail(body.email, { required: body.email != null }),
    };
    if (Object.hasOwn(body, "username")) values.username = normalizedUsername(body.username);
    for (const field of ["floor", "capacity", "building", "feature"]) {
      if (Object.hasOwn(body, field)) values[field] = body[field];
    }
    const room = await updateAccount(id, values, "room");
    if (!room || room.type !== "room") throw notFound("Room not found");
    return room;
  } catch (error) {
    mapIdentityError(error);
  }
};

export const deleteRoom = async (id) => {
  const room = await softDeleteAccount(id, "room");
  if (!room) throw notFound("Room not found");
  return room;
};

export const getAvailableRooms = async ({ start_dates, end_dates, rooms }) => {
  const start = start_dates || new Date().toISOString();
  const end = end_dates || new Date(Date.now() + 30 * 60_000).toISOString();
  const startDate = parseInstant(start, "start");
  const endDate = parseInstant(end, "end");
  if (endDate <= startDate) {
    throw badRequest("INVALID_RANGE", "A valid end time after start time is required");
  }
  return listAvailableRooms({ start: startDate.toISOString(), end: endDate.toISOString(), roomEmail: rooms });
};

export const getRoomUsage = ({ start, end }) => {
  if (!validDateOnly(start) || !validDateOnly(end) || start > end) {
    throw badRequest("INVALID_RANGE", "Valid start and end dates are required");
  }
  return roomUsageReport({ start, end, timezone: config.appTimezone });
};

export const getRoomStatus = async () => (await listRoomStatus()).map((row) => ({
  id: row._id,
  name: row.name,
  floor: row.floor,
  capacity: row.capacity,
  building: row.building,
  occupied: Boolean(row.event_id),
  organizerFirstName: row.organizer_first_name || null,
  start: row.start_at,
  end: row.end_at,
  checkedIn: Boolean(row.checked_in),
  tabletOnline: Boolean(row.tablet_online),
}));
