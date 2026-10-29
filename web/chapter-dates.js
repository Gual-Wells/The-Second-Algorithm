// Calendar metadata never replaces chapter/document/revision identity.
export function isChapterDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function shanghaiDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatChapterDate(value) {
  if (!isChapterDate(value)) return '日期未登记';
  const [year, month, day] = value.split('-').map(Number);
  return `${year} 年 ${month} 月 ${day} 日`;
}

export function shiftMonth(value, offset) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw Error('Invalid calendar month');
  const date = new Date(value + '-01T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function weekDates(anchor) {
  if (!isChapterDate(anchor)) throw Error('Invalid calendar date');
  const date = new Date(anchor + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => {
    const item = new Date(date); item.setUTCDate(item.getUTCDate() + index);
    return item.toISOString().slice(0, 10);
  });
}

export function orderedChapters(collections, descending = false) {
  const rows = (collections || []).filter(row => row.kind === 'chapter' && row.visibility !== 'hidden');
  return rows.sort((a, b) => {
    const ad = isChapterDate(a.date) ? a.date : null, bd = isChapterDate(b.date) ? b.date : null;
    if (!ad || !bd) return ad ? -1 : bd ? 1 : (a.chapterNumber || 0) - (b.chapterNumber || 0) || a.id.localeCompare(b.id);
    const order = ad.localeCompare(bd) || (a.chapterNumber || 0) - (b.chapterNumber || 0) || a.id.localeCompare(b.id);
    return descending ? -order : order;
  });
}

export function chaptersByDate(collections) {
  const days = new Map();
  for (const chapter of orderedChapters(collections)) {
    if (!isChapterDate(chapter.date)) continue;
    if (!days.has(chapter.date)) days.set(chapter.date, []);
    days.get(chapter.date).push(chapter);
  }
  return days;
}
