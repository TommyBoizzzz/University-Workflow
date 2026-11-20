import { useCallback, useEffect, useState } from "react";
import {
  getAvailability,
  getCalendarEvents
} from "../services/calendarService.js";

const CALENDAR_EVENT_PAGE_SIZE = 5;

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const addDays = (value, amount) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const formatEventTime = (value, timeZone) => {
  if (!value) return "All day";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "All day";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  }).format(new Date(value));
};

const formatSelectedDate = (date) => (
  new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00`))
);

function Calendar({ canCreateMeeting, onRequestMeeting }) {
  const [date, setDate] = useState(today);
  const [events, setEvents] = useState([]);
  const [slots, setSlots] = useState([]);
  const [timeZone, setTimeZone] = useState("Asia/Phnom_Penh");
  const [eventSearch, setEventSearch] = useState("");
  const [currentEventPage, setCurrentEventPage] = useState(1);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const eventQuery = eventSearch.trim().toLocaleLowerCase();
  const filteredEvents = events.filter((event) => (
    [
      event.title,
      event.status,
      event.source,
      event.submittedBy,
      formatEventTime(event.start, timeZone),
    ].some((value) => String(value || "").toLocaleLowerCase().includes(eventQuery))
  ));
  const eventPageCount = Math.max(1, Math.ceil(filteredEvents.length / CALENDAR_EVENT_PAGE_SIZE));
  const currentEventPageNumber = Math.min(currentEventPage, eventPageCount);
  const visibleEvents = filteredEvents.slice(
    (currentEventPageNumber - 1) * CALENDAR_EVENT_PAGE_SIZE,
    currentEventPageNumber * CALENDAR_EVENT_PAGE_SIZE,
  );
  const firstVisibleEvent = filteredEvents.length
    ? (currentEventPageNumber - 1) * CALENDAR_EVENT_PAGE_SIZE + 1
    : 0;
  const lastVisibleEvent = Math.min(
    currentEventPageNumber * CALENDAR_EVENT_PAGE_SIZE,
    filteredEvents.length,
  );

  const changeDate = (nextDate) => {
    setError("");
    setIsLoading(true);
    setCurrentEventPage(1);
    setDate(nextDate);
  };

  const refresh = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const [calendar, availability] = await Promise.all([
        getCalendarEvents(date, date),
        getAvailability(date)
      ]);
      setEvents(calendar.events);
      setSlots(availability.slots);
      setTimeZone(calendar.timeZone);
    } catch (loadError) {
      setError(loadError.message || "Unable to load the university schedule.");
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getCalendarEvents(date, date),
      getAvailability(date)
    ])
      .then(([calendar, availability]) => {
        if (!active) return;
        setEvents(calendar.events);
        setSlots(availability.slots);
        setTimeZone(calendar.timeZone);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load the university schedule.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  return (
    <div className="calendar-workspace">
      <section className="calendar-intro">
        <div>
          <p className="calendar-kicker">UNIVERSITY SCHEDULE</p>
          <h2>Plan a meeting with confidence.</h2>
          <p>See approved meetings and pending requests, then request an open 60-minute weekday slot.</p>
        </div>
        <div className="calendar-date-controls">
          <button
            className="calendar-date-step"
            type="button"
            aria-label="Previous day"
            onClick={() => changeDate(addDays(date, -1))}
          >
            ‹
          </button>
          <label className="calendar-date-picker" htmlFor="calendar-date">
            <span>View date</span>
            <input
              id="calendar-date"
              type="date"
              value={date}
              onChange={(event) => changeDate(event.target.value)}
            />
          </label>
          <button
            className="calendar-date-step"
            type="button"
            aria-label="Next day"
            onClick={() => changeDate(addDays(date, 1))}
          >
            ›
          </button>
          <button className="calendar-today-button" type="button" onClick={() => changeDate(today())}>
            Today
          </button>
        </div>
      </section>

      {error && <div className="workspace-error calendar-error" role="alert">{error}</div>}

      <div className="calendar-columns">
        <section className="calendar-panel">
          <div className="calendar-panel-heading">
            <div><p className="calendar-kicker">MEETINGS &amp; PENDING REQUESTS</p><h3>{formatSelectedDate(date)}</h3></div>
            <button className="access-icon-button" type="button" onClick={refresh} disabled={isLoading} aria-label="Refresh schedule">↻</button>
          </div>
          {!isLoading && (
            <div className="user-directory-toolbar documents-search-toolbar">
              <label className="user-search" htmlFor="calendar-event-search">
                <span aria-hidden="true">⌕</span>
                <input
                  id="calendar-event-search"
                  type="search"
                  value={eventSearch}
                  onChange={(event) => {
                    setEventSearch(event.target.value);
                    setCurrentEventPage(1);
                  }}
                  placeholder="Search title, status, source..."
                />
              </label>
              <span className="user-result-count">
                Showing {firstVisibleEvent}–{lastVisibleEvent} of {filteredEvents.length}
              </span>
            </div>
          )}
          {isLoading ? (
            <div className="access-loading"><span className="small-spinner" /> Loading schedule...</div>
          ) : events.length === 0 ? (
            <div className="calendar-empty"><span aria-hidden="true">▦</span><strong>No meetings or pending requests</strong><p>Open times are listed alongside the schedule.</p></div>
          ) : filteredEvents.length === 0 ? (
            <div className="calendar-empty"><span aria-hidden="true">⌕</span><strong>No matching events</strong><p>Try a different title, status, or source.</p></div>
          ) : (
            <>
              <div className="calendar-event-list">
                {visibleEvents.map((event) => (
                  <article className="calendar-event" key={event.id}>
                    <div className="calendar-event-time">
                      <strong>{formatEventTime(event.start, timeZone)}</strong>
                      <span>{formatEventTime(event.end, timeZone)}</span>
                    </div>
                    <div className="calendar-event-copy">
                      <strong>{event.title}</strong>
                      <span>{event.status === "PENDING" ? "Pending request" : event.source}{event.submittedBy ? ` · ${event.submittedBy}` : ""}</span>
                    </div>
                  </article>
                ))}
              </div>
              {eventPageCount > 1 && (
                <nav className="documents-pagination" aria-label="Calendar event pages">
                  <button
                    className="documents-page-button"
                    type="button"
                    onClick={() => setCurrentEventPage(Math.max(1, currentEventPageNumber - 1))}
                    disabled={currentEventPageNumber === 1}
                  >
                    Previous
                  </button>
                  <span>Page {currentEventPageNumber} of {eventPageCount}</span>
                  <button
                    className="documents-page-button"
                    type="button"
                    onClick={() => setCurrentEventPage(Math.min(eventPageCount, currentEventPageNumber + 1))}
                    disabled={currentEventPageNumber === eventPageCount}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </section>

        <section className="calendar-panel">
          <div className="calendar-panel-heading">
            <div><p className="calendar-kicker">AVAILABLE TIMES</p><h3>60-minute meetings</h3></div>
            <span className="calendar-timezone">{timeZone}</span>
          </div>
          <p className="calendar-panel-description">Weekdays, 9:00 AM–5:00 PM. Pending requests also hold their selected time.</p>
          {isLoading ? (
            <div className="access-loading"><span className="small-spinner" /> Checking availability...</div>
          ) : slots.length === 0 ? (
            <div className="calendar-empty"><span aria-hidden="true">◷</span><strong>No open times for this date</strong><p>Choose another weekday to check availability.</p></div>
          ) : (
            <div className="calendar-slot-list">
              {slots.map((slot) => (
                <div className="calendar-slot" key={slot}>
                  <span><i />{slot}</span>
                  {canCreateMeeting && (
                    <button className="calendar-request-button" type="button" onClick={() => onRequestMeeting({ date, start: slot })}>
                      Request this time <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Calendar;