import React from "react";
import { Button, Space, Tag, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined, KeyOutlined } from "@ant-design/icons";

const tabletTag = (device, t) => {
  if (!device) return <Tag>{t("rooms.tabletNone")}</Tag>;
  if (device.status === "revoked") return <Tag color="red">{t("rooms.tabletRevoked")}</Tag>;
  return device.online
    ? <Tag color="green">{t("rooms.tabletOnline")}</Tag>
    : <Tag>{t("rooms.tabletOffline")}</Tag>;
};

// A room can have old revoked devices plus one active tablet. The list is
// ordered with active devices first, but a plain Map.set() would let the later
// revoked row overwrite it, so keep the first non-revoked device.
export const devicesByRoom = (devices = []) => {
  const map = new Map();
  for (const device of Array.isArray(devices) ? devices : []) {
    const key = String(device.roomId);
    const current = map.get(key);
    if (!current || (current.status === "revoked" && device.status !== "revoked")) {
      map.set(key, device);
    }
  }
  return map;
};

// Column definitions for the Rooms table. `deviceByRoom` maps a room id to its
// paired tablet, so the tablet column stays a pure lookup.
export const buildRoomColumns = ({
  t,
  deviceByRoom,
  openEdit,
  openPasswordDialog,
  openDeleteDialog,
}) => [
  { title: t("common:fields.name"), dataIndex: "name", key: "name", width: 160 },
  { title: t("rooms.building"), dataIndex: "building", key: "building", width: 140 },
  { title: t("rooms.capacity"), dataIndex: "capacity", key: "capacity", width: 100 },
  { title: t("rooms.floor"), dataIndex: "floor", key: "floor", width: 90 },
  { title: t("common:fields.email"), dataIndex: "email", key: "email", width: 220 },
  {
    title: t("rooms.tablet"),
    key: "tablet",
    width: 150,
    render: (_, row) => tabletTag(deviceByRoom.get(String(row._id)), t),
  },
  {
    title: t("common:fields.action"),
    key: "actions",
    width: 150,
    render: (_, row) => (
      <Space size={2}>
        <Tooltip title={t("common:actions.edit")}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            aria-label={`${t("common:actions.edit")} ${row.name}`}
            onClick={() => openEdit(row)}
          />
        </Tooltip>
        <Tooltip title={t("common:actions.changePassword")}>
          <Button
            type="text"
            size="small"
            icon={<KeyOutlined />}
            aria-label={`${t("common:actions.changePassword")} ${row.name}`}
            onClick={() => openPasswordDialog(row)}
          />
        </Tooltip>
        <Tooltip title={t("common:actions.delete")}>
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            aria-label={`${t("common:actions.delete")} ${row.name}`}
            onClick={() => openDeleteDialog(row)}
          />
        </Tooltip>
      </Space>
    ),
  },
];
