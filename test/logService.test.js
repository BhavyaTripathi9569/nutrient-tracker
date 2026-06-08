'use strict';

/**
 * logService.test.js
 * Integration tests for the daily-log logic. Each run uses a throwaway
 * store file (set via NUTRITRACK_STORE) so tests never touch real data.
 *
 * Run with: npm test
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Point the store at a temp file BEFORE requiring the modules that read it.
const tmpStore = path.join(os.tmpdir(), `nutritrack-test-${process.pid}.json`);
process.env.NUTRITRACK_STORE = tmpStore;

const logService = require('../src/logService');

const DATE = '2026-06-01';

test.beforeEach(() => {
  // Reset to a clean store before each test.
  fs.writeFileSync(
    tmpStore,
    JSON.stringify({ goals: { kcal: 2000, protein: 120, carbs: 250, fat: 65 }, entries: [] })
  );
});

test.after(() => {
  if (fs.existsSync(tmpStore)) fs.unlinkSync(tmpStore);
});

test('getWeek returns 7 consecutive days ending on the given date', () => {
  const week = logService.getWeek(DATE);
  assert.strictEqual(week.days.length, 7);
  assert.strictEqual(week.days[6].date, DATE); // last day is the end date
  assert.strictEqual(week.days[0].date, '2026-05-26'); // six days earlier
  assert.strictEqual(week.goal, 2000);
});

test('getWeek sums calories onto the correct day only', () => {
  logService.addEntry(DATE, 'f001', 200); // 200g chicken -> 330 kcal on the end date
  const week = logService.getWeek(DATE);
  assert.strictEqual(Math.round(week.days[6].kcal), 330); // today has the calories
  assert.strictEqual(week.days[5].kcal, 0); // yesterday stays empty
});

test('a fresh day has zero totals and full remaining', () => {
  const day = logService.getDay(DATE);
  assert.strictEqual(day.totals.kcal, 0);
  assert.strictEqual(day.remaining.kcal, 2000);
  assert.strictEqual(day.entries.length, 0);
});

test('addEntry stores a portion and updates totals & progress', () => {
  const day = logService.addEntry(DATE, 'f001', 200); // 200g chicken = 330 kcal, 62g protein
  assert.strictEqual(day.totals.kcal, 330);
  assert.strictEqual(day.totals.protein, 62);
  assert.strictEqual(day.entries.length, 1);
  assert.strictEqual(day.remaining.kcal, 1670);
  // 330 / 2000 = 16.5% -> rounds to 17
  assert.strictEqual(day.progress.kcal, 17);
});

test('addEntry rejects an unknown food', () => {
  assert.throws(() => logService.addEntry(DATE, 'nope', 100), /Unknown food/);
});

test('addEntry rejects a non-positive portion', () => {
  assert.throws(() => logService.addEntry(DATE, 'f001', 0), /positive/);
  assert.throws(() => logService.addEntry(DATE, 'f001', -50), /positive/);
});

test('progress is capped at 100% even when goals are exceeded', () => {
  logService.setGoals({ kcal: 100 });
  const day = logService.addEntry(DATE, 'f001', 200); // 330 kcal vs 100 goal
  assert.strictEqual(day.progress.kcal, 100);
  assert.ok(day.remaining.kcal < 0, 'remaining should go negative when over goal');
});

test('removeEntry deletes the entry and recomputes totals', () => {
  let day = logService.addEntry(DATE, 'f001', 200);
  const entryId = day.entries[0].id;
  day = logService.removeEntry(entryId);
  assert.strictEqual(day.entries.length, 0);
  assert.strictEqual(day.totals.kcal, 0);
});

test('removeEntry throws 404 for a missing entry', () => {
  assert.throws(() => logService.removeEntry('missing-id'), /not found/);
});

test('entries are isolated per day', () => {
  logService.addEntry('2026-06-01', 'f001', 100);
  const otherDay = logService.getDay('2026-06-02');
  assert.strictEqual(otherDay.entries.length, 0);
});

test('setGoals only accepts valid positive numbers', () => {
  const goals = logService.setGoals({ kcal: 2500, protein: -10, fat: 'abc' });
  assert.strictEqual(goals.kcal, 2500); // accepted
  assert.strictEqual(goals.protein, 120); // rejected (negative) -> unchanged
  assert.strictEqual(goals.fat, 65); // rejected (NaN) -> unchanged
});
