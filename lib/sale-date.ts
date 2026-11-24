// Date helpers for sales. All "YYYY-MM-DD" strings are in the browser's local time zone.

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Local calendar date of `date` as YYYY-MM-DD (the format <input type="date"> uses). */
export function toDateInputValue(date: Date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local date and time of `date` as YYYY-MM-DDTHH:mm (the format <input type="datetime-local"> uses). */
export function toDateTimeInputValue(date: Date = new Date()) {
  return `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Turns a picked sale date into the timestamp to store.
 * Today keeps the current time, so same-day sales stay in the order they were made.
 * Past days are stored at local noon, so the calendar day doesn't shift in any time zone.
 */
export function saleDateToISO(dateValue: string) {
  if (dateValue === toDateInputValue()) return new Date().toISOString();
  return new Date(`${dateValue}T12:00:00`).toISOString();
}

/** Start/end of local calendar days, for date-range filters sent to the API. */
export function dayStartISO(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toISOString();
}

export function dayEndISO(dateValue: string) {
  return new Date(`${dateValue}T23:59:59.999`).toISOString();
}
