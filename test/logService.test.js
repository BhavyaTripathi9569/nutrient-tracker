'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const store      = require('../src/store');
const logService = require('../src/logService');

/* ── Test store isolation ────────────────────────────────── */
const tmpPath = path.join(os.tmpdir(), `nutritrack_test_${Date.now()}.json`);

before(() => {
  store.setStorePath(tmpPath);
});

after(() => {
  store.resetStorePath();
  try { fs.unlinkSync(tmpPath); } catch { /* already gone */ }
});

function freshStore() {
  fs.writeFileSync(tmpPath, JSON.stringify(
    { goals: { kcal: 2000, protein: 120, carbs: 250, fat: 65 }, entries: [] },
    null, 2
  ));
}

/* ── addEntry ────────────────────────────────────────────── */

describe('addEntry', () => {

  it('creates an entry with correctly scaled nutrition', () => {
    freshStore();
    const entry = logService.addEntry('2026-01-01', 'f001', 200);
    // f001 Chicken: 165 kcal per 100g → 200g = 330 kcal
    assert.equal(entry.kcal, 330);
    assert.equal(entry.foodId, 'f001');
    assert.equal(entry.grams, 200);
  });

  it('persists the entry so it appears in getDay', () => {
    freshStore();
    logService.addEntry('2026-01-02', 'f004', 150);
    const day = logService.getDay('2026-01-02');
    assert.equal(day.entries.length, 1);
  });

  it('throws for a non-positive gram value', () => {
    assert.throws(() => logService.addEntry('2026-01-03', 'f001', -10), /positive/i);
  });

  it('throws for zero grams', () => {
    assert.throws(() => logService.addEntry('2026-01-03', 'f001', 0), /positive/i);
  });

  it('throws for an unknown foodId', () => {
    assert.throws(() => logService.addEntry('2026-01-03', 'no_such_food', 100), /not found/i);
  });

});

/* ── removeEntry ─────────────────────────────────────────── */

describe('removeEntry', () => {

  it('removes an existing entry by id', () => {
    freshStore();
    const entry = logService.addEntry('2026-02-01', 'f011', 180);
    logService.removeEntry(entry.id);
    const day = logService.getDay('2026-02-01');
    assert.equal(day.entries.length, 0);
  });

  it('throws when removing a non-existent entry', () => {
    assert.throws(() => logService.removeEntry('e_does_not_exist'), /not found/i);
  });

});

/* ── getDay & sumTotals ──────────────────────────────────── */

describe('getDay / sumTotals', () => {

  it('sums totals correctly for multiple entries', () => {
    freshStore();
    // f001 Chicken: 165 kcal/100g, f004 Tuna: 116 kcal/100g
    logService.addEntry('2026-03-01', 'f001', 100); // 165 kcal
    logService.addEntry('2026-03-01', 'f004', 100); // 116 kcal
    const day = logService.getDay('2026-03-01');
    assert.equal(day.totals.kcal, 281);
    assert.equal(day.entries.length, 2);
  });

  it('returns only entries for the requested date', () => {
    freshStore();
    logService.addEntry('2026-03-02', 'f001', 100);
    logService.addEntry('2026-03-03', 'f001', 100);
    const day = logService.getDay('2026-03-02');
    assert.equal(day.entries.length, 1);
  });

});

/* ── goals ───────────────────────────────────────────────── */

describe('setGoals', () => {

  it('saves and returns updated goals', () => {
    freshStore();
    const goals = logService.setGoals({ kcal: 2500, protein: 150, carbs: 300, fat: 70 });
    assert.equal(goals.kcal, 2500);
    assert.equal(goals.protein, 150);
  });

  it('throws when a goal value is not a positive number', () => {
    assert.throws(
      () => logService.setGoals({ kcal: -100, protein: 150, carbs: 300, fat: 70 }),
      /positive/i
    );
  });

});
