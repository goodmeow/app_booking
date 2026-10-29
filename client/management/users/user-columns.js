import React from "react";
import { Button, Space, Switch, Tag, Tooltip } from "antd";
import {
  CreditCardOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import { primaryCardNumber } from "./user-cards.js";
import { roleLabel } from "./user-filters.js";

const textSorter = (left, right) => String(left ?? "").localeCompare(String(right ?? ""));

// Column definitions for the Users table, kept out of the section component so
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
  {
    title: t("common:fields.name"),
    dataIndex: "name",
    key: "name",
    width: 180,
    sorter: (left, right) => textSorter(left.name, right.name),
  },
  {
    title: t("common:fields.email"),
    dataIndex: "email",
    key: "email",
    width: 230,
    sorter: (left, right) => textSorter(left.email, right.email),
  },
  {
    title: t("users.employeeId"),
    dataIndex: "employee_id",
    key: "employee_id",
    width: 140,
    render: (value) => value || "",
  },
  {
    title: t("common:fields.role"),
    dataIndex: "role_id",
    key: "role_id",
    width: 150,
    render: (roleId) => {
      const label = roleLabel(t, roleId);
      return label ? <Tag color="green">{label}</Tag> : "-";
    },
  },
  {
    title: t("users.floorGroup"),
    dataIndex: "floors",
    key: "floors",
    width: 220,
    render: (_, row) => {
      const floors = row.floors?.length ? row.floors : (row.floor ? [row.floor] : []);
      if (!floors.length) return <Tag color="warning">{t("users.floorUnset")}</Tag>;
      return (
        <Space size={4} wrap>
          {floors.map((floor) => (
            <Tag key={floor} color={floor === "all" ? "green" : undefined}>
              {floorLabel(floor)}
            </Tag>
          ))}
        </Space>
      );
    },
  },
  {
    title: t("users.cardNumber"),
    dataIndex: "card_number",
    key: "card_number",
    width: 170,
    render: (_, row) => {
      const cardNumber = primaryCardNumber(row);
      return cardNumber ? <span>{cardNumber}</span> : <Tag>{t("users.cardMissing")}</Tag>;
    },
  },
  {
    title: t("users.masterCard"),
    dataIndex: "is_master_card",
    key: "is_master_card",
    width: 140,
    render: (_, row) => {
      const cardNumber = primaryCardNumber(row);
      const help = cardNumber ? t("users.masterCardHelp") : t("users.masterCardNeedsCard");
      return (
        <Tooltip title={help}>
          <span>
            <Switch
              size="small"
              checked={Boolean(row.is_master_card)}
              disabled={!cardNumber || isUpdating}
              aria-label={t("users.masterCardAria", { name: row.name })}
              onChange={(checked) => void toggleMasterCard(row, checked)}
            />
          </span>
        </Tooltip>
      );
    },
  },
  {
    title: t("common:fields.action"),
    key: "actions",
    width: 170,
    render: (_, row) => (
      <Space size={2}>
        <Tooltip title={t("users.editTooltip")}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            aria-label={t("users.editAria", { name: row.name })}
            onClick={() => openEdit(row)}
          />
        </Tooltip>
        <Tooltip title={t("users.cardsTooltip")}>
          <Button
            type="text"
            size="small"
            icon={<CreditCardOutlined />}
            aria-label={t("users.cardsAria", { name: row.name })}
            onClick={() => openCards(row)}
          />
        </Tooltip>
        <Tooltip title={t("users.passwordTooltip")}>
          <Button
            type="text"
            size="small"
            icon={<KeyOutlined />}
            aria-label={t("users.passwordAria", { name: row.name })}
            onClick={() => openPasswordDialog(row)}
          />
        </Tooltip>
        {row.is_protected ? null : (
          <Tooltip title={t("users.deleteTooltip")}>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              aria-label={t("users.deleteAria", { name: row.name })}
              onClick={() => openDeleteDialog(row)}
            />
          </Tooltip>
        )}
      </Space>
    ),
  },
];
