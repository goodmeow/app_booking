import React from "react";
import { Divider, Space, Table, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { CMS_VERSION } from "../core/version.js";
import { CMS_LIBRARIES, KIOSK_APP_VERSION, KIOSK_LIBRARIES } from "../domain/licenses.js";

const LicenseTable = ({ rows, t, title }) => {
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
    <section style={{ marginTop: 24 }}>
      <Typography.Title level={5}>{title}</Typography.Title>
      <Table
        size="small"
        rowKey={(row) => `${row.name}-${row.version}`}
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 640 }}
      />
    </section>
  );
};

const AboutSection = () => {
  const { t } = useTranslation("management");
  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>{t("about.title")}</Typography.Title>
      <Typography.Paragraph type="secondary">{t("about.intro")}</Typography.Paragraph>
      <Space wrap size="large" style={{ marginBottom: 16 }}>
        <Typography.Text><strong>CMS/API:</strong> {CMS_VERSION}</Typography.Text>
        <Typography.Text><strong>Kiosk APK:</strong> {KIOSK_APP_VERSION}</Typography.Text>
      </Space>
      <Divider />
      <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
        {t("about.note")}
      </Typography.Paragraph>
      <LicenseTable rows={CMS_LIBRARIES} t={t} title={t("about.cmsLibraries")} />
      <LicenseTable rows={KIOSK_LIBRARIES} t={t} title={t("about.kioskLibraries")} />
      <Typography.Text type="secondary" style={{ display: "block", marginTop: 24 }}>
        {t("about.copyright")}
      </Typography.Text>
    </div>
  );
};

export default AboutSection;
