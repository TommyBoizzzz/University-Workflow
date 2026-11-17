import { useCallback, useEffect, useState } from "react";
import {
  getAvailability,
  getCalendarEvents
} from "../services/calendarService.js";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
          <p>See confirmed university meetings and request an open 60-minute weekday slot.</p>
        </div>
        <label className="calendar-date-picker" htmlFor="calendar-date">
          <span>View date</span>
          <input id="calendar-date" type="date" value={date} onChange={(event) => {
            setIsLoading(true);
            setDate(event.target.value);
          }} />
        </label>
      </section>

      {error && <div className="workspace-error calendar-error" role="alert">{error}</div>}

      <div className="calendar-columns">
        <section className="calendar-panel">
          <div className="calendar-panel-heading">
            <div><p className="calendar-kicker">CONFIRMED EVENTS</p><h3>{formatSelectedDate(date)}</h3></div>
            <button className="access-icon-button" type="button" onClick={refresh} disabled={isLoading} aria-label="Refresh schedule">↻</button>
          </div>
          {isLoading ? (
            <div className="access-loading"><span className="small-spinner" /> Loading schedule...</div>
          ) : events.length === 0 ? (
            <div className="calendar-empty"><span aria-hidden="true">▦</span><strong>No confirmed meetings</strong><p>Open times are listed alongside the schedule.</p></div>
          ) : (
            <div className="calendar-event-list">
              {events.map((event) => (
                <article className="calendar-event" key={event.id}>
                  <div className="calendar-event-time">
                    <strong>{formatEventTime(event.start, timeZone)}</strong>
                    <span>{formatEventTime(event.end, timeZone)}</span>
                  </div>
                  <div className="calendar-event-copy">
                    <strong>{event.title}</strong>
                    <span>{event.source}{event.submittedBy ? ` · ${event.submittedBy}` : ""}</span>
                  </div>
                </article>
              ))}
            </div>
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