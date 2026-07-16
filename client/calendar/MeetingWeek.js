import React, { useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import bootstrap5Plugin from "@fullcalendar/bootstrap5";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Alert, Box, Button, ButtonGroup, Divider, Paper, Stack, Typography } from "@mui/material";
import enGbLocale from "@fullcalendar/core/locales/en-gb.js";
import idLocale from "@fullcalendar/core/locales/id.js";
import { useTranslation } from "react-i18next";
import { formatMeetingDateCue, formatMeetingTimeRange } from "../domain/calendar.js";
import { calendarLocaleForLanguage } from "../i18n/languages.js";

const selectableViews = new Set(["timeGridWeek", "timeGridDay"]);
const calendarLocales = { "en-gb": enGbLocale, id: idLocale };
const fullCalendarView = (view) => view === "timeGridDay" ? "timeGridDay" : "timeGridWeek";
const eventProp = (event, name) => event?.[name] ?? event?.extendedProps?.[name];
const isBusyProjection = (event) => eventProp(event, "visibility") === "busy" || eventProp(event, "can_view_details") === false;

const CalendarControls = ({ view, onToday, onPrevious, onNext, onViewChange }) => {
  const { t } = useTranslation("calendar");
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} sx={{ mb: 2 }}>
      <ButtonGroup fullWidth={false} variant="outlined" aria-label={t("calendar.navigation")}>
        <Button onClick={onToday}>{t("calendar.today")}</Button>
        <Button onClick={onPrevious}>{t("calendar.previous")}</Button>
        <Button onClick={onNext}>{t("calendar.next")}</Button>
      </ButtonGroup>
      <ButtonGroup fullWidth={false} variant="outlined" aria-label={t("calendar.viewMode")}>
        <Button variant={view === "timeGridWeek" ? "contained" : "outlined"} onClick={() => onViewChange?.("timeGridWeek")}>{t("calendar.week")}</Button>
        <Button variant={view === "timeGridDay" ? "contained" : "outlined"} onClick={() => onViewChange?.("timeGridDay")}>{t("calendar.day")}</Button>
        <Button variant={view === "agenda" ? "contained" : "outlined"} onClick={() => onViewChange?.("agenda")}>{t("calendar.agenda")}</Button>
      </ButtonGroup>
    </Stack>
  );
};

const MeetingAgenda = ({ events, locale, onEventClick }) => {
  const { t } = useTranslation("calendar");
  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  if (!sorted.length) return <Alert severity="info">{t("calendar.noMeetings")}</Alert>;
  return (
    <Stack spacing={1.5}>
      {sorted.map((event) => {
        const busy = isBusyProjection(event);
        const title = event.title || t("calendar.untitled");
        return (
          <Paper
            key={`${event.id}-${event.start}`}
            variant="outlined"
            component="button"
            type="button"
            disabled={busy}
            aria-disabled={busy ? "true" : undefined}
            onClick={busy ? undefined : () => onEventClick?.(event)}
            sx={{
              p: 1.5,
              textAlign: "left",
              cursor: busy ? "default" : "pointer",
              borderColor: busy ? "divider" : "primary.main",
              backgroundColor: "background.paper",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {formatMeetingDateCue(event.start, event.end, locale)}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
              <Typography variant="subtitle2" sx={{ minWidth: 110 }}>
                {busy ? title : formatMeetingTimeRange(event.start, event.end, locale)}
              </Typography>
              {!busy ? (
                <>
                  <Divider flexItem orientation="vertical" sx={{ display: { xs: "none", sm: "block" } }} />
                  <Typography variant="body2">{title}</Typography>
                </>
              ) : null}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
};

const MeetingWeek = ({ events = [], selectedDate, view = "timeGridWeek", onViewChange, onToday, onPrevious, onNext, onSelect, onEventClick }) => {
  const { i18n, t } = useTranslation("calendar");
  const calendarLocale = calendarLocaleForLanguage(i18n.resolvedLanguage || i18n.language);
  const browserLocale = calendarLocale === "id" ? "id-ID" : "en-GB";
  const calendarRef = useRef(null);

  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi && selectedDate) calendarApi.gotoDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi && view !== "agenda") calendarApi.changeView(fullCalendarView(view), selectedDate || undefined);
  }, [view, selectedDate]);

  const handleSelect = (selectInfo) => {
    if (selectableViews.has(selectInfo.view.type)) onSelect?.(selectInfo);
  };

  return (
    <Box>
      <CalendarControls
        view={view}
        onToday={onToday}
        onPrevious={onPrevious}
        onNext={onNext}
        onViewChange={onViewChange}
      />
      {view === "agenda" ? (
        <MeetingAgenda events={events} locale={browserLocale} onEventClick={onEventClick} />
      ) : (
    <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, bootstrap5Plugin]}
      locale={calendarLocales[calendarLocale] || calendarLocale}
      themeSystem="bootstrap5"
      nowIndicator
      headerToolbar={{ left: "title", right: "" }}
      buttonText={{
        today: t("calendar.today"),
        prev: t("calendar.previous"),
        next: t("calendar.next"),
        week: t("calendar.week"),
        timeGridWeek: t("calendar.week"),
        day: t("calendar.day"),
        timeGridDay: t("calendar.day"),
        list: t("calendar.agenda"),
        listWeek: t("calendar.agenda"),
      }}
      initialView={fullCalendarView(view)}
      initialDate={selectedDate || undefined}
      selectable
      selectMirror
      weekends
      dayMaxEvents
      selectOverlap={false}
      displayEventTime={false}
      eventTimeFormat={{ hour12: false }}
      events={events}
      eventContent={(info) => {
        if (isBusyProjection(info.event)) return <span>{info.event.title}</span>;
        return (
          <Stack component="span" spacing={0.25}>
            <Typography component="span" variant="caption">{formatMeetingTimeRange(info.event.start, info.event.end, browserLocale)}</Typography>
            <Typography component="span" variant="body2">{info.event.title}</Typography>
          </Stack>
        );
      }}
      select={handleSelect}
      eventClick={({ event }) => onEventClick?.(event)}
    />
      )}
    </Box>
  );
};

export default MeetingWeek;
