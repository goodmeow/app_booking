import React from "react";
import { Chip, IconButton, Stack, Switch, Tooltip } from "@mui/material";
import EditIconModule from "@mui/icons-material/Edit";
import PasswordIconModule from "@mui/icons-material/Password";
import DeleteIconModule from "@mui/icons-material/Delete";
import CreditCardIconModule from "@mui/icons-material/CreditCard";
import { resolveMuiIcon } from "../../components/common/resolve-mui-icon.js";
import { primaryCardNumber } from "./user-cards.js";
import { roleLabel } from "./user-filters.js";

const EditIcon = resolveMuiIcon(EditIconModule);
const PasswordIcon = resolveMuiIcon(PasswordIconModule);
const DeleteIcon = resolveMuiIcon(DeleteIconModule);
const CreditCardIcon = resolveMuiIcon(CreditCardIconModule);

// Column definitions for the Users grid, kept out of the section component so
// the page itself stays readable. All behaviour arrives through `handlers`.
export const buildUserColumns = ({
  t,
  floorLabel,
  isUpdating,
  toggleMasterCard,
  openEdit,
  openCards,
  openPasswordDialog,
  openDeleteDialog,
}) => [
  { field: "name", headerName: t("common:fields.name"), flex: 1, minWidth: 140 },
  { field: "email", headerName: t("common:fields.email"), flex: 1.25, minWidth: 190 },
  {
    field: "employee_id",
    headerName: t("users.employeeId"),
    minWidth: 130,
    flex: 0.6,
    renderCell: ({ row }) => row.employee_id || "",
  },
  {
    field: "role_id",
    headerName: t("common:fields.role"),
    width: 140,
    valueGetter: ({ row }) => roleLabel(t, row.role_id) || "-",
    renderCell: ({ row }) => {
      const label = roleLabel(t, row.role_id);
      return label ? <Chip size="small" label={label} /> : "-";
    },
  },
  {
    field: "floors",
    headerName: t("users.floorGroup"),
    minWidth: 190,
    sortable: true,
    filterable: false,
    valueGetter: ({ row }) => floorLabel(row.floors?.length ? row.floors : row.floor),
    renderCell: ({ row }) => {
      const floors = row.floors?.length ? row.floors : (row.floor ? [row.floor] : []);
      return floors.length ? (
        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
          {floors.map((floor) => (
            <Chip
              key={floor}
              size="small"
              color={floor === "all" ? "primary" : undefined}
              label={floorLabel(floor)}
            />
          ))}
        </Stack>
      ) : <Chip size="small" color="warning" label={t("users.floorUnset")} />;
    },
  },
  {
    field: "card_number",
    headerName: t("users.cardNumber"),
    minWidth: 150,
    flex: 0.8,
    // The list returns every card; the grid shows the active one.
    valueGetter: ({ row }) => primaryCardNumber(row),
    renderCell: ({ row }) => {
      const cardNumber = primaryCardNumber(row);
      return cardNumber
        ? <span>{cardNumber}</span>
        : <Chip size="small" label={t("users.cardMissing")} />;
    },
  },
  {
    field: "is_master_card",
    headerName: t("users.masterCard"),
    width: 130,
    sortable: false,
    filterable: false,
    renderCell: ({ row }) => {
      const cardNumber = primaryCardNumber(row);
      return (
        <Tooltip title={cardNumber ? t("users.masterCardHelp") : t("users.masterCardNeedsCard")}>
          <span>
            <Switch
              size="small"
              checked={Boolean(row.is_master_card)}
              disabled={!cardNumber || isUpdating}
              inputProps={{ "aria-label": t("users.masterCardAria", { name: row.name }) }}
              onChange={(event) => void toggleMasterCard(row, event.target.checked)}
            />
          </span>
        </Tooltip>
      );
    },
  },
  {
    field: "actions",
    headerName: t("common:fields.action"),
    width: 170,
    sortable: false,
    filterable: false,
    renderCell: ({ row }) => (
      <Stack direction="row" spacing={0.25}>
        <Tooltip title={t("users.editTooltip")}>
          <IconButton aria-label={t("users.editAria", { name: row.name })} size="small" onClick={() => openEdit(row)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("users.cardsTooltip")}>
          <IconButton
            aria-label={t("users.cardsAria", { name: row.name })}
            size="small"
            onClick={() => openCards(row)}
          >
            <CreditCardIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("users.passwordTooltip")}>
          <IconButton
            aria-label={t("users.passwordAria", { name: row.name })}
            size="small"
            onClick={() => openPasswordDialog(row)}
          >
            <PasswordIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {row.is_protected ? null : (
          <Tooltip title={t("users.deleteTooltip")}>
            <IconButton
              aria-label={t("users.deleteAria", { name: row.name })}
              size="small"
              color="error"
              onClick={() => openDeleteDialog(row)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    ),
  },
];
