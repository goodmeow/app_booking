import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import FeedbackSnackbar from "../components/common/FeedbackSnackbar.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { getApiError } from "../domain/api-error.js";
import {
  buildCreateEventPayload,
  buildUpdateEventPayload,
  encodeEventDescription,
  isRoomAttendee,
  validateEventDraft,
} from "../domain/events/event-contract.js";
import {
  useDeleteEventByIdMutation,
  useGetEventDetailsQuery,
  useStoreEventMutation,
  useUpdateEventMutation,
} from "../redux/services/events.js";

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
  onClose,
}) => {
  const eventId = event?.id;
  const editing = Boolean(eventId);
  const details = useGetEventDetailsQuery(eventId, { skip: !open || !editing });
  const [storeEvent, storeState] = useStoreEventMutation();
  const [updateEvent, updateState] = useUpdateEventMutation();
  const [deleteEventById, deleteState] = useDeleteEventByIdMutation();
  const [draft, setDraft] = useState({ subject: "", start: "", end: "", description: "", attendees: [] });
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({ open: false, message: "", severity: "error" });

  const userEmails = useMemo(() => uniqueAttendees(users).map(({ attendee_email }) => attendee_email), [users]);
  const attendeeEmails = draft.attendees.filter((item) => !isRoomAttendee(item)).map(emailOf);
  const location = draft.attendees.find(isRoomAttendee)?.attendee_email || null;
  const locationValue = rooms.find((room) => room.email === location)
    || (location ? { name: location, email: location } : null);
  const organizer = eventField(event, "organizer") || sessionEmail || "";
  const eventEnd = eventField(event, "end");
  const isOrganizer = !editing || String(organizer) === String(sessionEmail || "");
  const hasEnded = editing && eventEnd && new Date(eventEnd) < new Date();
  const readOnly = editing && (!isOrganizer || hasEnded);
  const busy = storeState.isLoading || updateState.isLoading || deleteState.isLoading;

  useEffect(() => {
    if (!open) return;
    const range = defaultRange(initialStart, initialEnd);
    setDraft({
      subject: event?.title || eventField(event, "subject") || "",
      start: toDateTimeInput(eventField(event, "start")) || range.start,
      end: toDateTimeInput(eventEnd) || range.end,
      description: safeDecode(eventField(event, "description")),
      attendees: [],
    });
    setError("");
  }, [open, eventId, initialStart, initialEnd]);

  useEffect(() => {
    if (!open || !editing || !Array.isArray(details.data)) return;
    setDraft((current) => ({ ...current, attendees: uniqueAttendees(details.data) }));
  }, [open, editing, eventId, details.data]);

  const change = (name) => (changeEvent) => {
    setDraft((current) => ({ ...current, [name]: changeEvent.target.value }));
    setError("");
  };

  const close = () => {
    if (!busy) onClose();
  };

  const submit = async (submitEvent) => {
    submitEvent.preventDefault();
    const attendees = uniqueAttendees(draft.attendees);
    const validationError = validateEventDraft({
      startDate: draft.start,
      endDate: draft.end,
      attendees,
    }, { editing });
    if (validationError) {
      setError(validationError);
      return;
    }

    const eventDraft = {
      ...(editing ? { id: eventId } : {}),
      organizer,
      subject: draft.subject,
      description: encodeEventDescription(draft.description),
      startDate: draft.start,
      endDate: draft.end,
      attendees,
    };

    try {
      if (editing) await updateEvent(buildUpdateEventPayload(eventDraft)).unwrap();
      else await storeEvent(buildCreateEventPayload(eventDraft)).unwrap();
      setFeedback({ open: true, message: editing ? "Event successfully updated" : "Event successfully created", severity: "success" });
      onClose();
    } catch (reason) {
      const message = getApiError(reason, `Unable to ${editing ? "update" : "create"} event`);
      setError(message);
      setFeedback({ open: true, message, severity: "error" });
    }
  };

  const removeEvent = async () => {
    try {
      await deleteEventById({ eventId }).unwrap();
      setFeedback({ open: true, message: "Event successfully deleted", severity: "success" });
      onClose();
    } catch (reason) {
      const message = getApiError(reason, "Unable to delete event");
      setError(message);
      setFeedback({ open: true, message, severity: "error" });
    }
  };

  return (
    <>
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? event?.title || "Event details" : "Add Event"}</DialogTitle>
        <DialogContent dividers>
          {editing && details.isFetching ? <LoadingState label="Loading event..." /> : null}
          {editing && details.isError ? <ErrorState message={getApiError(details.error, "Unable to load event")} /> : null}
          {(!editing || (!details.isFetching && !details.isError)) ? (
            <Stack component="form" id="event-editor-form" spacing={2} onSubmit={submit} sx={{ pt: 1 }}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              {readOnly ? <Alert severity="info">This event is read-only.</Alert> : null}
              <TextField
                autoFocus={!editing}
                label="Add a Title"
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
                    return { ...current, attendees: uniqueAttendees([...values, ...(room ? [room] : [])]) };
                  });
                  setError("");
                }}
                disabled={readOnly || busy}
                renderInput={(params) => <TextField {...params} label="Invite Attendees" />}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Start date"
                  value={draft.start}
                  onChange={change("start")}
                  disabled={readOnly || busy}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="End date"
                  value={draft.end}
                  onChange={change("end")}
                  disabled={readOnly || busy}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
              <Autocomplete
                options={rooms}
                value={locationValue}
                onChange={(_, value) => {
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
                }}
                getOptionLabel={(option) => option?.name || option?.email || ""}
                isOptionEqualToValue={(option, value) => option?.email === value?.email}
                disabled={readOnly || busy}
                renderInput={(params) => <TextField {...params} label="Location" />}
              />
              <TextField
                multiline
                minRows={3}
                label="Add a description"
                value={draft.description}
                onChange={change("description")}
                disabled={readOnly || busy}
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={busy}>Close</Button>
          {editing && !readOnly ? <Button color="error" onClick={removeEvent} disabled={busy || details.isFetching}>Delete</Button> : null}
          {!readOnly ? (
            <Button
              type="submit"
              form="event-editor-form"
              variant="contained"
              disabled={busy || (editing && (details.isFetching || details.isError))}
            >
              Save
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
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
