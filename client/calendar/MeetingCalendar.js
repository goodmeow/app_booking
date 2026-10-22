import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Container, LinearProgress, Paper, Stack, Typography } from "@mui/material";
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
  const isAdmin = session?.user?.role === "ADMIN";
  const userFloor = String(session?.user?.floor ?? "").trim();
  // Grup lantai "all" (atau admin) boleh melihat dan memesan semua lantai.
  const showAllFloors = isAdmin || userFloor.toLowerCase() === "all";
  const allRooms = Array.isArray(roomQuery.data) ? roomQuery.data : [];
  // Selain itu hanya ruangan di lantai kerjanya (server tetap menolak booking
  // lintas lantai walau UI diakali).
  const bookableRooms = useMemo(
    () => (showAllFloors ? allRooms : allRooms.filter((room) => String(room.floor ?? "").trim() === userFloor)),
    [allRooms, showAllFloors, userFloor]
  );
  const eventHasData = Array.isArray(eventQuery.data);
  const eventInitialLoading = eventQuery.isFetching && !eventHasData;
  const eventRefreshing = eventQuery.isFetching && eventHasData;
  const canLoadEvents = !(scheduleMode === "room" && !activeRoom);

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
      {!showAllFloors && !userFloor ? <Alert severity="warning" sx={{ mb: 2 }}>{t("calendar.floorMissing")}</Alert> : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "340px minmax(0, 1fr)" }, gap: 2 }}>
        <Paper sx={{ p: 2 }}>
          <CalendarSidebar
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            rooms={bookableRooms}
            floor={userFloor}
            showAllFloors={showAllFloors}
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
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle2">{t("calendar.refreshTitle")}</Typography>
              {eventRefreshing ? <Typography variant="caption" color="text.secondary">{t("common:states.refreshing")}</Typography> : null}
            </Box>
            <Button size="small" variant="outlined" disabled={!canLoadEvents || eventQuery.isFetching} onClick={() => eventQuery.refetch()}>
              {t("common:actions.refresh")}
            </Button>
          </Stack>
          {eventRefreshing ? <LinearProgress sx={{ mb: 1 }} /> : null}
          {roomQuery.isError ? (
            <ErrorState message={getApiError(roomQuery.error, t("calendar.roomsLoadError"))} busy={roomQuery.isFetching} onAction={() => roomQuery.refetch()} />
          ) : null}
          {userQuery.isError ? (
            <ErrorState message={getApiError(userQuery.error, t("calendar.usersLoadError"))} busy={userQuery.isFetching} onAction={() => userQuery.refetch()} />
          ) : null}
          {eventInitialLoading ? <LoadingState label={t("calendar.loading")} /> : null}
          {eventQuery.isError ? (
            <ErrorState message={getApiError(eventQuery.error, t("calendar.loadError"))} busy={eventQuery.isFetching} onAction={() => eventQuery.refetch()} />
          ) : null}
          {scheduleMode === "room" && !activeRoom ? <Alert severity="info">{t("calendar.selectRoomPrompt")}</Alert> : null}
          {!eventInitialLoading && (!eventQuery.isError || eventHasData) && canLoadEvents ? (
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
        rooms={bookableRooms}
        initialRoom={activeRoom}
        onClose={() => setEditor({ open: false, event: null, start: null, end: null })}
      />
    </Container>
  );
};

export default MeetingCalendar;
