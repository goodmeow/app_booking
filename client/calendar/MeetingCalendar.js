import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Container, Paper } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { isAuthenticated } from "../auth/auth-helper.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { calendarEventFilters, calendarEventFromApi, calendarRangeForView, defaultEventRange, navigateCalendarDate } from "../domain/calendar.js";
import { getApiError } from "../domain/api-error.js";
import { useGetEventsQuery } from "../redux/services/events.js";
import { useGetRoomsQuery } from "../redux/services/rooms.js";
import { useListUserQuery } from "../redux/services/users.js";
import { wsJoinRoom, wsLeaveRoom } from "../redux/websocket.js";
import CalendarSidebar from "./CalendarSidebar.js";
import EventEditor from "./EventEditor.js";
import MeetingWeek from "./MeetingWeek.js";

const MeetingCalendar = () => {
  const { t } = useTranslation(["calendar", "common"]);
  const session = isAuthenticated();
  const dispatch = useDispatch();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState("timeGridWeek");
  const [scheduleMode, setScheduleMode] = useState("mine");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [editor, setEditor] = useState({ open: false, event: null, start: null, end: null });
  const activeRoom = scheduleMode === "room" ? selectedRoom : null;
  const range = useMemo(() => calendarRangeForView(selectedDate, calendarView), [selectedDate, calendarView]);
  const eventQuery = useGetEventsQuery(
    calendarEventFilters({ email: session.user.email, roomEmail: activeRoom?.email, range }),
    { skip: scheduleMode === "room" && !activeRoom }
  );
  const roomQuery = useGetRoomsQuery();
  const userQuery = useListUserQuery();

  useEffect(() => {
    const roomId = activeRoom?._id;
    if (!roomId) return undefined;
    dispatch(wsJoinRoom(roomId));
    return () => { dispatch(wsLeaveRoom(roomId)); };
  }, [dispatch, activeRoom?._id]);

  const openNewEvent = (start, end) => setEditor({ open: true, event: null, start, end });
  const addEvent = () => {
    const next = defaultEventRange(selectedDate);
    openNewEvent(next.start, next.end);
  };

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "340px minmax(0, 1fr)" }, gap: 2 }}>
        <Paper sx={{ p: 2 }}>
          <CalendarSidebar
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            rooms={Array.isArray(roomQuery.data) ? roomQuery.data : []}
            scheduleMode={scheduleMode}
            onScheduleModeChange={(mode) => {
              setScheduleMode(mode);
              if (mode === "mine") setSelectedRoom(null);
            }}
            selectedRoom={selectedRoom}
            onRoomChange={setSelectedRoom}
            onAdd={addEvent}
          />
        </Paper>
        <Paper sx={{ p: 2, minWidth: 0 }}>
          {eventQuery.isFetching ? <LoadingState label={t("calendar.loading")} /> : null}
          {eventQuery.isError ? <ErrorState message={getApiError(eventQuery.error, t("calendar.loadError"))} /> : null}
          {scheduleMode === "room" && !activeRoom ? <Alert severity="info">{t("calendar.selectRoomPrompt")}</Alert> : null}
          {!eventQuery.isFetching && !eventQuery.isError && !(scheduleMode === "room" && !activeRoom) ? (
            <MeetingWeek
              events={Array.isArray(eventQuery.data) ? eventQuery.data : []}
              selectedDate={selectedDate}
              view={calendarView}
              onViewChange={setCalendarView}
              onToday={() => setSelectedDate(new Date())}
              onPrevious={() => setSelectedDate((current) => navigateCalendarDate(current, calendarView, "previous"))}
              onNext={() => setSelectedDate((current) => navigateCalendarDate(current, calendarView, "next"))}
              onSelect={(selection) => openNewEvent(selection.start, selection.end)}
              onEventClick={(event) => {
                const mapped = calendarEventFromApi(event);
                if (mapped.can_view_details === false || mapped.visibility === "busy") return;
                setEditor({ open: true, event: mapped, start: event.start, end: event.end });
              }}
            />
          ) : null}
        </Paper>
      </Box>

      <EventEditor
        open={editor.open}
        event={editor.event}
        initialStart={editor.start}
        initialEnd={editor.end}
        sessionEmail={session.user.email}
        users={Array.isArray(userQuery.data) ? userQuery.data : []}
        rooms={Array.isArray(roomQuery.data) ? roomQuery.data : []}
        initialRoom={activeRoom}
        onClose={() => setEditor({ open: false, event: null, start: null, end: null })}
      />
    </Container>
  );
};

export default MeetingCalendar;
