import React, { useState } from "react";
import { Alert, Button, Card, DatePicker, Space, Table, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, LoadingState } from "../components/common/AsyncState.js";
import {
  currentMonthRange,
  formatDateDDMMMYYYY,
  formatDateYYYYMMDD,
  isValidDateRange,
} from "../domain/dates.js";
import {
  buildRoomUsageWorkbook,
  formatReportMeetingDate,
  reportMeetingsFor,
  safeReportDescription,
  safeReportText,
} from "../domain/report.js";
import { useGetRoomUsageQuery } from "../redux/services/rooms.js";
import { normalizeLanguage } from "../i18n/languages.js";

const RoomUsageReport = () => {
  const { i18n, t } = useTranslation("report");
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const initialRange = currentMonthRange();
  const [start, setStart] = useState(() => formatDateYYYYMMDD(initialRange.start));
  const [end, setEnd] = useState(() => formatDateYYYYMMDD(initialRange.end));
  const validRange = isValidDateRange(start, end);
  const query = useGetRoomUsageQuery({ start, end }, { skip: !validRange });
  const rooms = Array.isArray(query.data) ? query.data : [];
  const hasReportData = Array.isArray(query.data);
  const initialLoading = query.isFetching && !hasReportData;
  const refreshing = query.isFetching && hasReportData;
  const [exportError, setExportError] = useState("");

  const exportReport = async () => {
    setExportError("");
    try {
      const { workbook, filename } = buildRoomUsageWorkbook(ExcelJS, rooms, start, end, language);
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Unable to export room usage report", error);
      setExportError(t("exportError"));
    }
  };

  const meetingColumns = [
    { title: t("subject"), dataIndex: "subject", key: "subject", render: safeReportText },
    { title: t("organizer"), dataIndex: "organizer", key: "organizer", render: safeReportText },
    { title: t("description"), dataIndex: "description", key: "description", render: safeReportDescription },
    {
      title: t("meetingStart"),
      dataIndex: "start_date",
      key: "start_date",
      render: (value) => formatReportMeetingDate(value, language),
    },
    {
      title: t("meetingEnd"),
      dataIndex: "end_date",
      key: "end_date",
      render: (value) => formatReportMeetingDate(value, language),
    },
  ];

  const columns = [
    { title: t("roomName"), dataIndex: "room_name", key: "room_name", render: safeReportText },
    {
      title: t("totalUsage"),
      dataIndex: "total_pemakaian",
      key: "total_pemakaian",
      align: "right",
      render: safeReportText,
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: "100%" }}>
      <Space
        align="start"
        style={{ width: "100%", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>{t("title")}</Typography.Title>
          <Typography.Text type="secondary">
            {t("period", {
              start: formatDateDDMMMYYYY(new Date(`${start}T00:00:00`), language),
              end: formatDateDDMMMYYYY(new Date(`${end}T00:00:00`), language),
            })}
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          disabled={!validRange || query.isFetching || !rooms.length}
          onClick={() => void exportReport()}
        >
          {t("export")}
        </Button>
      </Space>

      <Card size="small">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space wrap>
            <Typography.Text strong>{t("startDate")} – {t("endDate")}</Typography.Text>
            <DatePicker.RangePicker
              allowClear={false}
              format="YYYY-MM-DD"
              value={[start ? dayjs(start) : null, end ? dayjs(end) : null]}
              onChange={(values) => {
                if (!values?.[0] || !values?.[1]) return;
                setStart(values[0].format("YYYY-MM-DD"));
                setEnd(values[1].format("YYYY-MM-DD"));
              }}
            />
          </Space>

          {!validRange ? <Alert type="error" showIcon message={t("invalidRange")} /> : null}
          {exportError ? <Alert type="error" showIcon message={exportError} /> : null}
          {validRange && refreshing ? (
            <Alert type="info" showIcon message={t("common:states.refreshing")} />
          ) : null}
          {validRange && initialLoading ? <LoadingState label={t("loading")} /> : null}
          {validRange && query.isError ? (
            <ErrorState message={t("loadError")} busy={query.isFetching} onAction={() => query.refetch()} />
          ) : null}
          {validRange && !initialLoading && (!query.isError || hasReportData) && !rooms.length ? (
            <EmptyState message={t("empty")} />
          ) : null}
          {validRange && !initialLoading && (!query.isError || hasReportData) && rooms.length ? (
            <Table
              size="small"
              rowKey={(room, index) => room?._id || room?.room_mail || `${room?.room_name || "room"}-${index}`}
              columns={columns}
              dataSource={rooms}
              pagination={false}
              scroll={{ y: 550 }}
              expandable={{
                expandedRowRender: (room) => {
                  const meetings = reportMeetingsFor(room);
                  if (!meetings.length) return <EmptyState message={t("empty")} />;
                  return (
                    <Table
                      size="small"
                      rowKey={(meeting, index) => meeting?._id || `${room?.room_name || "room"}-${index}`}
                      columns={meetingColumns}
                      dataSource={meetings}
                      pagination={false}
                    />
                  );
                },
              }}
            />
          ) : null}
        </Space>
      </Card>
    </div>
  );
};

export default RoomUsageReport;
