import React, { useEffect, useMemo, useState } from "react";
import { Box, Container, Paper } from "@mui/material";
import { useDispatch } from "react-redux";
import { isAuthenticated } from "../auth/auth-helper.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { calendarEventFilters, calendarEventFromApi, calendarWeekRange, defaultEventRange } from "../domain/calendar.js";
import { getApiError } from "../domain/api-error.js";
import { useGetEventsQuery } from "../redux/services/events.js";
import { useGetRoomsQuery } from "../redux/services/rooms.js";
import { useListUserQuery } from "../redux/services/users.js";
import { wsJoinRoom, wsLeaveRoom } from "../redux/websocket.js";
import CalendarSidebar from "./CalendarSidebar.js";
import EventEditor from "./EventEditor.js";
import MeetingWeek from "./MeetingWeek.js";

const MeetingCalendar = () => {
  const session = isAuthenticated();
  const dispatch = useDispatch();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [editor, setEditor] = useState({ open: false, event: null, start: null, end: null });
  const range = useMemo(() => calendarWeekRange(selectedDate), [selectedDate]);
  const eventQuery = useGetEventsQuery(calendarEventFilters({ email: session.user.email, roomEmail: selectedRoom?.email, range }));
  const roomQuery = useGetRoomsQuery();
  const userQuery = useListUserQuery();

  useEffect(() => {
    const roomId = selectedRoom?._id;
    if (!roomId) return undefined;
    dispatch(wsJoinRoom(roomId));
    return () => { dispatch(wsLeaveRoom(roomId)); };
  }, [dispatch, selectedRoom?._id]);

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
            selectedRoom={selectedRoom}
            onRoomChange={setSelectedRoom}
            onAdd={addEvent}
          />
        </Paper>
        <Paper sx={{ p: 2, minWidth: 0 }}>
          {eventQuery.isFetching ? <LoadingState /> : null}
          {eventQuery.isError ? <ErrorState message={getApiError(eventQuery.error, "Unable to load events")} /> : null}
          {!eventQuery.isFetching && !eventQuery.isError ? (
            <MeetingWeek
              events={Array.isArray(eventQuery.data) ? eventQuery.data : []}
              selectedDate={selectedDate}
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
        onClose={() => setEditor({ open: false, event: null, start: null, end: null })}
      />
    </Container>
  );
};

export default MeetingCalendar;
