import { ROLE_IDS } from "../domain/roles.js";

export const createEmptyUserForm = () => ({
  name: "",
  email: "",
  username: "",
  password: "",
  card_number: "",
  master_card: false,
  floor: "",
  roleId: ROLE_IDS.USER,
});

// An empty or whitespace-only floor counts as not filled in.
export const hasFloor = (user) => String(user?.floor ?? "").trim() !== "";
