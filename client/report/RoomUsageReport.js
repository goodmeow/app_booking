import React, { useState } from "react";
import KeyboardArrowDownIconModule from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIconModule from "@mui/icons-material/KeyboardArrowUp";
import FileDownloadIconModule from "@mui/icons-material/FileDownload";
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
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { resolveMuiIcon } from "../components/common/resolve-mui-icon.js";
import {
  currentMonthRange,
  formatDateDDMMMYYYY,
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
import { normalizeLanguage } from "../i18n/languages.js";

const KeyboardArrowDownIcon = resolveMuiIcon(KeyboardArrowDownIconModule);
const KeyboardArrowUpIcon = resolveMuiIcon(KeyboardArrowUpIconModule);
const FileDownloadIcon = resolveMuiIcon(FileDownloadIconModule);

const RoomUsageRow = ({ room, language }) => {
  const { t } = useTranslation("report");
  const [open, setOpen] = useState(false);
  const meetings = reportMeetingsFor(room);

  return (
    <React.Fragment>
      <TableRow>
        <TableCell sx={{ width: 56 }}>
          <IconButton
            aria-label={open ? t("collapse") : t("expand")}
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
              <Typography variant="h6" gutterBottom>{t("history")}</Typography>
              {meetings.length ? (
                <Table size="small" aria-label={t("history")}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("subject")}</TableCell>
                      <TableCell>{t("organizer")}</TableCell>
                      <TableCell>{t("description")}</TableCell>
                      <TableCell>{t("meetingStart")}</TableCell>
                      <TableCell>{t("meetingEnd")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {meetings.map((meeting, index) => (
                      <TableRow key={meeting?._id || `${room?.room_name || "room"}-${index}`}>
                        <TableCell component="th" scope="row">{safeReportText(meeting?.subject)}</TableCell>
                        <TableCell>{safeReportText(meeting?.organizer)}</TableCell>
                        <TableCell>{safeReportDescription(meeting?.description)}</TableCell>
                        <TableCell>{formatReportMeetingDate(meeting?.start_date, language)}</TableCell>
                        <TableCell>{formatReportMeetingDate(meeting?.end_date, language)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <EmptyState message={t("empty")} />}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};

const RoomUsageReport = () => {
  const { i18n, t } = useTranslation("report");
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  const initialRange = currentMonthRange();
  const [start, setStart] = useState(() => formatDateYYYYMMDD(initialRange.start));
  const [end, setEnd] = useState(() => formatDateYYYYMMDD(initialRange.end));
  const validRange = isValidDateRange(start, end);
  const query = useGetRoomUsageQuery({ start, end }, { skip: !validRange });
  const rooms = Array.isArray(query.data) ? query.data : [];
  const hasReportData = Array.isArray(query.data);
  const initialLoading = query.isFetching && !hasReportData;
  const refreshing = query.isFetching && hasReportData;
  const [exportError, setExportError] = useState("");

  const exportReport = async () => {
    setExportError("");
    try {
      const { workbook, filename } = buildRoomUsageWorkbook(ExcelJS, rooms, start, end, language);
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
      setExportError(t("exportError"));
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
    <Paper component="section" elevation={4} sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>{t("title")}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
        <TextField
          label={t("startDate")}
          type="date"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label={t("endDate")}
          type="date"
          value={end}
          error={!validRange}
          helperText={!validRange ? t("invalidRange") : " "}
          onChange={(event) => setEnd(event.target.value)}
          inputProps={{ min: start }}
          InputLabelProps={{ shrink: true }}
        />
        <Button
          variant="contained"
          color="success"
          startIcon={<FileDownloadIcon />}
          disabled={!validRange || query.isFetching || !rooms.length}
          onClick={() => void exportReport()}
          sx={{ ml: { sm: "auto" }, minHeight: 40 }}
        >
          {t("export")}
        </Button>
      </Stack>

      {!validRange ? <Alert severity="error" sx={{ mt: 1 }}>{t("invalidRange")}</Alert> : null}
      {exportError ? <Alert severity="error" sx={{ mt: 1 }}>{exportError}</Alert> : null}
      {validRange ? (
        <Typography align="center" sx={{ my: 2 }}>
          {t("period", {
            start: formatDateDDMMMYYYY(new Date(`${start}T00:00:00`), language),
            end: formatDateDDMMMYYYY(new Date(`${end}T00:00:00`), language),
          })}
        </Typography>
      ) : null}

      {validRange && refreshing ? <Alert severity="info" sx={{ mt: 1 }}>{t("common:states.refreshing")}</Alert> : null}
      {validRange && initialLoading ? <LoadingState label={t("loading")} /> : null}
      {validRange && query.isError ? (
        <ErrorState message={t("loadError")} busy={query.isFetching} onAction={() => query.refetch()} />
      ) : null}
      {validRange && !initialLoading && (!query.isError || hasReportData) && !rooms.length ? (
        <EmptyState message={t("empty")} />
      ) : null}
      {validRange && !initialLoading && (!query.isError || hasReportData) && rooms.length ? (
        <TableContainer sx={{ maxHeight: 550 }}>
          <Table stickyHeader aria-label={t("tableAria")}>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>{t("roomName")}</TableCell>
                <TableCell align="right">{t("totalUsage")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map((room, index) => (
                <RoomUsageRow key={room?._id || room?.room_mail || `${room?.room_name || "room"}-${index}`} room={room} language={language} />
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
