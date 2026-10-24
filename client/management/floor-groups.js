import { ROLE_IDS } from "../domain/roles.js";
import { hasFloor } from "./user-form.js";

const floorOf = (record) => String(record?.floor ?? "").trim();

// Floor 2 must come before floor 10, so compare numerically when possible.
const compareFloors = (first, second) => first.localeCompare(second, undefined, { numeric: true });

const employees = (users) => (Array.isArray(users) ? users : []);

// The floor list comes from the Rooms tab: a floor exists once it has a room.
const floorNames = (rooms) => {
  const seen = new Set();
  for (const room of Array.isArray(rooms) ? rooms : []) {
    const floor = floorOf(room);
    if (floor) seen.add(floor);
  }
  return [...seen].sort(compareFloors);
};

export const missingFloorCount = (users) => employees(users).filter((user) => !hasFloor(user)).length;

// One read-only row per floor: how many rooms it has, how many employees are
// grouped into it, and which receptionists work the front desk there.
export const floorGroupRows = ({
  rooms = [],
  users = [],
  receptionistRoleId = ROLE_IDS.RECEPTIONIST,
} = {}) => floorNames(rooms).map((floor) => {
  const floorRooms = (Array.isArray(rooms) ? rooms : []).filter((room) => floorOf(room) === floor);
  const floorUsers = employees(users).filter((user) => floorOf(user) === floor);
  return {
    floor,
    roomCount: floorRooms.length,
    employeeCount: floorUsers.length,
    receptionists: floorUsers
      .filter((user) => user?.role_id === receptionistRoleId)
      .map((user) => user.name || user.email)
      .filter(Boolean),
  };
});
