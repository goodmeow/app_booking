import { ROLE_IDS } from "../domain/roles.js";

export const createEmptyUserForm = () => ({
  name: "",
  email: "",
  username: "",
  password: "",
  card_number: "",
  master_card: false,
  roleId: ROLE_IDS.USER,
});
