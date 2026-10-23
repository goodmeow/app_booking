import { useEffect, useState } from "react";
import { getApiError } from "../../domain/api-error.js";
import { ROLE_IDS } from "../../domain/roles.js";
import { createEmptyUserForm } from "../user-form.js";
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
      card_number: editUser.card_number || "",
      master_card: Boolean(editUser.is_master_card),
      floor: editUser.floor || "",
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
      setFormError(getApiError(detailError, t("users.loadOneError")));
      return;
    }

    const name = form.name.trim();
    const email = form.email.trim();
    if (!name || !email || !form.roleId || (formMode === "create" && !form.password)) {
      setFormError(t("users.required"));
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
      name,
      email,
      username: form.username.trim(),
      card_number: cardNumber,
      master_card: Boolean(form.master_card),
      floor: form.floor,
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
      setFormError(getApiError(mutationError, t(formMode === "create" ? "users.createError" : "users.updateError")));
    }
  };

  return {
    formMode,
    form,
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
