import React from "react";
import { Card, Descriptions, Space, Table, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { CMS_VERSION } from "../core/version.js";
import { CMS_LIBRARIES, KIOSK_APP_VERSION, KIOSK_LIBRARIES } from "../domain/licenses.js";

const LicenseTable = ({ rows, t }) => {
  const columns = [
    {
      title: t("about.library"),
      dataIndex: "name",
      key: "name",
      render: (value) => <strong>{value}</strong>,
    },
    { title: t("about.version"), dataIndex: "version", key: "version" },
    { title: t("about.license"), dataIndex: "license", key: "license" },
    {
      title: t("about.source"),
      dataIndex: "url",
      key: "url",
      render: (value) => (
        <Typography.Link href={value} target="_blank" rel="noopener noreferrer">
          {t("about.openSource")}
        </Typography.Link>
      ),
    },
  ];

  return (
    <Table
      size="small"
      rowKey={(row) => `${row.name}-${row.version}`}
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 640 }}
    />
  );
};

const AboutSection = () => {
  const { t } = useTranslation("management");
  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>{t("about.title")}</Typography.Title>

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card size="small" title={t("about.versionTitle")}>
          <Descriptions
            size="small"
            column={2}
            items={[
              { key: "cms", label: "CMS/API", children: CMS_VERSION },
              { key: "kiosk", label: "Kiosk APK", children: KIOSK_APP_VERSION },
            ]}
          />
          <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 8 }}>
            {t("about.intro")}
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t("about.note")}
          </Typography.Paragraph>
        </Card>

        <Card size="small" title={t("about.cmsLibraries")}>
          <LicenseTable rows={CMS_LIBRARIES} t={t} />
        </Card>

        <Card size="small" title={t("about.kioskLibraries")}>
          <LicenseTable rows={KIOSK_LIBRARIES} t={t} />
        </Card>

        <Typography.Text type="secondary">{t("about.copyright")}</Typography.Text>
      </Space>
    </div>
  );
};

export default AboutSection;
