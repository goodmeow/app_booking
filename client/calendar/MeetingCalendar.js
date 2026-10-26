import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Container, LinearProgress, Paper, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { isAuthenticated } from "../auth/auth-helper.js";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import {
  canManageBooking,
  calendarEventFilters,
  calendarEventFromApi,
  calendarRangeForView,
  defaultEventRange,
  DEFAULT_WEEK_START_DAY,
  navigateCalendarDate,
  uniqueCalendarEvents,
} from "../domain/calendar.js";
import { getApiError } from "../domain/api-error.js";
import { canUseAllFloors, defaultScheduleModeForRole, isAdminRole, roomsForRole } from "../domain/roles.js";
import { useGetEventsQuery } from "../redux/services/events.js";
import { useGetRoomStatusQuery, useGetRoomsQuery } from "../redux/services/rooms.js";
import { useGetPublicSettingsQuery } from "../redux/services/settings.js";
import { useListUserQuery } from "../redux/services/users.js";
import { useMenuAccess } from "../auth/use-menu-access.js";
import { wsJoinRoom, wsLeaveRoom } from "../redux/websocket.js";
import CalendarSidebar from "./CalendarSidebar.js";
import EventEditor from "./EventEditor.js";
import EventDetailsDrawer from "./EventDetailsDrawer.js";
import MeetingWeek from "./MeetingWeek.js";

// The API answers one room per query, so the floor schedule is assembled from
// one query per room on that floor. The server still applies its privacy
// projection, which means a colleague's meeting arrives as a busy block.
const RoomEventsLoader = ({ roomEmail, range, refreshToken, onResult }) => {
  const query = useGetEventsQuery(calendarEventFilters({ roomEmail, range }));
  const refetchRoomEvents = query.refetch;
  const roomEvents = query.data;
  const roomFetching = query.isFetching;
  const roomFailed = query.isError;
  const handledRefreshToken = useRef(refreshToken);

  useEffect(() => {
    onResult(roomEmail, {
      rangeKey: `${range.start}-${range.end}`,
      events: Array.isArray(roomEvents) ? roomEvents : [],
      isFetching: roomFetching,
      isError: roomFailed,
    });
  }, [roomEmail, range.start, range.end, roomEvents, roomFetching, roomFailed, onResult]);

  // The manual refresh button asks every room loader to refetch once; the
  // mounted loader must not refetch again on its own first render.
  useEffect(() => {
    if (refreshToken === handledRefreshToken.current) return;
    handledRefreshToken.current = refreshToken;
    refetchRoomEvents();
  }, [refreshToken, refetchRoomEvents]);

  return null;
};

const MeetingCalendar = () => {
  const { t } = useTranslation(["calendar", "common"]);
  const session = isAuthenticated();
  const dispatch = useDispatch();
  const isNarrow = useMediaQuery("(max-width:900px)");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState(isNarrow ? "agenda" : "timeGridWeek");
  const [scheduleMode, setScheduleMode] = useState(defaultScheduleModeForRole(session?.user?.role));
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [floorResults, setFloorResults] = useState({});
  const [refreshToken, setRefreshToken] = useState(0);
  const [editor, setEditor] = useState({ open: false, event: null, start: null, end: null });
  const [details, setDetails] = useState(null);

  // Di layar sempit, agenda lebih nyaman daripada grid minggu.
  useEffect(() => {
    setCalendarView(isNarrow ? "agenda" : "timeGridWeek");
  }, [isNarrow]);
  const floorMode = scheduleMode === "floor";
  const activeRoom = scheduleMode === "room" ? selectedRoom : null;
  const { data: publicSettings } = useGetPublicSettingsQuery();
  // The first day of the week stays in one place: the same value feeds the
  // FullCalendar grid and the query range. A global setting can replace the
  // default without touching either caller.
  const configuredWeekStart = Number(publicSettings?.week_start_day);
  const weekStartsOn = Number.isInteger(configuredWeekStart) && configuredWeekStart >= 0 && configuredWeekStart <= 6
    ? configuredWeekStart
    : DEFAULT_WEEK_START_DAY;
  const range = useMemo(
    () => calendarRangeForView(selectedDate, calendarView, weekStartsOn),
    [selectedDate, calendarView, weekStartsOn]
  );
  const rangeKey = `${range.start}-${range.end}`;
  const singleQuery = useGetEventsQuery(
    calendarEventFilters({ email: session.user.email, roomEmail: activeRoom?.email, range, all: scheduleMode === "all" }),
    { skip: floorMode || (scheduleMode === "room" && !activeRoom) }
  );
  const roomQuery = useGetRoomsQuery();
  const roomStatusQuery = useGetRoomStatusQuery(undefined, { pollingInterval: 30_000 });
  const isAdmin = isAdminRole(session?.user?.role);
  const { can: canMenu } = useMenuAccess();
  const canListAllUsers = canMenu("users");
  // Only a Users-menu role loads the full employee directory; everyone else
  // searches it on demand from the attendee picker.
  const userQuery = useListUserQuery(undefined, { skip: !canListAllUsers });
  const userFloor = String(session?.user?.floor ?? "").trim();
  const userFloors = session?.user?.floors || [];
  // The floor group "all" (or an admin) may view and book every floor.
  const showAllFloors = canUseAllFloors({ role: session?.user?.role, floor: userFloor, floors: userFloors, isAdmin });
  const allRooms = Array.isArray(roomQuery.data) ? roomQuery.data : [];
  // Everyone else sees only rooms on their own floor (the server still rejects
  // cross-floor bookings even if the UI is bypassed).
  const bookableRooms = useMemo(
    () => roomsForRole(allRooms, { role: session?.user?.role, floor: userFloor, floors: userFloors, isAdmin }),
    [allRooms, session?.user?.role, userFloor, userFloors, isAdmin]
  );
  const roomStatus = useMemo(() => {
    const allowed = new Set(bookableRooms.map((room) => room._id));
    return (Array.isArray(roomStatusQuery.data) ? roomStatusQuery.data : []).filter((room) => allowed.has(room.id));
  }, [bookableRooms, roomStatusQuery.data]);

  const currentFloorResult = useCallback((room) => {
    const result = floorResults[room.email];
    return result?.rangeKey === rangeKey ? result : undefined;
  }, [floorResults, rangeKey]);

  const recordFloorResult = useCallback((roomEmail, result) => {
    setFloorResults((current) => (current[roomEmail] === result ? current : { ...current, [roomEmail]: result }));
  }, []);

  const floorEvents = useMemo(
    () => uniqueCalendarEvents(bookableRooms.map((room) => currentFloorResult(room)?.events)),
    [bookableRooms, currentFloorResult]
  );
  // Before a room reports its first answer there is no result yet, so the
  // aggregated view still counts as loading.
  const floorFetching = floorMode && bookableRooms.some((room) => {
    const result = currentFloorResult(room);
    return !result || result.isFetching;
  });
  const floorFailed = floorMode
    && bookableRooms.length > 0
    && bookableRooms.every((room) => currentFloorResult(room)?.isError);

  const events = floorMode ? floorEvents : (Array.isArray(singleQuery.data) ? singleQuery.data : []);
  const hasEvents = events.length > 0;
  const eventFetching = floorMode ? floorFetching : singleQuery.isFetching;
  const eventError = floorMode ? floorFailed : singleQuery.isError;
  const eventInitialLoading = eventFetching && !hasEvents;
  const eventRefreshing = eventFetching && hasEvents;
  const canLoadEvents = floorMode || !(scheduleMode === "room" && !activeRoom);

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

  const changeScheduleMode = (mode) => {
    setScheduleMode(mode);
    if (mode !== "room") setSelectedRoom(null);
  };

  // Picking a room in the filter is the same intent as the room mode: show that
  // room. Clearing the filter returns to the default scope for the role.
  const changeRoomFilter = (room) => {
    setSelectedRoom(room);
    if (room) {
      setScheduleMode("room");
      return;
    }
    if (scheduleMode === "room") setScheduleMode(defaultScheduleModeForRole(session?.user?.role));
  };

  const refreshEvents = () => {
    if (floorMode) {
      setRefreshToken((current) => current + 1);
      return;
    }
    singleQuery.refetch();
  };

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      {!showAllFloors && !userFloor && !userFloors.length ? <Alert severity="warning" sx={{ mb: 2 }}>{t("calendar.floorMissing")}</Alert> : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "340px minmax(0, 1fr)" }, gap: 2 }}>
        <Paper sx={{ p: 2 }}>
          <CalendarSidebar
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            rooms={bookableRooms}
            floor={userFloor}
            floors={userFloors}
            showAllFloors={showAllFloors}
            showFloorSchedule={!showAllFloors && Boolean(userFloor || userFloors.length)}
            isAdmin={isAdmin}
            showTabletStatus={isAdmin}
            roomStatus={roomStatus}
            scheduleMode={scheduleMode}
            onScheduleModeChange={changeScheduleMode}
            selectedRoom={selectedRoom}
            onRoomChange={changeRoomFilter}
            onAdd={addEvent}
          />
        </Paper>
        <Paper sx={{ p: 2, minWidth: 0 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} sx={{ mb: 1 }}>
            <Box>
              <Typography variant="subtitle2">{t("calendar.refreshTitle")}</Typography>
              {eventRefreshing ? <Typography variant="caption" color="text.secondary">{t("common:states.refreshing")}</Typography> : null}
            </Box>
            <Button size="small" variant="outlined" disabled={!canLoadEvents || eventFetching} onClick={refreshEvents}>
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
          {floorMode
            ? bookableRooms.map((room) => (
              <RoomEventsLoader
                key={room.email}
                roomEmail={room.email}
                range={range}
                refreshToken={refreshToken}
                onResult={recordFloorResult}
              />
            ))
            : null}
          {eventInitialLoading ? <LoadingState label={t("calendar.loading")} /> : null}
          {eventError ? (
            <ErrorState
              message={getApiError(floorMode ? undefined : singleQuery.error, t("calendar.loadError"))}
              busy={eventFetching}
              onAction={refreshEvents}
            />
          ) : null}
          {scheduleMode === "room" && !activeRoom ? <Alert severity="info">{t("calendar.selectRoomPrompt")}</Alert> : null}
          {floorMode && !bookableRooms.length ? <Alert severity="info">{t("calendar.floorScheduleEmpty")}</Alert> : null}
          {!eventInitialLoading && (!eventError || hasEvents) && canLoadEvents ? (
            <MeetingWeek
              events={events}
              selectedDate={selectedDate}
              view={calendarView}
              weekStartsOn={weekStartsOn}
              onViewChange={setCalendarView}
              onToday={() => setSelectedDate(new Date())}
              onPrevious={() => setSelectedDate((current) => navigateCalendarDate(current, calendarView, "previous"))}
              onNext={() => setSelectedDate((current) => navigateCalendarDate(current, calendarView, "next"))}
              onSelect={(selection) => openNewEvent(selection.start, selection.end)}
              onEventClick={(event) => {
                const mapped = calendarEventFromApi(event);
                if (mapped.can_view_details === false || mapped.visibility === "busy") return;
                setDetails(mapped);
              }}
            />
          ) : null}
        </Paper>
      </Box>

      <EventDetailsDrawer
        open={Boolean(details)}
        event={details}
        rooms={allRooms}
        canMutate={Boolean(details) && canManageBooking({
          event: details,
          sessionEmail: session.user.email,
          sessionUserId: session.user._id,
          isAdmin,
        })}
        onClose={() => setDetails(null)}
        onEdit={() => {
          setEditor({ open: true, event: details, start: details.start, end: details.end });
          setDetails(null);
        }}
      />

      <EventEditor
        open={editor.open}
        event={editor.event}
        initialStart={editor.start}
        initialEnd={editor.end}
        sessionEmail={session.user.email}
        sessionUserId={session.user._id}
        role={session.user.role}
        userFloor={userFloor}
        userFloors={userFloors}
        isAdmin={isAdmin}
        users={Array.isArray(userQuery.data) ? userQuery.data : []}
        rooms={bookableRooms}
        initialRoom={activeRoom}
        onClose={() => setEditor({ open: false, event: null, start: null, end: null })}
      />
    </Container>
  );
};

export default MeetingCalendar;
