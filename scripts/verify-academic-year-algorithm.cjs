/**
 * Verify that the pre-rentrée/rentrée algorithm is fully dynamic per academic year.
 * Tests the calculateYearDates() function for multiple years.
 */

const DEFAULT_CALENDAR_CONFIG = {
  startMonth: 8, // September (0-indexed)
  preEntryWeekNumber: 1, // 1st Monday of the month
  preEntryDayOfWeek: 1, // Monday (0=Sun, 1=Mon, ..., 6=Sat)
  entryWeekOffset: 1, // +1 week between pre-rentrée and rentrée
  endMonth: 5, // June
  endDayOfWeek: 5, // Friday (last of month)
};

function getNthDayOfWeekOfMonth(year, month, weekNumber, dayOfWeek) {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const firstDayOfWeek = firstOfMonth.getUTCDay();
  const daysUntilFirstOccurrence = (dayOfWeek - firstDayOfWeek + 7) % 7;
  const dayOfNthOccurrence = 1 + daysUntilFirstOccurrence + (weekNumber - 1) * 7;
  return new Date(Date.UTC(year, month, dayOfNthOccurrence));
}

function getLastDayOfWeekOfMonth(year, month, dayOfWeek) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  let currentDay = lastDay.getUTCDay();
  const offset = (currentDay - dayOfWeek + 7) % 7;
  lastDay.setUTCDate(lastDay.getUTCDate() - offset);
  return lastDay;
}

function calculateYearDates(startYear, config = DEFAULT_CALENDAR_CONFIG) {
  const preEntryDate = getNthDayOfWeekOfMonth(
    startYear, config.startMonth, config.preEntryWeekNumber, config.preEntryDayOfWeek,
  );
  const officialStartDate = new Date(preEntryDate);
  officialStartDate.setUTCDate(preEntryDate.getUTCDate() + config.entryWeekOffset * 7);
  const startDate = new Date(officialStartDate);
  const endDate = getLastDayOfWeekOfMonth(
    startYear + 1, config.endMonth, config.endDayOfWeek,
  );
  return { preEntryDate, officialStartDate, startDate, endDate };
}

const fmt = (d) => d.toISOString().slice(0, 10);
const dayName = (d) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];

console.log('Year      | Pre-rentrée     | Rentrée         | Fin année       | Sept 1st');
console.log('----------|-----------------|-----------------|-----------------|---------');
for (let y = 2024; y <= 2030; y++) {
  const d = calculateYearDates(y);
  const sept1 = new Date(Date.UTC(y, 8, 1));
  console.log(
    `${y}-${y+1} | ${fmt(d.preEntryDate)} ${dayName(d.preEntryDate)} | ${fmt(d.officialStartDate)} ${dayName(d.officialStartDate)} | ${fmt(d.endDate)} ${dayName(d.endDate)} | ${dayName(sept1)}`,
  );
}
