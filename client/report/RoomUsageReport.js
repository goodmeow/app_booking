import React, { useState } from "react";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import {
  Alert,
  Box,
  Button,
  Collapse,
  Container,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import * as XLSX from "xlsx";
import { EmptyState, ErrorState, LoadingState } from "../components/common/AsyncState.js";
import {
  currentMonthRange,
  formatDateDDMMYYYY,
  formatDateLong,
  formatDateTimeLong,
  formatDateYYYYMMDD,
  isValidDateRange,
  reportFilename,
} from "../domain/dates.js";
import { useGetRoomUsageQuery } from "../redux/services/rooms.js";

const safeText = (value) => (value === null || value === undefined || value === "" ? "-" : String(value));

const safeDescription = (value) => {
  const description = safeText(value);
  if (description === "-") return description;
  try {
    return decodeURIComponent(description);
  } catch (_error) {
    return description;
  }
};

const formatMeetingDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return formatDateTimeLong(date);
};

const meetingsFor = (room) => (Array.isArray(room?.list_meeting) ? room.list_meeting : []);

const RoomUsageRow = ({ room }) => {
  const [open, setOpen] = useState(false);
  const meetings = meetingsFor(room);

  return (
    <React.Fragment>
      <TableRow>
        <TableCell sx={{ width: 56 }}>
          <IconButton
            aria-label={open ? "collapse row" : "expand row"}
            size="small"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">{safeText(room?.room_name)}</TableCell>
        <TableCell align="right">{safeText(room?.total_pemakaian)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell sx={{ py: 0 }} colSpan={3}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ m: 2 }}>
              <Typography variant="h6" gutterBottom>History Meeting</Typography>
              {meetings.length ? (
                <Table size="small" aria-label="History Meeting">
                  <TableHead>
                    <TableRow>
                      <TableCell>Subject</TableCell>
                      <TableCell>Organizer</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Start Date</TableCell>
                      <TableCell>End Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {meetings.map((meeting, index) => (
                      <TableRow key={meeting?._id || `${room?.room_name || "room"}-${index}`}>
                        <TableCell component="th" scope="row">{safeText(meeting?.subject)}</TableCell>
                        <TableCell>{safeText(meeting?.organizer)}</TableCell>
                        <TableCell>{safeDescription(meeting?.description)}</TableCell>
                        <TableCell>{formatMeetingDate(meeting?.start_date)}</TableCell>
                        <TableCell>{formatMeetingDate(meeting?.end_date)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <EmptyState message="No Meeting History" />}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};

const RoomUsageReport = () => {
  const initialRange = currentMonthRange();
  const [start, setStart] = useState(() => formatDateYYYYMMDD(initialRange.start));
  const [end, setEnd] = useState(() => formatDateYYYYMMDD(initialRange.end));
  const validRange = isValidDateRange(start, end);
  const query = useGetRoomUsageQuery({ start, end }, { skip: !validRange });
  const rooms = Array.isArray(query.data) ? query.data : [];

  const exportReport = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([["Room Name", "Room Mail", "Usage Total"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      `Periode ${formatDateDDMMYYYY(new Date(`${start}T00:00:00`))} - ${formatDateDDMMYYYY(new Date(`${end}T00:00:00`))}`
    );
    let rowNumber = 2;
    rooms.forEach((room) => {
      const meetings = meetingsFor(room);
      const rows = [
        [safeText(room?.room_name), safeText(room?.room_mail), safeText(room?.total_pemakaian)],
        [null, "History Pemakaian"],
        meetings.length
          ? [null, "Subject", "Organizer", "Description", "Start Date", "End Date"]
          : [null, "No History Meeting"],
        ...meetings.map((meeting) => [
          null,
          safeText(meeting?.subject),
          safeText(meeting?.organizer),
          safeDescription(meeting?.description),
          formatMeetingDate(meeting?.start_date),
          formatMeetingDate(meeting?.end_date),
        ]),
      ];
      XLSX.utils.sheet_add_aoa(worksheet, rows, { origin: `A${rowNumber}` });
      rowNumber += 3 + meetings.length;
    });
    worksheet["!cols"] = [24, 30, 24, 42, 30, 30].map((width) => ({ width }));
    XLSX.writeFile(workbook, reportFilename(new Date(`${start}T00:00:00`), new Date(`${end}T00:00:00`)));
  };

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
    <Paper component="section" elevation={4} sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>Report Rooms Usage</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
        <TextField
          label="Start Time"
          type="date"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="End Time"
          type="date"
          value={end}
          error={!validRange}
          helperText={!validRange ? "End Time cannot be before Start Time" : " "}
          onChange={(event) => setEnd(event.target.value)}
          inputProps={{ min: start }}
          InputLabelProps={{ shrink: true }}
        />
        <Button
          variant="contained"
          color="success"
          startIcon={<FileDownloadIcon />}
          disabled={!validRange || query.isFetching || query.isError || !rooms.length}
          onClick={exportReport}
          sx={{ ml: { sm: "auto" }, minHeight: 40 }}
        >
          EXPORT HISTORY TO EXCEL
        </Button>
      </Stack>

      {!validRange ? <Alert severity="error" sx={{ mt: 1 }}>End Time cannot be before Start Time</Alert> : null}
      {validRange ? (
        <Typography align="center" sx={{ my: 2 }}>
          Periode {formatDateLong(new Date(`${start}T00:00:00`))} - {formatDateLong(new Date(`${end}T00:00:00`))}
        </Typography>
      ) : null}

      {validRange && query.isFetching ? <LoadingState label="Loading..." /> : null}
      {validRange && !query.isFetching && query.isError ? (
        <ErrorState message="An error occured" />
      ) : null}
      {validRange && !query.isFetching && !query.isError && !rooms.length ? (
        <EmptyState message="No Meeting History" />
      ) : null}
      {validRange && !query.isFetching && !query.isError && rooms.length ? (
        <TableContainer sx={{ maxHeight: 550 }}>
          <Table stickyHeader aria-label="collapsible room usage table">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Room Name</TableCell>
                <TableCell align="right">Total Pemakaian</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map((room, index) => (
                <RoomUsageRow key={room?._id || room?.room_mail || `${room?.room_name || "room"}-${index}`} room={room} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </Paper>
    </Container>
  );
};

export default RoomUsageReport;
