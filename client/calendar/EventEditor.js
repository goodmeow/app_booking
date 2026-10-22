import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs from "dayjs";
import FeedbackSnackbar from "../components/common/FeedbackSnackbar.js";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { durationMinutes } from "../domain/calendar.js";
import { getApiError } from "../domain/api-error.js";
import {
  buildModernEventPayload,
  buildCreateEventPayload,
  buildUpdateEventPayload,
  encodeEventDescription,
  isRoomAttendee,
  validateEventDraft,
} from "../domain/events/event-contract.js";
import {
  useDeleteEventByIdMutation,
  useGetEventDetailsQuery,
  usePreviewEventsMutation,
  useStoreEventMutation,
  useUpdateEventMutation,
} from "../redux/services/events.js";
import { useLazyGetAvailableRoomsQuery } from "../redux/services/rooms.js";
import { calendarLocaleForLanguage } from "../i18n/languages.js";

const pad = (value) => String(value).padStart(2, "0");

const toDateTimeInput = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const eventField = (event, name) => event?.[name] ?? event?.extendedProps?.[name];

const safeDecode = (value) => {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return String(value);
  }
};

const emailOf = (value) => typeof value === "string" ? value : value?.email || value?.attendee_email || "";
const idOf = (value) => typeof value === "string" ? "" : value?._id || value?.attendee_user_id || value?.userId || "";

const uniqueAttendees = (values) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).reduce((result, value) => {
    const attendee_email = emailOf(value).trim();
    const key = attendee_email.toLowerCase();
    if (!attendee_email || seen.has(key)) return result;
    seen.add(key);
    result.push({
      attendee_email,
      ...(value?.type ? { type: value.type } : {}),
      ...(value?.room_id ? { room_id: value.room_id } : {}),
      ...(idOf(value) ? { attendee_user_id: idOf(value) } : {}),
    });
    return result;
  }, []);
};

const defaultRange = (initialStart, initialEnd) => {
  const start = initialStart ? new Date(initialStart) : new Date();
  const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
  const end = initialEnd ? new Date(initialEnd) : new Date(safeStart.getTime() + 60 * 60 * 1000);
  return {
    start: toDateTimeInput(safeStart),
    end: toDateTimeInput(Number.isNaN(end.getTime()) ? new Date(safeStart.getTime() + 60 * 60 * 1000) : end),
  };
};

const EventEditor = ({
  open,
  event,
  initialStart,
  initialEnd,
  sessionEmail,
  users = [],
  rooms = [],
  initialRoom,
  onClose,
}) => {
  const { t, i18n } = useTranslation(["calendar", "common"]);
  const dateLocale = calendarLocaleForLanguage(i18n.resolvedLanguage || i18n.language);
  const eventId = event?.id;
  const editing = Boolean(eventId);
  const details = useGetEventDetailsQuery(eventId, { skip: !open || !editing });
  const [previewEvents, previewState] = usePreviewEventsMutation();
  const [fetchAvailableRooms] = useLazyGetAvailableRoomsQuery();
  const [conflictCount, setConflictCount] = useState(0);
  const [conflictShown, setConflictShown] = useState(0);
  const [conflictTruncated, setConflictTruncated] = useState(false);
  const [alternatives, setAlternatives] = useState([]);
  const [storeEvent, storeState] = useStoreEventMutation();
  const [updateEvent, updateState] = useUpdateEventMutation();
  const [deleteEventById, deleteState] = useDeleteEventByIdMutation();
  const [draft, setDraft] = useState({
    subject: "",
    startDate: "",
    startTime: "00:00",
    endDate: "",
    endTime: "23:59",
    description: "",
    bookingKind: "single",
    recurrence: { cadence: "daily", interval: 1, endDate: "", weekdays: [], monthlyPattern: "date", monthWeekIndex: 1, monthWeekday: 1 },
    scope: "occurrence",
    attendees: [],
  });
  const [error, setError] = useState("");
  const [guidance, setGuidance] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: "", severity: "error" });

  // Input "24:00" tidak dikenal, jadi batas akhir hari memakai 23:59
  // (satu menit sebelum tengah malam). Timezone tidak lagi dipilih: server
  // memakai zona waktu aplikasi.
  const startValue = draft.startDate ? `${draft.startDate}T${draft.startTime}` : "";
  // Pada Recurring, rentang tanggal dikuasai "Ulangi sampai"; durasi tiap
  // occurrence ikut jam mulai-jam selesai hari pertama.
  const endDay = !editing && draft.bookingKind === "recurring" ? draft.startDate : draft.endDate;
  const endValue = endDay ? `${endDay}T${draft.endTime}` : "";

  const userEmails = useMemo(() => uniqueAttendees(users).map(({ attendee_email }) => attendee_email), [users]);
  const usersByEmail = useMemo(() => new Map(users.map((user) => [String(user.email || "").toLowerCase(), user])), [users]);
  const attendeeEmails = draft.attendees.filter((item) => !isRoomAttendee(item)).map(emailOf);
  const location = draft.attendees.find(isRoomAttendee)?.attendee_email || null;
  const locationValue = rooms.find((room) => room.email === location)
    || (location ? { name: location, email: location } : null);
  const organizer = eventField(event, "organizer") || sessionEmail || "";
  const eventEnd = eventField(event, "end");
  const isOrganizer = !editing || String(organizer) === String(sessionEmail || "");
  const hasEnded = editing && eventEnd && new Date(eventEnd) < new Date();
  const readOnly = editing && (!isOrganizer || hasEnded);
  const recurringEvent = Boolean(eventField(event, "series_id"));
  const busy = storeState.isLoading || updateState.isLoading || deleteState.isLoading || previewState.isLoading;
  const duration = durationMinutes(startValue, endValue);

  useEffect(() => {
    if (!open) return;
    const range = defaultRange(initialStart, initialEnd);
    const storedStart = toDateTimeInput(eventField(event, "start")) || range.start;
    const storedEnd = toDateTimeInput(eventEnd) || range.end;
    const initialAttendees = initialRoom?.email
      ? [{ attendee_email: initialRoom.email, type: "room", room_id: initialRoom._id }]
      : [];
    // Form kosong (bukan dari klik slot kalender atau meeting lama) memakai
    // seharian penuh 00:00-23:59 agar pengguna tidak berhadapan dengan jam.
    const freshForm = !initialStart && !eventField(event, "start");
    const startDay = storedStart.slice(0, 10);
    setDraft({
      subject: event?.title || eventField(event, "subject") || "",
      startDate: startDay,
      startTime: freshForm ? "00:00" : (storedStart.slice(11, 16) || "00:00"),
      endDate: freshForm ? startDay : storedEnd.slice(0, 10),
      endTime: freshForm ? "23:59" : (storedEnd.slice(11, 16) || "23:59"),
      description: safeDecode(eventField(event, "description")),
      // Timezone rumpun dipilih sendiri oleh pengguna: server memakai zona
      // waktu aplikasi. Saat mengedit, timezone tersimpan ikut dikirim agar
      // occurrence lama tidak bergeser.
      ...(eventField(event, "timezone") ? { timezone: eventField(event, "timezone") } : {}),
      bookingKind: "single",
      recurrence: { cadence: "daily", interval: 1, endDate: "", weekdays: [], monthlyPattern: "date", monthWeekIndex: 1, monthWeekday: 1 },
      scope: "occurrence",
      attendees: initialAttendees,
    });
    setError("");
    setGuidance("");
    setDeleteConfirmOpen(false);
  }, [open, eventId, initialStart, initialEnd, initialRoom?._id]);

  useEffect(() => {
    if (!open || !editing || !Array.isArray(details.data)) return;
    setDraft((current) => ({ ...current, attendees: uniqueAttendees(details.data) }));
  }, [open, editing, eventId, details.data]);

  const change = (name) => (changeEvent) => {
    setDraft((current) => ({ ...current, [name]: changeEvent.target.value }));
    setError("");
    setGuidance("");
  };

  // Setter untuk nilai langsung (mis. hasil TimePicker berupa string "HH:mm").
  const changeValue = (name) => (value) => {
    setDraft((current) => ({ ...current, [name]: value }));
    setError("");
    setGuidance("");
  };

  const changeRecurrence = (name) => (changeEvent) => {
    setDraft((current) => ({
      ...current,
      recurrence: { ...current.recurrence, [name]: changeEvent.target.value },
    }));
    setError("");
    setGuidance("");
  };

  const selectRoom = (value) => {
    setDraft((current) => {
      const people = current.attendees.filter((item) => !isRoomAttendee(item));
      return {
        ...current,
        attendees: uniqueAttendees([
          ...people,
          ...(value?.email ? [{ attendee_email: value.email, type: "room", room_id: value._id }] : []),
        ]),
      };
    });
    setError("");
    setGuidance("");
  };

  // Cek konflik saat waktu/ruangan berubah, lalu tawarkan ruangan lain yang kosong.
  useEffect(() => {
    if (!open || editing || readOnly || !location || !startValue || !endValue) {
      setConflictCount(0);
      setConflictShown(0);
      setConflictTruncated(false);
      setAlternatives([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const attendees = uniqueAttendees(draft.attendees);
        const eventDraft = {
          organizer,
          subject: draft.subject || "preview",
          description: encodeEventDescription(draft.description),
          startDate: startValue,
          endDate: endValue,
          timezone: draft.timezone,
          bookingKind: draft.bookingKind,
          recurrence: draft.recurrence,
          scope: draft.scope,
          attendees,
        };
        let count = 0;
        try {
          const preview = await previewEvents(buildModernEventPayload(eventDraft)).unwrap();
          const returned = Array.isArray(preview.conflicts) ? preview.conflicts.length : 0;
          count = Number.isFinite(Number(preview.conflictTotal)) ? Number(preview.conflictTotal) : returned;
          setConflictShown(returned);
          setConflictTruncated(Boolean(preview.conflictsTruncated));
        } catch {
          setConflictCount(0);
          setConflictShown(0);
          setConflictTruncated(false);
          setAlternatives([]);
          return;
        }
        setConflictCount(count);
        if (!count) {
          setAlternatives([]);
          setConflictTruncated(false);
          return;
        }
        try {
          const available = await fetchAvailableRooms({
            start_dates: new Date(startValue).toISOString(),
            end_dates: new Date(endValue).toISOString(),
          }).unwrap();
          const freeEmails = new Set((available || []).map((room) => String(room.email).toLowerCase()));
          const peopleCount = attendees.filter((item) => !isRoomAttendee(item)).length;
          setAlternatives(
            rooms
              .filter((room) => freeEmails.has(String(room.email).toLowerCase()))
              .filter((room) => String(room.email).toLowerCase() !== String(location).toLowerCase())
              .filter((room) => !room.capacity || Number(room.capacity) >= peopleCount)
              .slice(0, 4)
          );
        } catch {
          setAlternatives([]);
        }
      } catch {
        setConflictCount(0);
        setAlternatives([]);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [
    open, editing, readOnly, location, organizer, rooms,
    startValue, endValue, draft.timezone, draft.subject, draft.description,
    draft.bookingKind, draft.recurrence, draft.scope, draft.attendees,
    previewEvents, fetchAvailableRooms,
  ]);

  const close = () => {
    if (!busy) onClose();
  };

  const submit = async (submitEvent) => {
    submitEvent.preventDefault();
    const attendees = uniqueAttendees(draft.attendees);
    const validationError = validateEventDraft({
      subject: draft.subject,
      startDate: startValue,
      endDate: endValue,
      attendees,
      bookingKind: draft.bookingKind,
      recurrence: draft.recurrence,
    }, { editing });
    if (validationError) {
      setError(t(validationError));
      return;
    }

    const eventDraft = {
      ...(editing ? { id: eventId } : {}),
      organizer,
      subject: draft.subject,
      description: encodeEventDescription(draft.description),
      startDate: startValue,
      endDate: endValue,
      timezone: draft.timezone,
      bookingKind: draft.bookingKind,
      recurrence: draft.recurrence,
      scope: draft.scope,
      attendees,
    };

    try {
      let previewSummary = "";
      if (!editing) {
        const preview = await previewEvents(buildModernEventPayload(eventDraft)).unwrap();
        const conflictTotal = Number.isFinite(Number(preview.conflictTotal))
          ? Number(preview.conflictTotal)
          : (Array.isArray(preview.conflicts) ? preview.conflicts.length : 0);
        if (conflictTotal > 0) {
          setError(t("editor.conflictSummary", { count: conflictTotal }));
          return;
        }
        if (Array.isArray(preview.occurrences)) {
          previewSummary = t("editor.previewSummary", { count: preview.occurrences.length });
          setGuidance(previewSummary);
        }
      }
      if (editing) await updateEvent(buildUpdateEventPayload(eventDraft)).unwrap();
      else await storeEvent(buildCreateEventPayload(eventDraft)).unwrap();
      const successMessage = editing || !previewSummary
        ? t(editing ? "editor.updated" : "editor.created")
        : `${t("editor.created")} ${previewSummary}`;
      setFeedback({ open: true, message: successMessage, severity: "success" });
      onClose();
    } catch (reason) {
      const message = getApiError(reason, t(editing ? "editor.updateError" : "editor.createError"));
      setError(message);
      setFeedback({ open: true, message, severity: "error" });
    }
  };

  const removeEvent = async () => {
    try {
      await deleteEventById({ eventId, scope: draft.scope }).unwrap();
      setFeedback({ open: true, message: t("editor.deleted"), severity: "success" });
      setDeleteConfirmOpen(false);
      onClose();
    } catch (reason) {
      const message = getApiError(reason, t("editor.deleteError"));
      setError(message);
      setFeedback({ open: true, message, severity: "error" });
    }
  };

  return (
    <>
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? event?.title || t("editor.detailsTitle") : t("editor.addTitle")}</DialogTitle>
        <DialogContent dividers>
          {editing && details.isFetching && !details.data ? <LoadingState label={t("editor.loading")} /> : null}
          {editing && details.isFetching && details.data ? <Alert severity="info">{t("common:states.refreshing")}</Alert> : null}
          {editing && details.isError ? <ErrorState message={getApiError(details.error, t("editor.loadError"))} busy={details.isFetching} onAction={() => details.refetch()} /> : null}
          {(!editing || details.data || (!details.isFetching && !details.isError)) ? (
            <Stack component="form" id="event-editor-form" spacing={2} onSubmit={submit} sx={{ pt: 1 }}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              {guidance ? <Alert severity="success">{guidance}</Alert> : null}
              {readOnly ? <Alert severity="info">{t("editor.readOnly")}</Alert> : null}
              <TextField
                autoFocus={!editing}
                label={t("editor.title")}
                value={draft.subject}
                onChange={change("subject")}
                disabled={readOnly || busy}
              />
              <Autocomplete
                multiple
                freeSolo
                options={userEmails}
                value={attendeeEmails}
                onChange={(_, values) => {
                  setDraft((current) => {
                    const room = current.attendees.find(isRoomAttendee);
                    const people = values.map((value) => {
                      const email = emailOf(value);
                      const user = usersByEmail.get(String(email).toLowerCase());
                      return user ? { attendee_email: user.email, attendee_user_id: user._id } : { attendee_email: email };
                    });
                    return { ...current, attendees: uniqueAttendees([...people, ...(room ? [room] : [])]) };
                  });
                  setError("");
                  setGuidance("");
                }}
                disabled={readOnly || busy}
                renderInput={(params) => <TextField {...params} label={t("editor.attendees")} />}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  type="date"
                  label={t("editor.startDate")}
                  value={draft.startDate}
                  onChange={change("startDate")}
                  disabled={readOnly || busy}
                  InputLabelProps={{ shrink: true }}
                />
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={dateLocale}>
                  <TimePicker
                    fullWidth
                    label={t("editor.startTime")}
                    value={draft.startTime ? dayjs(`2000-01-01T${draft.startTime}`) : null}
                    onChange={(value) => changeValue("startTime")(value ? value.format("HH:mm") : "")}
                    ampm={false}
                    format="HH:mm"
                    views={["hours", "minutes"]}
                    disabled={readOnly || busy}
                    slotProps={{ textField: { fullWidth: true, size: "small" } }}
                  />
                </LocalizationProvider>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                {!(!editing && draft.bookingKind === "recurring") ? (
                  <TextField
                    fullWidth
                    type="date"
                    label={t("editor.endDate")}
                    value={draft.endDate}
                    onChange={change("endDate")}
                    disabled={readOnly || busy}
                    InputLabelProps={{ shrink: true }}
                  />
                ) : (
                  <TextField
                    fullWidth
                    label={t("editor.endDate")}
                    value={t("editor.endDateFollowsRepeat")}
                    disabled
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={dateLocale}>
                  <TimePicker
                    fullWidth
                    label={t("editor.endTime")}
                    value={draft.endTime ? dayjs(`2000-01-01T${draft.endTime}`) : null}
                    onChange={(value) => changeValue("endTime")(value ? value.format("HH:mm") : "")}
                    ampm={false}
                    format="HH:mm"
                    views={["hours", "minutes"]}
                    disabled={readOnly || busy}
                    slotProps={{ textField: { fullWidth: true, size: "small" } }}
                  />
                </LocalizationProvider>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                {!editing ? (
                  <FormControl fullWidth size="small" disabled={readOnly || busy}>
                    <InputLabel id="event-kind-label">{t("editor.bookingKind")}</InputLabel>
                    <Select
                      labelId="event-kind-label"
                      label={t("editor.bookingKind")}
                      value={draft.bookingKind}
                      onChange={change("bookingKind")}
                    >
                      <MenuItem value="single">{t("editor.singleBooking")}</MenuItem>
                      <MenuItem value="recurring">{t("editor.recurringBooking")}</MenuItem>
                    </Select>
                    <FormHelperText>{t("editor.bookingKindHelp")}</FormHelperText>
                  </FormControl>
                ) : null}
                <FormHelperText>{duration ? t("editor.duration", { count: duration }) : t("editor.durationHelp")}</FormHelperText>
              </Stack>
              {!editing && draft.bookingKind === "recurring" ? (
                <Box>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>{t("editor.recurrenceTitle")}</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label={t("editor.recurrenceCadence")}
                      value={draft.recurrence.cadence}
                      onChange={changeRecurrence("cadence")}
                      disabled={busy}
                    >
                      <MenuItem value="daily">{t("editor.daily")}</MenuItem>
                      <MenuItem value="weekly">{t("editor.weekly")}</MenuItem>
                      <MenuItem value="monthly">{t("editor.monthly")}</MenuItem>
                    </TextField>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label={t("editor.recurrenceInterval")}
                      value={draft.recurrence.interval}
                      onChange={changeRecurrence("interval")}
                      disabled={busy}
                      inputProps={{ min: 1 }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label={t("editor.recurrenceEnd")}
                      value={draft.recurrence.endDate}
                      onChange={changeRecurrence("endDate")}
                      disabled={busy}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Stack>
                  {draft.recurrence.cadence === "weekly" ? (
                    <FormControl component="fieldset" sx={{ mt: 1.5 }} disabled={busy}>
                      <FormHelperText>{t("editor.weekdayHelp")}</FormHelperText>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                          <FormControlLabel
                            key={day}
                            control={(
                              <Checkbox
                                checked={draft.recurrence.weekdays.includes(day)}
                                onClick={() => {
                                  setDraft((current) => {
                                    const weekdays = current.recurrence.weekdays.includes(day)
                                      ? current.recurrence.weekdays.filter((item) => item !== day)
                                      : [...current.recurrence.weekdays, day].sort();
                                    return { ...current, recurrence: { ...current.recurrence, weekdays } };
                                  });
                                  setError("");
                                  setGuidance("");
                                }}
                              />
                            )}
                            label={t(`editor.weekdays.${day}`)}
                          />
                        ))}
                      </Stack>
                    </FormControl>
                  ) : null}
                  {draft.recurrence.cadence === "monthly" ? (
                    <Box sx={{ mt: 1.5 }}>
                      <RadioGroup
                        row
                        value={draft.recurrence.monthlyPattern}
                        onChange={changeRecurrence("monthlyPattern")}
                      >
                        <FormControlLabel value="date" control={<Radio />} label={t("editor.monthlyByDate")} />
                        <FormControlLabel value="weekday" control={<Radio />} label={t("editor.monthlyByWeekday")} />
                      </RadioGroup>
                      {draft.recurrence.monthlyPattern === "weekday" ? (
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label={t("editor.monthWeekLabel")}
                            value={draft.recurrence.monthWeekIndex}
                            onChange={changeRecurrence("monthWeekIndex")}
                            disabled={busy}
                          >
                            <MenuItem value={1}>{t("editor.monthWeek.1")}</MenuItem>
                            <MenuItem value={2}>{t("editor.monthWeek.2")}</MenuItem>
                            <MenuItem value={3}>{t("editor.monthWeek.3")}</MenuItem>
                            <MenuItem value={4}>{t("editor.monthWeek.4")}</MenuItem>
                            <MenuItem value={-1}>{t("editor.monthWeek.last")}</MenuItem>
                          </TextField>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            label={t("editor.monthWeekdayLabel")}
                            value={draft.recurrence.monthWeekday}
                            onChange={changeRecurrence("monthWeekday")}
                            disabled={busy}
                          >
                            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                              <MenuItem key={day} value={day}>{t(`editor.weekdays.${day}`)}</MenuItem>
                            ))}
                          </TextField>
                        </Stack>
                      ) : null}
                    </Box>
                  ) : null}
                  <FormHelperText>{t("editor.previewHelp")}</FormHelperText>
                </Box>
              ) : null}
              {editing && recurringEvent && !readOnly ? (
                <FormControl component="fieldset">
                  <Typography variant="subtitle2">{t("editor.scopeTitle")}</Typography>
                  <RadioGroup value={draft.scope} onChange={change("scope")}>
                    <FormControlLabel value="occurrence" control={<Radio />} label={t("editor.scopeOccurrence")} />
                    <FormControlLabel value="following" control={<Radio />} label={t("editor.scopeFollowing")} />
                    <FormControlLabel value="series" control={<Radio />} label={t("editor.scopeSeries")} />
                  </RadioGroup>
                  <FormHelperText>{t("editor.scopeHelp")}</FormHelperText>
                </FormControl>
              ) : null}
              <Autocomplete
                options={rooms}
                value={locationValue}
                onChange={(_, value) => selectRoom(value)}
                getOptionLabel={(option) => option?.name || option?.email || ""}
                isOptionEqualToValue={(option, value) => option?.email === value?.email}
                disabled={readOnly || busy}
                renderInput={(params) => <TextField {...params} label={t("editor.location")} />}
              />
              {conflictCount > 0 ? (
                <Alert severity="warning">
                  <Typography variant="body2">{t("calendar.conflictDetected")}</Typography>
                  {conflictTruncated ? (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      {t("calendar.conflictTruncated", { shown: conflictShown, total: conflictCount })}
                    </Typography>
                  ) : null}
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    {t("calendar.alternativesTitle")}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {alternatives.length ? alternatives.map((room) => (
                      <Button key={room._id} size="small" variant="outlined" onClick={() => selectRoom(room)}>
                        {room.name}
                      </Button>
                    )) : (
                      <Typography variant="caption">{t("calendar.noAlternatives")}</Typography>
                    )}
                  </Stack>
                </Alert>
              ) : null}
              <TextField
                multiline
                minRows={3}
                label={t("editor.description")}
                value={draft.description}
                onChange={change("description")}
                disabled={readOnly || busy}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={busy}>{t("common:actions.close")}</Button>
          {editing && !readOnly ? <Button color="error" onClick={() => setDeleteConfirmOpen(true)} disabled={busy || details.isFetching}>{t("common:actions.delete")}</Button> : null}
          {!readOnly ? (
            <Button
              type="submit"
              form="event-editor-form"
              variant="contained"
              disabled={busy || (editing && (details.isFetching || details.isError))}
            >
              {t("common:actions.save")}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t("editor.deleteTitle")}
        message={recurringEvent ? t("editor.deleteScopedMessage") : t("editor.deleteMessage")}
        loading={deleteState.isLoading}
        onCancel={() => {
          if (!deleteState.isLoading) setDeleteConfirmOpen(false);
        }}
        onConfirm={removeEvent}
      />
      <FeedbackSnackbar
        open={feedback.open}
        message={feedback.message}
        severity={feedback.severity}
        onClose={() => setFeedback((current) => ({ ...current, open: false }))}
      />
    </>
  );
};

export default EventEditor;
