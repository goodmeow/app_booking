import React, { useMemo, useState } from "react";
import { Alert, Button, Divider, Drawer, Space, Tag, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { calendarLocaleForLanguage } from "../i18n/languages.js";
import { formatMeetingDateCue, formatMeetingTimeRange } from "../domain/calendar.js";
import { getApiError } from "../domain/api-error.js";
import { useDeleteEventByIdMutation, useGetEventDetailsQuery } from "../redux/services/events.js";
import ConfirmDialog from "../components/common/ConfirmDialog.js";

const EventDetailsDrawer = ({ open, event, rooms = [], canMutate = false, onClose, onEdit }) => {
  const { t, i18n } = useTranslation(["calendar", "common"]);
  const locale = calendarLocaleForLanguage(i18n.resolvedLanguage || i18n.language) === "id" ? "id-ID" : "en-GB";
  const { data: participants = [], isError: detailsError } = useGetEventDetailsQuery(event?.id, { skip: !open || !event });
  const [removeEvent, removeState] = useDeleteEventByIdMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");

  const roomName = useMemo(() => {
    if (!Array.isArray(participants)) return "";
    const roomParticipant = participants.find((participant) => participant.roomId);
    if (!roomParticipant) return "";
    const room = rooms.find((item) => item._id === roomParticipant.roomId || item.email === roomParticipant.email);
    return room?.name || roomParticipant.email || "";
  }, [participants, rooms]);

  const attendees = useMemo(
    () => (Array.isArray(participants) ? participants.filter((participant) => !participant.roomId).map((participant) => participant.email) : []),
    [participants]
  );

  const confirmCancel = async () => {
    setError("");
    try {
      await removeEvent({ eventId: event.id, scope: "occurrence" }).unwrap();
      setConfirmOpen(false);
      onClose();
    } catch (reason) {
      setError(getApiError(reason, t("calendar.cancelError")));
    }
  };

  return (
    <Drawer
      title={event?.title || t("calendar.untitled")}
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
        {formatMeetingDateCue(event?.start, event?.end, locale)}
      </Typography.Paragraph>
      <Typography.Paragraph>
        {formatMeetingTimeRange(event?.start, event?.end, locale)}
      </Typography.Paragraph>

      <Space size={4} wrap style={{ marginBottom: 16 }}>
        <Tag color={event?.checked_in ? "green" : undefined}>
          {event?.checked_in ? t("calendar.checkedIn") : t("calendar.notCheckedIn")}
        </Tag>
        {event?.organizer ? <Tag>{event.organizer}</Tag> : null}
      </Space>

      <Divider />
      <Typography.Text strong>{t("calendar.detailRoom")}</Typography.Text>
      <Typography.Paragraph type="secondary">{roomName || "-"}</Typography.Paragraph>

      {event?.booked_by_name ? (
        <>
          <Typography.Text strong>{t("calendar.detailBookedBy")}</Typography.Text>
          <Typography.Paragraph type="secondary">
            {t("calendar.bookedBy", { name: event.booked_by_name })}
          </Typography.Paragraph>
        </>
      ) : null}

      <Typography.Text strong>{t("calendar.detailAttendees")}</Typography.Text>
      <Typography.Paragraph type="secondary">
        {attendees.length ? attendees.join(", ") : "-"}
      </Typography.Paragraph>

      {detailsError ? (
        <Alert type="warning" showIcon message={t("calendar.detailsLoadError")} style={{ marginBottom: 16 }} />
      ) : null}
      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      ) : null}

      <Space>
        <Button type="primary" disabled={!canMutate} onClick={onEdit}>
          {t("common:actions.edit")}
        </Button>
        <Button
          danger
          disabled={!canMutate || removeState.isLoading}
          onClick={() => setConfirmOpen(true)}
        >
          {t("calendar.cancelMeeting")}
        </Button>
      </Space>

      <ConfirmDialog
        open={confirmOpen}
        title={t("calendar.cancelTitle")}
        message={t("calendar.cancelMessage")}
        loading={removeState.isLoading}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmCancel}
      />
    </Drawer>
  );
};

export default EventDetailsDrawer;
