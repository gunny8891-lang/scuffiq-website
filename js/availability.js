// ============================================================
// ScuffIQ availability helpers
// js/availability.js
//
// Pure functions: no network or DOM access, so the same logic can
// run in the browser (customer slot picker) and in the Worker.
// ============================================================

// weeklyHours: [{ weekday: 0-6, start_time: "08:00", end_time: "17:00" }]
// blockOuts:   ["2026-10-20", ...]            (YYYY-MM-DD)
// bookings:    [{ start: Date, end: Date }]   (confirmed bookings)
// Returns free slots as [{ start: Date, end: Date }] between from and to.
function getFreeSlots({
  weeklyHours,
  blockOuts = [],
  bookings = [],
  from,
  to,
  slotMinutes = 60,
  bufferMinutes = 0,
}) {
  const blocked = new Set(blockOuts);
  const slots = [];
  const slotMs = slotMinutes * 60 * 1000;
  const bufferMs = bufferMinutes * 60 * 1000;

  for (
    let day = startOfDay(from);
    day < to;
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  ) {
    if (blocked.has(toDateKey(day))) continue;

    const windows = weeklyHours.filter((w) => w.weekday === day.getDay());

    for (const window of windows) {
      const windowStart = atTime(day, window.start_time);
      const windowEnd = atTime(day, window.end_time);

      for (
        let start = windowStart.getTime();
        start + slotMs <= windowEnd.getTime();
        start += slotMs
      ) {
        const slotStart = new Date(start);
        const slotEnd = new Date(start + slotMs);

        if (slotStart < from || slotEnd > to) continue;

        const clashes = bookings.some(
          (b) =>
            slotStart.getTime() < b.end.getTime() + bufferMs &&
            slotEnd.getTime() + bufferMs > b.start.getTime()
        );

        if (!clashes) slots.push({ start: slotStart, end: slotEnd });
      }
    }
  }

  return slots;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Local date key, not UTC, so a block-out date means the same day for everyone.
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function atTime(day, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}
