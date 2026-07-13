import React, { useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs from "dayjs";

const roomKey = (room) => room?._id || room?.id || room?.email || room?.name || "";
const roomLabel = (room) => room?.name || room?.email || "";

const CalendarSidebar = ({
  selectedDate,
  onDateChange,
  rooms = [],
  selectedRoom,
  onRoomChange,
  onAdd,
}) => {
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
        Add Event
      </Button>

      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DateCalendar
          value={selectedDate ? dayjs(selectedDate) : null}
          onChange={(value) => onDateChange?.(value ? value.toDate() : null)}
          sx={{ width: "100%", maxWidth: "100%" }}
        />
      </LocalizationProvider>

      <Box>
        <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
          Room filter
        </Typography>
        <Autocomplete
          options={buildings}
          value={building}
          onChange={(_event, value) => {
            setBuilding(value);
            if (selectedRoom && value && selectedRoom.building !== value) onRoomChange?.(null);
          }}
          renderInput={(params) => <TextField {...params} label="Building" size="small" />}
          sx={{ mb: 1.5 }}
        />
        <Autocomplete
          options={visibleRooms}
          value={selectedRoom || null}
          onChange={(_event, value) => onRoomChange?.(value)}
          getOptionLabel={roomLabel}
          isOptionEqualToValue={(option, value) => roomKey(option) === roomKey(value)}
          renderInput={(params) => (
            <TextField {...params} label="Search a room" placeholder="All rooms" size="small" />
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
    </Stack>
  </Box>
  );
};

export default CalendarSidebar;
