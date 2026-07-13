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
import ExcelJS from "exceljs/dist/exceljs.min.js";
import { EmptyState, ErrorState, LoadingState } from "../components/common/AsyncState.js";
import {
  currentMonthRange,
  formatDateLong,
  formatDateYYYYMMDD,
  isValidDateRange,
} from "../domain/dates.js";
import {
  buildRoomUsageWorkbook,
  formatReportMeetingDate,
  reportMeetingsFor,
  safeReportDescription,
  safeReportText,
} from "../domain/report.js";
import { useGetRoomUsageQuery } from "../redux/services/rooms.js";

const RoomUsageRow = ({ room }) => {
  const [open, setOpen] = useState(false);
  const meetings = reportMeetingsFor(room);

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
        <TableCell component="th" scope="row">{safeReportText(room?.room_name)}</TableCell>
        <TableCell align="right">{safeReportText(room?.total_pemakaian)}</TableCell>
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
                        <TableCell component="th" scope="row">{safeReportText(meeting?.subject)}</TableCell>
                        <TableCell>{safeReportText(meeting?.organizer)}</TableCell>
                        <TableCell>{safeReportDescription(meeting?.description)}</TableCell>
                        <TableCell>{formatReportMeetingDate(meeting?.start_date)}</TableCell>
                        <TableCell>{formatReportMeetingDate(meeting?.end_date)}</TableCell>
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

  const exportReport = async () => {
    try {
      const { workbook, filename } = buildRoomUsageWorkbook(ExcelJS, rooms, start, end);
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Unable to export room usage report", error);
    }
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
          onClick={() => void exportReport()}
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
