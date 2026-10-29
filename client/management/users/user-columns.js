import React from "react";
import { Button, Dropdown, Space, Tag, Tooltip, Typography } from "antd";
import {
  CreditCardOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import { primaryCardNumber } from "./user-cards.js";
import { roleLabel } from "./user-filters.js";

const textSorter = (left, right) => String(left ?? "").localeCompare(String(right ?? ""));

export const UserActions = ({
  row,
  t,
  openEdit,
  openCards,
  openPasswordDialog,
  openDeleteDialog,
}) => {
  const items = [
    { key: "cards", icon: <CreditCardOutlined />, label: t("users.cardsTooltip") },
    { key: "password", icon: <KeyOutlined />, label: t("users.passwordTooltip") },
    ...(row.is_protected ? [] : [
      { type: "divider" },
      { key: "delete", danger: true, icon: <DeleteOutlined />, label: t("users.deleteTooltip") },
    ]),
  ];

  return (
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
      <Dropdown
        trigger={["click"]}
        menu={{
          items,
          onClick: ({ key, domEvent }) => {
            domEvent?.stopPropagation();
            if (key === "cards") openCards(row);
            if (key === "password") openPasswordDialog(row);
            if (key === "delete") openDeleteDialog(row);
          },
        }}
      >
        <Button
          type="text"
          size="small"
          icon={<MoreOutlined />}
          aria-label={t("users.moreActions", { name: row.name })}
        />
      </Dropdown>
    </Space>
  );
};

// Column definitions for the Users table, kept out of the section component so
// the page itself stays readable. All behaviour arrives through `handlers`.
export const buildUserColumns = ({
  t,
  floorLabel,
  openEdit,
  openCards,
  openPasswordDialog,
  openDeleteDialog,
}) => [
  {
    title: t("common:fields.name"),
    dataIndex: "name",
    key: "name",
    width: 320,
    sorter: (left, right) => textSorter(left.name, right.name),
    render: (_, row) => (
      <div>
        <Typography.Text strong>{row.name}</Typography.Text>
        <div>
          <Typography.Text type="secondary">
            {[row.email, row.employee_id].filter(Boolean).join(" · ")}
          </Typography.Text>
        </div>
      </div>
    ),
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
      if (!cardNumber) return <Tag>{t("users.cardMissing")}</Tag>;
      return (
        <Space size={4} wrap>
          <span>{cardNumber}</span>
          {row.is_master_card ? <Tag color="gold">{t("users.masterCard")}</Tag> : null}
        </Space>
      );
    },
  },
  {
    title: t("common:fields.action"),
    key: "actions",
    width: 100,
    render: (_, row) => (
      <UserActions
        row={row}
        t={t}
        openEdit={openEdit}
        openCards={openCards}
        openPasswordDialog={openPasswordDialog}
        openDeleteDialog={openDeleteDialog}
      />
    ),
  },
];
