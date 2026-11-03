import React from "react";
import { Link } from "react-router-dom";
import { Button, Calendar, Card, Segmented, Select, Space, Tag, Typography, theme } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/en-gb.js";
import "dayjs/locale/id.js";
import { useTranslation } from "react-i18next";
import { calendarLocaleForLanguage } from "../i18n/languages.js";

const roomKey = (room) => room?._id || room?.id || room?.email || room?.name || "";
const roomLabel = (room) => room?.name || room?.email || "";

const formatClock = (value, locale) => value
  ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value))
  : "";

const CalendarSidebar = ({
  selectedDate,
  onDateChange,
  rooms = [],
  floor = "",
  floors = [],
  showAllFloors = false,
  isAdmin = false,
  showTabletStatus = false,
  roomStatus = [],
  scheduleMode = "mine",
  onScheduleModeChange,
  selectedRoom,
  onRoomChange,
  onAdd,
}) => {
  const { i18n, t } = useTranslation("calendar");
  const { token } = theme.useToken();
  const dateLocale = calendarLocaleForLanguage(i18n.resolvedLanguage || i18n.language);
  const floorScope = floors.length ? floors.join(", ") : floor;
  dayjs.locale(dateLocale);

  const modeOptions = [
    { value: "mine", label: t("sidebar.mySchedule") },
    { value: "room", label: t("sidebar.roomSchedule") },
    ...(isAdmin ? [{ value: "all", label: t("sidebar.allSchedule") }] : []),
  ];

  const roomOptions = rooms.map((room) => ({
    value: roomKey(room),
    label: roomLabel(room),
  }));

  return (
    <aside style={{ width: "100%" }}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Button type="primary" block onClick={onAdd}>
          {t("sidebar.addMeeting")}
        </Button>

        <div>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
            {t("sidebar.scheduleMode")}
          </Typography.Title>
          <Segmented
            block
            size="small"
            value={scheduleMode}
            options={modeOptions}
            onChange={(value) => onScheduleModeChange?.(value)}
          />
          <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
            {t(
              scheduleMode === "room"
                ? "sidebar.roomHint"
                : scheduleMode === "all"
                  ? "sidebar.allHint"
                  : "sidebar.mineHint"
            )}
          </Typography.Text>
        </div>

        <Calendar
          fullscreen={false}
          value={selectedDate ? dayjs(selectedDate) : dayjs()}
          onSelect={(value) => onDateChange?.(value.toDate())}
        />

        {scheduleMode === "room" ? (
          <div>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              {t("sidebar.filterTitle")}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              {showAllFloors
                ? t("calendar.floorScopeAll")
                : floorScope
                  ? t("calendar.floorScope", { floor: floorScope })
                  : t("calendar.floorMissing")}
            </Typography.Text>
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              value={selectedRoom ? roomKey(selectedRoom) : undefined}
              options={roomOptions}
              placeholder={t("sidebar.searchRoom")}
              onChange={(value) => onRoomChange?.(rooms.find((room) => roomKey(room) === value) || null)}
              style={{ width: "100%" }}
            />
            {selectedRoom ? (
              <Tag
                color="green"
                closable
                onClose={() => onRoomChange?.(null)}
                style={{ marginTop: 12, maxWidth: "100%" }}
              >
                {roomLabel(selectedRoom)}
              </Tag>
            ) : null}
          </div>
        ) : null}

        {roomStatus.length ? (
          <div>
            <Space align="center" style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }} wrap>
              <Typography.Title level={5} style={{ margin: 0 }}>
                {t("calendar.roomStatusTitle")}
              </Typography.Title>
              <Space size={4} wrap>
                <Tag color="red">{t("calendar.roomUsedCount", { count: roomStatus.filter((room) => room.occupied).length })}</Tag>
                <Tag color="green">{t("calendar.roomFreeCount", { count: roomStatus.filter((room) => !room.occupied).length })}</Tag>
                {roomStatus.some((room) => !room.tabletOnline) ? (
                  <Tag color="gold">{t("calendar.roomOfflineCount", { count: roomStatus.filter((room) => !room.tabletOnline).length })}</Tag>
                ) : null}
              </Space>
            </Space>
            {roomStatus.some((room) => room.occupied) ? (
              <Space direction="vertical" size="small" style={{ width: "100%", maxHeight: 200, overflowY: "auto" }}>
                {roomStatus
                  .filter((room) => room.occupied)
                  .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                  .map((room) => (
                    <Card key={room.id} size="small" style={{ borderColor: token.colorError }}>
                      <Space align="center" style={{ width: "100%", justifyContent: "space-between" }} wrap>
                        <Typography.Text strong ellipsis>{room.name}</Typography.Text>
                        <Tag color="red">{t("calendar.roomOccupied")}</Tag>
                      </Space>
                      <Typography.Text type="secondary" style={{ display: "block" }}>
                        {t("calendar.roomOccupiedBy", {
                          name: room.organizerFirstName || "-",
                          until: formatClock(room.end, dateLocale),
                        })}
                      </Typography.Text>
                    </Card>
                  ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">{t("calendar.roomNoneOccupied")}</Typography.Text>
            )}
            {showTabletStatus ? (
              <Link to="/app-management?section=devices">
                <Button type="link" style={{ paddingLeft: 0, marginTop: 16 }}>
                  {t("calendar.tabletDetailLink")}
                </Button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </Space>
    </aside>
  );
};

export default CalendarSidebar;
