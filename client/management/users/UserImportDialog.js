import React, { useRef, useState } from "react";
import { Alert, Button, Modal, Select, Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { getApiError } from "../../domain/api-error.js";
import { parseUserCsv } from "../../domain/users/user-import-csv.js";
import { useImportUsersMutation } from "../../redux/services/users.js";

const TEMPLATE = "employee_id,name,email,role,floor,card_number";

const UserImportDialog = ({ open, onClose, onImported }) => {
  const { t } = useTranslation(["management", "common"]);
  const [importUsers, { isLoading }] = useImportUsersMutation();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState("skip");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const reset = () => {
    setRows([]);
    setFileName("");
    setMode("skip");
    setError("");
    setResult(null);
  };

  const close = () => {
    if (isLoading) return;
    reset();
    onClose?.();
  };

  const pickFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError("");
    setResult(null);
    if (!file) return;
    try {
      const parsed = parseUserCsv(await file.text());
      setRows(parsed);
      setFileName(file.name);
    } catch (reason) {
      setRows([]);
      setFileName("");
      setError(reason.message || t("users.importParseError"));
    }
  };

  const submit = async () => {
    setError("");
    try {
      const summary = await importUsers({ rows, mode }).unwrap();
      setResult(summary);
      onImported?.(summary);
    } catch (reason) {
      setError(getApiError(reason, t("users.importError")));
    }
  };

  return (
    <Modal
      open={open}
      title={t("users.importTitle")}
      width={620}
      onCancel={close}
      maskClosable={!isLoading}
      closable={!isLoading}
      footer={[
        <Button key="close" onClick={close} disabled={isLoading}>
          {t("common:actions.close")}
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={isLoading}
          disabled={!rows.length}
          onClick={submit}
        >
          {isLoading ? t("users.importing") : t("users.importSubmit")}
        </Button>,
      ]}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%", marginTop: 8 }}>
        <Typography.Text type="secondary">{t("users.importHelp")}</Typography.Text>
        <Typography.Text code>{TEMPLATE}</Typography.Text>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={pickFile}
        />
        <Button disabled={isLoading} onClick={() => fileInputRef.current?.click()}>
          {fileName || t("users.importChoose")}
        </Button>
        {rows.length ? <Alert type="info" showIcon message={t("users.importRows", { count: rows.length })} /> : null}
        <div>
          <Typography.Text>{t("users.importMode")}</Typography.Text>
          <Select
            value={mode}
            disabled={isLoading}
            style={{ width: "100%", marginTop: 4 }}
            options={[
              { value: "skip", label: t("users.importSkip") },
              { value: "overwrite", label: t("users.importOverwrite") },
            ]}
            onChange={setMode}
          />
          <Typography.Text type="secondary">{t("users.importModeHelp")}</Typography.Text>
        </div>
        <Typography.Text type="secondary">{t("users.importPasswordNote")}</Typography.Text>
        {error ? <Alert type="error" showIcon message={error} /> : null}
        {result ? (
          <Alert
            type={result.failed ? "warning" : "success"}
            showIcon
            message={t("users.importSummary", {
              created: result.created,
              updated: result.updated,
              skipped: result.skipped,
              failed: result.failed,
            })}
            description={result.errors?.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.errors.slice(0, 5).map((item) => (
                  <li key={`${item.row}-${item.employee_id}`}>
                    {t("users.importErrorRow", {
                      row: item.row,
                      employee: item.employee_id,
                      message: item.message,
                    })}
                  </li>
                ))}
              </ul>
            ) : null}
          />
        ) : null}
      </Space>
    </Modal>
  );
};

export default UserImportDialog;
