import { useEffect, useState } from "react";
import { ROLE_IDS } from "../../domain/roles.js";
import { createEmptyUserForm, employeeIdErrorKey } from "../user-form.js";
import { primaryCardNumber } from "./user-cards.js";
import { userMutationError } from "./user-api-errors.js";
import {
  useCreateUserMutation,
  useDetailUserQuery,
  useUpdateUserMutation,
} from "../../redux/services/users.js";

// Owns the create/edit user dialog: the draft form, the detail fetch that fills
// it, validation, and the two mutations. The section only wires the dialog up.
export const useUserFormDialog = ({ t, onSaved }) => {
  const [formMode, setFormMode] = useState(null);
  const [form, setForm] = useState(createEmptyUserForm);
  const [formError, setFormError] = useState("");
  const [editUserId, setEditUserId] = useState(null);

  const {
    data: editUser,
    isFetching: isDetailLoading,
    isError: isDetailError,
    error: detailError,
  } = useDetailUserQuery(editUserId, { skip: !editUserId });

  const [createUser, { isLoading: isCreating, reset: resetCreate }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating, reset: resetUpdate }] = useUpdateUserMutation();
  const isSaving = isCreating || isUpdating;

  useEffect(() => {
    if (!editUser || editUser._id !== editUserId) return;
    setForm({
      name: editUser.name || "",
      email: editUser.email || "",
      username: editUser.username || "",
      password: "",
      employee_id: editUser.employee_id || "",
      card_number: primaryCardNumber(editUser),
      master_card: Boolean(editUser.is_master_card),
      must_change_password: Boolean(editUser.must_change_password),
      floor: editUser.floor || "",
      floors: Array.isArray(editUser.floors) && editUser.floors.length
        ? editUser.floors
        : (editUser.floor ? [editUser.floor] : []),
      roleId: editUser.role_id || ROLE_IDS.USER,
    });
  }, [editUser, editUserId]);

  const close = () => {
    if (isSaving) return;
    setFormMode(null);
    setEditUserId(null);
    setForm(createEmptyUserForm());
    setFormError("");
    resetCreate();
    resetUpdate();
  };

  const openCreate = () => {
    resetCreate();
    resetUpdate();
    setEditUserId(null);
    setForm(createEmptyUserForm());
    setFormError("");
    setFormMode("create");
  };

  const openEdit = (user) => {
    resetCreate();
    resetUpdate();
    setEditUserId(user._id);
    setForm({ ...createEmptyUserForm(), name: user.name || "", email: user.email || "", username: user.username || "" });
    setFormError("");
    setFormMode("edit");
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (formMode === "edit" && isDetailError) {
      setFormError(userMutationError(detailError, t, t("users.loadOneError")));
      return;
    }

    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email || !form.roleId || (formMode === "create" && !form.password)) {
      setFormError(t("users.required"));
      return;
    }
    const employeeIdError = employeeIdErrorKey(form.employee_id);
    if (employeeIdError) {
      setFormError(t(employeeIdError));
      return;
    }
    if (formMode === "create" && form.password.length < 8) {
      setFormError(t("users.passwordTooShort"));
      return;
    }

    const cardNumber = form.card_number.trim();
    if (form.master_card && !cardNumber) {
      setFormError(t("users.masterCardNeedsCard"));
      return;
    }

    const body = {
      employee_id: form.employee_id.trim(),
      name,
      email,
      username: form.username.trim(),
      card_number: cardNumber,
      master_card: Boolean(form.master_card),
      must_change_password: Boolean(form.must_change_password),
      floor: form.floor,
      floors: form.floors,
      roleId: form.roleId,
    };

    try {
      if (formMode === "create") {
        await createUser({ ...body, password: form.password }).unwrap();
        onSaved(t("users.created"));
      } else {
        await updateUser({ userId: editUserId, ...body }).unwrap();
        onSaved(t("users.updated"));
      }
      setFormMode(null);
      setEditUserId(null);
      setForm(createEmptyUserForm());
      setFormError("");
      resetCreate();
      resetUpdate();
    } catch (mutationError) {
      setFormError(userMutationError(
        mutationError,
        t,
        t(formMode === "create" ? "users.createError" : "users.updateError"),
      ));
    }
  };

  return {
    formMode,
    form,
    isProtectedAccount: Boolean(editUser?.is_protected),
    setForm,
    formError,
    detailError: isDetailError ? detailError : null,
    isDetailLoading,
    isSaving,
    openCreate,
    openEdit,
    closeForm: close,
    submitForm: submit,
  };
};
