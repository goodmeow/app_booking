import React from "react";
import { Avatar, Button, Divider, Space, Typography } from "antd";
import { EditOutlined, KeyOutlined, UserOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { formatJoinedDate } from "../domain/profile.js";
import { normalizeLanguage } from "../i18n/languages.js";

// Read-only identity card: avatar, name, e-mail, joined date, and the account
// actions that are only offered to the profile owner.
const ProfileSummaryCard = ({ user, isOwner, onEdit, onChangePassword }) => {
  const { i18n, t } = useTranslation(["auth", "common"]);
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);

  return (
    <Space direction="vertical" size="large" align="center" style={{ width: "100%" }}>
      <Avatar size={88} icon={<UserOutlined />} style={{ background: "#2FB46A", color: "#0A1F14" }} />
      <div style={{ textAlign: "center" }}>
        <Typography.Title level={3} style={{ marginBottom: 0 }}>
          {user?.name || t("common:states.unknown")}
        </Typography.Title>
        <Typography.Text type="secondary">
          {user?.email || t("common:states.unknown")}
        </Typography.Text>
      </div>
      <Divider style={{ margin: 0 }} />
      <Typography.Text type="secondary">
        {t("auth:profile.joined", { date: formatJoinedDate(user?.created_at, language) })}
      </Typography.Text>
      {isOwner ? (
        <Space style={{ width: "100%" }} wrap>
          <Button type="primary" icon={<EditOutlined />} onClick={onEdit}>
            {t("auth:profile.edit")}
          </Button>
          <Button icon={<KeyOutlined />} onClick={onChangePassword}>
            {t("common:actions.changePassword")}
          </Button>
        </Space>
      ) : null}
    </Space>
  );
};

export default ProfileSummaryCard;
