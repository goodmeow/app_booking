import React, { useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import bootstrap5Plugin from "@fullcalendar/bootstrap5";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";

const selectableViews = new Set(["timeGridWeek", "timeGridDay"]);

const MeetingWeek = ({ events = [], selectedDate, onSelect, onEventClick }) => {
  const calendarRef = useRef(null);

  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi && selectedDate) calendarApi.gotoDate(selectedDate);
  }, [selectedDate]);

  const handleSelect = (selectInfo) => {
    if (selectableViews.has(selectInfo.view.type)) onSelect?.(selectInfo);
  };

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, bootstrap5Plugin]}
      themeSystem="bootstrap5"
      nowIndicator
      headerToolbar={{ left: "title", right: "" }}
      initialView="timeGridWeek"
      initialDate={selectedDate || undefined}
      selectable
      selectMirror
      weekends
      dayMaxEvents
      selectOverlap={false}
      displayEventTime={false}
      eventTimeFormat={{ hour12: false }}
      events={events}
      select={handleSelect}
      eventClick={({ event }) => onEventClick?.(event)}
    />
  );
};

export default MeetingWeek;
