import React, { useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Button, Card, Divider, Empty, Space, Tag, Typography } from "antd";
import enGbLocale from "@fullcalendar/core/locales/en-gb.js";
import idLocale from "@fullcalendar/core/locales/id.js";
import { useTranslation } from "react-i18next";
import { calendarEventCueFlags, DEFAULT_WEEK_START_DAY, formatMeetingDateCue, formatMeetingTimeRange } from "../domain/calendar.js";
import { calendarLocaleForLanguage } from "../i18n/languages.js";

const selectableViews = new Set(["timeGridWeek", "timeGridDay"]);
const calendarLocales = { "en-gb": enGbLocale, id: idLocale };
const fullCalendarView = (view) => view === "timeGridDay" ? "timeGridDay" : "timeGridWeek";
const eventProp = (event, name) => event?.[name] ?? event?.extendedProps?.[name];
const isBusyProjection = (event) => eventProp(event, "visibility") === "busy" || eventProp(event, "can_view_details") === false;

const cueLinesFor = (event, locale, t) => {
  const flags = calendarEventCueFlags(event);
  const cues = [];
  if (flags.multiDay) {
    const dates = formatMeetingDateCue(event.start, event.end, locale);
    if (dates) cues.push(t("calendar.multiDayCue", { dates }));
  }
  if (flags.recurring) {
    cues.push(flags.occurrenceNumber
      ? t("calendar.recurringOccurrenceCue", { count: flags.occurrenceNumber })
      : t("calendar.recurringCue"));
  }
  return cues;
};

const CalendarControls = ({ view, onToday, onPrevious, onNext, onViewChange }) => {
  const { t } = useTranslation("calendar");
  return (
    <Space wrap style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }}>
      <Space.Compact aria-label={t("calendar.navigation")}>
        <Button onClick={onToday}>{t("calendar.today")}</Button>
        <Button onClick={onPrevious}>{t("calendar.previous")}</Button>
        <Button onClick={onNext}>{t("calendar.next")}</Button>
      </Space.Compact>
      <Space.Compact aria-label={t("calendar.viewMode")}>
        <Button type={view === "timeGridWeek" ? "primary" : "default"} onClick={() => onViewChange?.("timeGridWeek")}>
          {t("calendar.week")}
        </Button>
        <Button type={view === "timeGridDay" ? "primary" : "default"} onClick={() => onViewChange?.("timeGridDay")}>
          {t("calendar.day")}
        </Button>
        <Button type={view === "agenda" ? "primary" : "default"} onClick={() => onViewChange?.("agenda")}>
          {t("calendar.agenda")}
        </Button>
      </Space.Compact>
    </Space>
  );
};

const agendaDayKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const agendaDayLabel = (value, locale) => new Intl.DateTimeFormat(locale, {
  weekday: "long",
  day: "2-digit",
  month: "short",
  year: "numeric",
}).format(new Date(value));

const agendaRangeLabel = (selectedDate, locale) => {
  const start = new Date(selectedDate || new Date());
  const end = new Date(selectedDate || new Date());
  end.setDate(end.getDate() + 6);
  const formatter = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
};

const MeetingAgenda = ({ events, selectedDate, locale, onEventClick }) => {
  const { t } = useTranslation("calendar");
  const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const groups = [];
  for (const event of sorted) {
    const key = agendaDayKey(event.start);
    const current = groups[groups.length - 1];
    if (!current || current.key !== key) {
      groups.push({ key, date: event.start, events: [event] });
    } else {
      current.events.push(event);
    }
  }
  const todayKey = agendaDayKey(new Date());

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Typography.Text type="secondary">{agendaRangeLabel(selectedDate, locale)}</Typography.Text>
      {!groups.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("calendar.noMeetings")} />
      ) : groups.map((group) => (
        <section key={group.key}>
          <Space align="center" size={8}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {agendaDayLabel(group.date, locale)}
            </Typography.Title>
            {group.key === todayKey ? <Tag color="green">{t("calendar.today")}</Tag> : null}
          </Space>
          <Divider style={{ margin: "8px 0 12px" }} />
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {group.events.map((event) => {
              const busy = isBusyProjection(event);
              const title = event.title || t("calendar.untitled");
              const cues = cueLinesFor(event, locale, t);
              const multiDay = calendarEventCueFlags(event).multiDay;
              return (
                <Card
                  key={`${event.id}-${event.start}`}
                  size="small"
                  hoverable={!busy}
                  onClick={busy ? undefined : () => onEventClick?.(event)}
                  style={{ cursor: busy ? "default" : "pointer", opacity: busy ? 0.85 : 1 }}
                >
                  {multiDay ? (
                    <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
                      {formatMeetingDateCue(event.start, event.end, locale)}
                    </Typography.Text>
                  ) : null}
                  <Space wrap size="small" align="baseline">
                    {!busy ? (
                      <Typography.Text strong style={{ minWidth: 110, display: "inline-block" }}>
                        {formatMeetingTimeRange(event.start, event.end, locale)}
                      </Typography.Text>
                    ) : null}
                    <Typography.Text strong={busy}>{title}</Typography.Text>
                  </Space>
                  {cues.map((cue) => (
                    <Typography.Text key={cue} type="secondary" style={{ display: "block" }}>
                      {cue}
                    </Typography.Text>
                  ))}
                  {event.checked_in ? (
                    <Typography.Text type="success" style={{ display: "block" }}>
                      ✓ {t("calendar.checkedIn")}
                    </Typography.Text>
                  ) : null}
                </Card>
              );
            })}
          </Space>
        </section>
      ))}
    </Space>
  );
};

const MeetingWeek = ({ events = [], selectedDate, view = "timeGridWeek", weekStartsOn = DEFAULT_WEEK_START_DAY, onViewChange, onToday, onPrevious, onNext, onSelect, onEventClick }) => {
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
    <div>
      <CalendarControls
        view={view}
        onToday={onToday}
        onPrevious={onPrevious}
        onNext={onNext}
        onViewChange={onViewChange}
      />
      {view === "agenda" ? (
        <MeetingAgenda events={events} selectedDate={selectedDate} locale={browserLocale} onEventClick={onEventClick} />
      ) : (
        <div style={{ height: "calc(100vh - 360px)", minHeight: 320 }}>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={calendarLocales[calendarLocale] || calendarLocale}
            // The grid and the event query must agree on the first day of the week.
            firstDay={weekStartsOn}
            themeSystem="standard"
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
            // The day grid is the full 24 hours: meetings before 07:00 or after
            // 20:00 must stay visible instead of silently disappearing.
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            slotDuration="00:30:00"
            slotLabelInterval="01:00"
            scrollTime={`${String(Math.max(0, Math.min(23, new Date().getHours()))).padStart(2, "0")}:00:00`}
            scrollTimeReset
            allDaySlot={false}
            height="100%"
            contentHeight={1440}
            stickyHeaderDates
            eventMinHeight={36}
            slotEventOverlap={false}
            displayEventTime={false}
            eventTimeFormat={{ hour12: false }}
            events={events}
            eventContent={(info) => {
              const cues = cueLinesFor(info.event, browserLocale, t);
              const busy = isBusyProjection(info.event);
              const checked = Boolean(eventProp(info.event, "checked_in"));
              return (
                <div
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: "100%",
                    height: "100%",
                    overflow: "hidden",
                    lineHeight: 1.15,
                    padding: "0 2px",
                  }}
                >
                  {busy ? null : (
                    <div style={{ fontSize: 11.5, lineHeight: 1.1, opacity: 0.95, whiteSpace: "nowrap" }}>
                      {checked ? "✓ " : ""}
                      {formatMeetingTimeRange(info.event.start, info.event.end, browserLocale)}
                    </div>
                  )}
                  <div style={{ fontSize: 14, lineHeight: 1.15, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {info.event.title}
                  </div>
                  {cues.length ? (
                    <div style={{ fontSize: 11, lineHeight: 1.1, opacity: 0.9, whiteSpace: "nowrap" }}>
                      {cues.join(" · ")}
                    </div>
                  ) : null}
                </div>
              );
            }}
            select={handleSelect}
            eventClick={({ event }) => onEventClick?.(event)}
          />
        </div>
      )}
    </div>
  );
};

export default MeetingWeek;
