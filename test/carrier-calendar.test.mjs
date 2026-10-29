import test from 'node:test';
import assert from 'node:assert/strict';
import {isChapterDate, shanghaiDate, formatChapterDate, shiftMonth, weekDates, orderedChapters, chaptersByDate} from '../web/chapter-dates.js';
import {validatePublications, validateChapterCalendar, publicationIndex} from '../scripts/build-carrier.mjs';

test('calendar dates are actual Gregorian dates, not normalized overflow', () => {
  for (const value of ['2024-02-29', '2026-10-28']) assert.equal(isChapterDate(value), true);
  for (const value of ['0000-01-01', '2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', null]) assert.equal(isChapterDate(value), false);
  assert.equal(formatChapterDate(null), '日期未登记');
});
test('chapter day uses Beijing rather than the host timezone', () => {
  assert.equal(shanghaiDate(new Date('2026-10-28T15:59:59Z')), '2026-10-28');
  assert.equal(shanghaiDate(new Date('2026-10-28T16:00:00Z')), '2026-10-29');
});
test('month and Monday-first week navigation survive year and leap boundaries', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.deepEqual(weekDates('2024-03-01'), ['2024-02-26','2024-02-27','2024-02-28','2024-02-29','2024-03-01','2024-03-02','2024-03-03']);
});
test('multiple chapters on one day retain every immutable chapter identity', () => {
  const rows = [{id:'two',kind:'chapter',chapterNumber:2,date:'2026-10-28'}, {id:'one',kind:'chapter',chapterNumber:1,date:'2026-10-28'},
    {id:'old',kind:'chapter',chapterNumber:3}, {id:'hidden',kind:'chapter',date:'2026-10-28',visibility:'hidden'}];
  assert.deepEqual(chaptersByDate(rows).get('2026-10-28').map(row => row.id), ['one','two']);
  assert.deepEqual(orderedChapters(rows,true).map(row => row.id), ['two','one','old']);
  assert.equal(rows[0].id, 'two', 'source registry is not sorted in place');
});
test('formal calendar requires dates while accepting same-day publication', () => {
  const row = n => ({id:'chapter-'+n,kind:'chapter',title:'Chapter',chapterNumber:n,documents:[{id:'doc-'+n,title:'Chapter',path:'content/chapter'+n+'/chapter'}]});
  const registry = {schemaVersion:2,collections:[row(1),row(2)]};
  assert.equal(validatePublications(registry), registry);
  const calendar = {schemaVersion:1,timeZone:'Asia/Shanghai',chapters:{'chapter-1':{date:'2026-10-28'},'chapter-2':{date:'2026-10-28'}}};
  assert.equal(validateChapterCalendar(calendar, registry), calendar);
  delete calendar.chapters['chapter-2'];
  assert.throws(() => validateChapterCalendar(calendar, registry), /missing its calendar date/);
  assert.equal(validateChapterCalendar(null, registry), null, 'old registry format remains readable without invented dates');
});
test('release publication index carries dates without rewriting document revisions', () => {
  const catalog = {version:'calendar-release',collections:[{id:'chapter',date:'2026-10-28',documents:[{id:'doc',revision:'original-content'}]}],questions:[]};
  const index = publicationIndex(catalog);
  assert.equal(index.chapters.chapter.date, '2026-10-28');
  assert.equal(index.collections.chapter.doc, 'original-content');
});
