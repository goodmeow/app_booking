import React, { useMemo, useState } from "react";
import {
  Autocomplete,
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
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
  showAllFloors = false,
  roomStatus = [],
  scheduleMode = "mine",
  onScheduleModeChange,
  selectedRoom,
  onRoomChange,
  onAdd,
}) => {
  const { i18n, t } = useTranslation("calendar");
  const dateLocale = calendarLocaleForLanguage(i18n.resolvedLanguage || i18n.language);
  const [building, setBuilding] = useState(null);
  const buildings = useMemo(
    () => [...new Set(rooms.map((room) => room?.building).filter(Boolean))].sort(),
    [rooms]
  );
  const visibleRooms = building ? rooms.filter((room) => room?.building === building) : rooms;

  return (
  <Box
    component="aside"
    sx={{ width: "100%" }}
  >
    <Stack spacing={2}>
      <Button fullWidth variant="contained" onClick={onAdd}>
        {t("sidebar.addMeeting")}
      </Button>

      <Box>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
          {t("sidebar.scheduleMode")}
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={scheduleMode}
          onChange={(_event, value) => {
            if (value) onScheduleModeChange?.(value);
          }}
        >
          <ToggleButton value="mine">{t("sidebar.mySchedule")}</ToggleButton>
          <ToggleButton value="room">{t("sidebar.roomSchedule")}</ToggleButton>
        </ToggleButtonGroup>
        <Alert severity="info" sx={{ mt: 1 }}>
          {t(scheduleMode === "room" ? "sidebar.roomHint" : "sidebar.mineHint")}
        </Alert>
      </Box>

      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={dateLocale}>
        <DateCalendar
          value={selectedDate ? dayjs(selectedDate) : null}
          onChange={(value) => onDateChange?.(value ? value.toDate() : null)}
          sx={{ width: "100%", maxWidth: "100%" }}
        />
      </LocalizationProvider>

      <Box>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
          {t("sidebar.filterTitle")}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {showAllFloors
            ? t("calendar.floorScopeAll")
            : floor
              ? t("calendar.floorScope", { floor })
              : t("calendar.floorMissing")}
        </Typography>
        <Autocomplete
          options={buildings}
          value={building}
          onChange={(_event, value) => {
            setBuilding(value);
            if (selectedRoom && value && selectedRoom.building !== value) onRoomChange?.(null);
          }}
          renderInput={(params) => <TextField {...params} label={t("sidebar.building")} size="small" />}
          sx={{ mb: 1.5 }}
        />
        <Autocomplete
          options={visibleRooms}
          value={selectedRoom || null}
          onChange={(_event, value) => onRoomChange?.(value)}
          getOptionLabel={roomLabel}
          isOptionEqualToValue={(option, value) => roomKey(option) === roomKey(value)}
          renderInput={(params) => (
            <TextField {...params} label={t("sidebar.searchRoom")} placeholder={t("sidebar.allRooms")} size="small" />
          )}
        />
        {selectedRoom ? (
          <Chip
            label={roomLabel(selectedRoom)}
            onDelete={() => onRoomChange?.(null)}
            color="primary"
            variant="outlined"
            sx={{ mt: 1.5, maxWidth: "100%" }}
          />
        ) : null}
      </Box>

      {roomStatus.length ? (
        <Box>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
            {t("calendar.roomStatusTitle")}
          </Typography>
          <Stack spacing={1}>
            {roomStatus.map((room) => (
              <Paper
                key={room.id}
                variant="outlined"
                sx={{ p: 1.25, borderColor: room.occupied ? "error.light" : "success.light" }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" fontWeight={600} noWrap>{room.name}</Typography>
                  <Chip
                    size="small"
                    color={room.occupied ? "error" : "success"}
                    label={room.occupied ? t("calendar.roomOccupied") : t("calendar.roomFree")}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block">
                  {room.occupied
                    ? t("calendar.roomOccupiedBy", {
                      name: room.organizerFirstName || "-",
                      until: formatClock(room.end, dateLocale),
                    })
                    : t("calendar.roomFreeText")}
                  {" · "}
                  {room.tabletOnline ? t("calendar.tabletOnline") : t("calendar.tabletOffline")}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  </Box>
  );
};

export default CalendarSidebar;
