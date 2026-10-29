import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  TimePicker,
  Typography,
} from "antd";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import FeedbackSnackbar from "../components/common/FeedbackSnackbar.js";
import ConfirmDialog from "../components/common/ConfirmDialog.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { canManageBooking, durationMinutes } from "../domain/calendar.js";
import { getApiError } from "../domain/api-error.js";
import { editorFieldDisabled } from "../domain/events/editor-lock.js";
import { canBookForEmployees, isReceptionistRole, roomsForRole } from "../domain/roles.js";
import {
  buildModernEventPayload,
  buildCreateEventPayload,
  buildUpdateEventPayload,
  encodeEventDescription,
  isRoomAttendee,
  isValidGuestEmail,
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
import AttendeePicker from "./AttendeePicker.js";
import OnBehalfPicker from "./OnBehalfPicker.js";

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

const EditorField = ({ label, help, required = false, children }) => (
  <Form.Item label={label} help={help} required={required} style={{ marginBottom: 0 }}>
    {children}
  </Form.Item>
);

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
  sessionUserId,
  role,
  userFloor,
  userFloors = [],
  isAdmin = false,
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
  const [previewEvents] = usePreviewEventsMutation();
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
  // An employee picked in the on-behalf field; empty means the booker is the
  // organizer themselves.
  const [onBehalf, setOnBehalf] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: "", severity: "error" });

  // The input "24:00" is not recognised, so the end of the day uses 23:59
  // (one minute before midnight). The time zone is no longer chosen by the user:
  // the server uses the application time zone.
  const startValue = draft.startDate ? `${draft.startDate}T${draft.startTime}` : "";
  // For Recurring, the date range is controlled by "Repeat until"; the duration of each
  // occurrence follows the start and end time of the first day.
  const endDay = !editing && draft.bookingKind === "recurring" ? draft.startDate : draft.endDate;
  const endValue = endDay ? `${endDay}T${draft.endTime}` : "";

  const attendeeEmails = draft.attendees.filter((item) => !isRoomAttendee(item)).map(emailOf);
  const location = draft.attendees.find(isRoomAttendee)?.attendee_email || null;
  // A receptionist only books rooms on their own floor; an admin keeps every
  // floor the calendar offered. Memoised so the conflict-effect dependencies
  // stay stable between renders.
  const availableRooms = useMemo(
    () => roomsForRole(rooms, { role, floor: userFloor, floors: userFloors, isAdmin }),
    [rooms, role, userFloor, userFloors, isAdmin]
  );
  const floorRoomsEmpty = !editing && isReceptionistRole(role) && availableRooms.length === 0;
  // "Organizer on behalf" is a create-only field for the front desk and admins.
  const showOnBehalf = !editing && canBookForEmployees(role);
  const locationValue = availableRooms.find((room) => room.email === location)
    || (location ? { name: location, email: location } : null);
  const organizer = eventField(event, "organizer") || sessionEmail || "";
  const eventEnd = eventField(event, "end");
  const isOrganizer = !editing || canManageBooking({ event, sessionEmail, sessionUserId, isAdmin });
  const hasEnded = editing && eventEnd && new Date(eventEnd) < new Date();
  const readOnly = editing && (!isOrganizer || hasEnded);
  const recurringEvent = Boolean(eventField(event, "series_id"));
  // Only a save in flight locks the form. The availability preview runs in the
  // background while the user types and must not disable (and so blur) the
  // focused input.
  const saving = storeState.isLoading || updateState.isLoading || deleteState.isLoading;
  const fieldDisabled = editorFieldDisabled({ readOnly, saving });
  const duration = durationMinutes(startValue, endValue);

  useEffect(() => {
    if (!open) return;
    const range = defaultRange(initialStart, initialEnd);
    const storedStart = toDateTimeInput(eventField(event, "start")) || range.start;
    const storedEnd = toDateTimeInput(eventEnd) || range.end;
    const initialAttendees = initialRoom?.email
      ? [{ attendee_email: initialRoom.email, type: "room", room_id: initialRoom._id }]
      : [];
    // A blank form (not opened from a calendar slot or an old meeting) defaults to
    // the whole day, 00:00-23:59, so users do not have to deal with hours.
    const freshForm = !initialStart && !eventField(event, "start");
    const startDay = storedStart.slice(0, 10);
    setDraft({
      subject: event?.title || eventField(event, "subject") || "",
      startDate: startDay,
      startTime: freshForm ? "00:00" : (storedStart.slice(11, 16) || "00:00"),
      endDate: freshForm ? startDay : storedEnd.slice(0, 10),
      endTime: freshForm ? "23:59" : (storedEnd.slice(11, 16) || "23:59"),
      description: safeDecode(eventField(event, "description")),
      // The user does not choose a time zone: the server uses the application time zone.
      // When editing, the stored time zone is sent along so existing occurrences
      // do not shift.
      ...(eventField(event, "timezone") ? { timezone: eventField(event, "timezone") } : {}),
      bookingKind: "single",
      recurrence: { cadence: "daily", interval: 1, endDate: "", weekdays: [], monthlyPattern: "date", monthWeekIndex: 1, monthWeekday: 1 },
      scope: "occurrence",
      attendees: initialAttendees,
    });
    setError("");
    setGuidance("");
    setOnBehalf(null);
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

  // Setter for direct values (for example a TimePicker result such as the string "HH:mm").
  const changeValue = (name) => (value) => {
    setDraft((current) => ({ ...current, [name]: value }));
    setError("");
    setGuidance("");
  };

  const changeRecurrenceValue = (name) => (value) => {
    setDraft((current) => ({
      ...current,
      recurrence: { ...current.recurrence, [name]: value },
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

  // Check conflicts when the time or room changes, then offer other free rooms.
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
            availableRooms
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
    open, editing, readOnly, location, organizer, availableRooms,
    startValue, endValue, draft.timezone, draft.subject, draft.description,
    draft.bookingKind, draft.recurrence, draft.scope, draft.attendees,
    previewEvents, fetchAvailableRooms,
  ]);

  const close = () => {
    if (!saving) onClose();
  };

  const submit = async (submitEvent) => {
    submitEvent.preventDefault();
    const attendees = uniqueAttendees(draft.attendees);
    // Highlight the invalid chip so users can see which attendee was mistyped,
    // instead of showing a generic server message.
    const invalidGuest = attendees.find((attendee) => !isRoomAttendee(attendee)
      && !(attendee.attendee_user_id || attendee.userId)
      && !isValidGuestEmail(emailOf(attendee)));
    if (invalidGuest) {
      setError(t("editor.guestInvalid", { value: emailOf(invalidGuest).trim() }));
      return;
    }
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
      // Empty for a normal booking; the server then keeps the booker as organizer.
      organizerEmail: showOnBehalf ? onBehalf?.email || "" : "",
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
      <Modal
        open={open}
        title={editing ? event?.title || t("editor.detailsTitle") : t("editor.addTitle")}
        width={680}
        onCancel={close}
        maskClosable={!saving}
        closable={!saving}
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
        footer={[
          <Button key="close" onClick={close} disabled={saving}>{t("common:actions.close")}</Button>,
          editing && !readOnly ? (
            <Button
              key="delete"
              danger
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saving || details.isFetching}
            >
              {t("common:actions.delete")}
            </Button>
          ) : null,
          !readOnly ? (
            <Button
              key="save"
              type="primary"
              htmlType="submit"
              form="event-editor-form"
              loading={saving}
              disabled={!location || floorRoomsEmpty || (editing && (details.isFetching || details.isError))}
            >
              {t("common:actions.save")}
            </Button>
          ) : null,
        ].filter(Boolean)}
      >
        {editing && details.isFetching && !details.data ? <LoadingState label={t("editor.loading")} /> : null}
        {editing && details.isFetching && details.data ? <Alert type="info" showIcon message={t("common:states.refreshing")} /> : null}
        {editing && details.isError ? (
          <ErrorState
            message={getApiError(details.error, t("editor.loadError"))}
            busy={details.isFetching}
            onAction={() => details.refetch()}
          />
        ) : null}
        {(!editing || details.data || (!details.isFetching && !details.isError)) ? (
          <form id="event-editor-form" onSubmit={submit}>
            <Form component={false} layout="vertical">
            <Space direction="vertical" size="middle" style={{ width: "100%", marginTop: 8 }}>
              {error ? <Alert type="error" showIcon message={error} /> : null}
              {guidance ? <Alert type="success" showIcon message={guidance} /> : null}
              {readOnly ? <Alert type="info" showIcon message={t("editor.readOnly")} /> : null}

              <EditorField label={t("editor.title")} required>
                <Input
                  autoFocus={!editing}
                  value={draft.subject}
                  onChange={change("subject")}
                  disabled={fieldDisabled}
                />
              </EditorField>

              {showOnBehalf ? (
                <OnBehalfPicker
                  value={onBehalf}
                  disabled={saving}
                  onChange={(employee) => {
                    setOnBehalf(employee);
                    setError("");
                    setGuidance("");
                  }}
                />
              ) : null}

              {floorRoomsEmpty ? <Alert type="warning" showIcon message={t("editor.floorRoomsEmpty")} /> : null}

              <AttendeePicker
                users={users}
                attendees={draft.attendees}
                value={attendeeEmails}
                disabled={fieldDisabled}
                onChange={(people) => {
                  setDraft((current) => {
                    const room = current.attendees.find(isRoomAttendee);
                    return { ...current, attendees: uniqueAttendees([...people, ...(room ? [room] : [])]) };
                  });
                  setError("");
                  setGuidance("");
                }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <EditorField label={t("editor.startDate")} required>
                  <DatePicker
                    value={draft.startDate ? dayjs(draft.startDate) : null}
                    onChange={(value) => changeValue("startDate")(value ? value.format("YYYY-MM-DD") : "")}
                    format="YYYY-MM-DD"
                    disabled={fieldDisabled}
                    style={{ width: "100%" }}
                  />
                </EditorField>
                <EditorField label={t("editor.startTime")} required>
                  <TimePicker
                    value={draft.startTime ? dayjs(`2000-01-01T${draft.startTime}`) : null}
                    onChange={(value) => changeValue("startTime")(value ? value.format("HH:mm") : "")}
                    format="HH:mm"
                    minuteStep={1}
                    disabled={fieldDisabled}
                    style={{ width: "100%" }}
                  />
                </EditorField>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <EditorField label={t("editor.endDate")} required>
                  {!(!editing && draft.bookingKind === "recurring") ? (
                    <DatePicker
                      value={draft.endDate ? dayjs(draft.endDate) : null}
                      onChange={(value) => changeValue("endDate")(value ? value.format("YYYY-MM-DD") : "")}
                      format="YYYY-MM-DD"
                      disabled={fieldDisabled}
                      style={{ width: "100%" }}
                    />
                  ) : (
                    <Input value={t("editor.endDateFollowsRepeat")} disabled />
                  )}
                </EditorField>
                <EditorField label={t("editor.endTime")} required>
                  <TimePicker
                    value={draft.endTime ? dayjs(`2000-01-01T${draft.endTime}`) : null}
                    onChange={(value) => changeValue("endTime")(value ? value.format("HH:mm") : "")}
                    format="HH:mm"
                    minuteStep={1}
                    disabled={fieldDisabled}
                    style={{ width: "100%" }}
                  />
                </EditorField>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
                {!editing ? (
                  <EditorField label={t("editor.bookingKind")} help={t("editor.bookingKindHelp")} required>
                    <Select
                      value={draft.bookingKind}
                      onChange={changeValue("bookingKind")}
                      disabled={fieldDisabled}
                      options={[
                        { value: "single", label: t("editor.singleBooking") },
                        { value: "recurring", label: t("editor.recurringBooking") },
                      ]}
                    />
                  </EditorField>
                ) : null}
                <Typography.Text type="secondary">
                  {duration ? t("editor.duration", { count: duration }) : t("editor.durationHelp")}
                </Typography.Text>
              </div>

              {!editing && draft.bookingKind === "recurring" ? (
                <div>
                  <Divider style={{ margin: "4px 0 12px" }} />
                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                    {t("editor.recurrenceTitle")}
                  </Typography.Title>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <EditorField label={t("editor.recurrenceCadence")} required>
                      <Select
                        value={draft.recurrence.cadence}
                        onChange={changeRecurrenceValue("cadence")}
                        disabled={saving}
                        options={[
                          { value: "daily", label: t("editor.daily") },
                          { value: "weekly", label: t("editor.weekly") },
                          { value: "monthly", label: t("editor.monthly") },
                        ]}
                      />
                    </EditorField>
                    <EditorField label={t("editor.recurrenceInterval")} required>
                      <InputNumber
                        min={1}
                        value={draft.recurrence.interval}
                        onChange={(value) => changeRecurrenceValue("interval")(value ?? 1)}
                        disabled={saving}
                        style={{ width: "100%" }}
                      />
                    </EditorField>
                    <EditorField label={t("editor.recurrenceEnd")} required>
                      <DatePicker
                        value={draft.recurrence.endDate ? dayjs(draft.recurrence.endDate) : null}
                        onChange={(value) => changeRecurrenceValue("endDate")(value ? value.format("YYYY-MM-DD") : "")}
                        format="YYYY-MM-DD"
                        disabled={saving}
                        style={{ width: "100%" }}
                      />
                    </EditorField>
                  </div>

                  {draft.recurrence.cadence === "weekly" ? (
                    <EditorField
                      label={t("editor.weekdaysLabel")}
                      help={t("editor.weekdayHelp")}
                      required
                    >
                      <Checkbox.Group
                        value={draft.recurrence.weekdays}
                        disabled={saving}
                        options={[0, 1, 2, 3, 4, 5, 6].map((day) => ({
                          value: day,
                          label: t(`editor.weekdays.${day}`),
                        }))}
                        onChange={(values) => {
                          setDraft((current) => ({
                            ...current,
                            recurrence: { ...current.recurrence, weekdays: [...values].sort((a, b) => a - b) },
                          }));
                          setError("");
                          setGuidance("");
                        }}
                      />
                    </EditorField>
                  ) : null}

                  {draft.recurrence.cadence === "monthly" ? (
                    <div style={{ marginTop: 12 }}>
                      <EditorField label={t("editor.monthlyPatternLabel")} required>
                        <Radio.Group
                          value={draft.recurrence.monthlyPattern}
                          onChange={(event) => changeRecurrenceValue("monthlyPattern")(event.target.value)}
                          options={[
                            { value: "date", label: t("editor.monthlyByDate") },
                            { value: "weekday", label: t("editor.monthlyByWeekday") },
                          ]}
                        />
                      </EditorField>
                      {draft.recurrence.monthlyPattern === "weekday" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
                          <EditorField label={t("editor.monthWeekLabel")} required>
                            <Select
                              value={draft.recurrence.monthWeekIndex}
                              onChange={changeRecurrenceValue("monthWeekIndex")}
                              disabled={saving}
                              options={[
                                { value: 1, label: t("editor.monthWeek.1") },
                                { value: 2, label: t("editor.monthWeek.2") },
                                { value: 3, label: t("editor.monthWeek.3") },
                                { value: 4, label: t("editor.monthWeek.4") },
                                { value: -1, label: t("editor.monthWeek.last") },
                              ]}
                            />
                          </EditorField>
                          <EditorField label={t("editor.monthWeekdayLabel")} required>
                            <Select
                              value={draft.recurrence.monthWeekday}
                              onChange={changeRecurrenceValue("monthWeekday")}
                              disabled={saving}
                              options={[0, 1, 2, 3, 4, 5, 6].map((day) => ({
                                value: day,
                                label: t(`editor.weekdays.${day}`),
                              }))}
                            />
                          </EditorField>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <Typography.Text type="secondary">{t("editor.previewHelp")}</Typography.Text>
                </div>
              ) : null}

              {editing && recurringEvent && !readOnly ? (
                <EditorField label={t("editor.scopeTitle")} help={t("editor.scopeHelp")} required>
                  <Radio.Group
                    value={draft.scope}
                    onChange={(event) => changeValue("scope")(event.target.value)}
                    options={[
                      { value: "occurrence", label: t("editor.scopeOccurrence") },
                      { value: "following", label: t("editor.scopeFollowing") },
                      { value: "series", label: t("editor.scopeSeries") },
                    ]}
                  />
                </EditorField>
              ) : null}

              <EditorField label={t("editor.location")} required>
                <Select
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  value={locationValue?.email}
                  options={[
                    ...availableRooms.map((room) => ({ value: room.email, label: room.name || room.email })),
                    ...(locationValue && !availableRooms.some((room) => room.email === locationValue.email)
                      ? [{ value: locationValue.email, label: locationValue.name || locationValue.email }]
                      : []),
                  ]}
                  onChange={(email) => {
                    if (!email) {
                      selectRoom(null);
                      return;
                    }
                    selectRoom(
                      availableRooms.find((room) => room.email === email)
                      || (locationValue?.email === email ? locationValue : null)
                    );
                  }}
                  disabled={fieldDisabled || floorRoomsEmpty}
                  aria-required="true"
                  placeholder={t("editor.location")}
                  style={{ width: "100%" }}
                />
              </EditorField>

              {conflictCount > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message={t("calendar.conflictDetected")}
                  description={(
                    <div>
                      {conflictTruncated ? (
                        <Typography.Text type="secondary" style={{ display: "block" }}>
                          {t("calendar.conflictTruncated", { shown: conflictShown, total: conflictCount })}
                        </Typography.Text>
                      ) : null}
                      <Typography.Text type="secondary" style={{ display: "block", marginTop: 4 }}>
                        {t("calendar.alternativesTitle")}
                      </Typography.Text>
                      <Space wrap style={{ marginTop: 8 }}>
                        {alternatives.length ? alternatives.map((room) => (
                          <Button key={room._id} size="small" onClick={() => selectRoom(room)}>
                            {room.name}
                          </Button>
                        )) : (
                          <Typography.Text type="secondary">{t("calendar.noAlternatives")}</Typography.Text>
                        )}
                      </Space>
                    </div>
                  )}
                />
              ) : null}

              <EditorField label={t("editor.description")}>
                <Input.TextArea
                  rows={3}
                  value={draft.description}
                  onChange={change("description")}
                  disabled={fieldDisabled}
                />
              </EditorField>
            </Space>
            </Form>
          </form>
        ) : null}
      </Modal>

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
