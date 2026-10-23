import React from "react";
import { Avatar, Box, Button, Divider, Stack, Typography } from "@mui/material";
import DeleteIconModule from "@mui/icons-material/Delete";
import EditIconModule from "@mui/icons-material/Edit";
import LockResetIconModule from "@mui/icons-material/LockReset";
import PersonIconModule from "@mui/icons-material/Person";
import { useTranslation } from "react-i18next";
import { resolveMuiIcon } from "../components/common/resolve-mui-icon.js";
import { formatJoinedDate } from "../domain/profile.js";
import { normalizeLanguage } from "../i18n/languages.js";

const DeleteIcon = resolveMuiIcon(DeleteIconModule);
const EditIcon = resolveMuiIcon(EditIconModule);
const LockResetIcon = resolveMuiIcon(LockResetIconModule);
const PersonIcon = resolveMuiIcon(PersonIconModule);

// Read-only identity card: avatar, name, e-mail, joined date, and the account
// actions that are only offered to the profile owner.
const ProfileSummaryCard = ({ user, isOwner, onEdit, onChangePassword, onDelete }) => {
  const { i18n, t } = useTranslation(["auth", "common"]);
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);

  return (
    <Stack spacing={3} alignItems="center">
      <Avatar sx={{ width: 88, height: 88, bgcolor: "primary.main" }}>
        <PersonIcon sx={{ fontSize: 52 }} />
      </Avatar>
      <Box sx={{ textAlign: "center" }}>
        <Typography variant="h4" component="h1">{user?.name || t("common:states.unknown")}</Typography>
        <Typography color="text.secondary">{user?.email || t("common:states.unknown")}</Typography>
      </Box>
      <Divider flexItem />
      <Typography color="text.secondary">
        {t("auth:profile.joined", { date: formatJoinedDate(user?.created_at, language) })}
      </Typography>
      {isOwner ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: "100%" }}>
          <Button fullWidth variant="contained" startIcon={<EditIcon />} onClick={onEdit}>
            {t("auth:profile.edit")}
          </Button>
          <Button fullWidth variant="outlined" startIcon={<LockResetIcon />} onClick={onChangePassword}>
            {t("common:actions.changePassword")}
          </Button>
          <Button fullWidth color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={onDelete}>
            {t("common:actions.delete")}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
};

export default ProfileSummaryCard;
