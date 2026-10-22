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
