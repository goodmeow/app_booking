import React, { useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Divider, Drawer, Stack, Typography } from "@mui/material";
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
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: 320, sm: 420 }, p: 3 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>{event?.title || t("calendar.untitled")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {formatMeetingDateCue(event?.start, event?.end, locale)}
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {formatMeetingTimeRange(event?.start, event?.end, locale)}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Chip
            size="small"
            color={event?.checked_in ? "success" : "default"}
            label={event?.checked_in ? t("calendar.checkedIn") : t("calendar.notCheckedIn")}
          />
          {event?.organizer ? <Chip size="small" variant="outlined" label={event.organizer} /> : null}
        </Stack>

        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2">{t("calendar.detailRoom")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{roomName || "-"}</Typography>

        <Typography variant="subtitle2">{t("calendar.detailAttendees")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {attendees.length ? attendees.join(", ") : "-"}
        </Typography>

        {detailsError ? <Alert severity="warning" sx={{ mb: 2 }}>{t("calendar.detailsLoadError")}</Alert> : null}
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

        <Stack direction="row" spacing={1}>
          <Button variant="contained" disabled={!canMutate} onClick={onEdit}>
            {t("common:actions.edit")}
          </Button>
          <Button
            color="error"
            variant="outlined"
            disabled={!canMutate || removeState.isLoading}
            onClick={() => setConfirmOpen(true)}
          >
            {t("calendar.cancelMeeting")}
          </Button>
        </Stack>
      </Box>

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
