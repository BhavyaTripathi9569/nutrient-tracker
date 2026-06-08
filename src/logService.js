'use strict';

const { read, write }                   = require('./store');
const { getFoodById, nutritionForPortion } = require('./foodService');

function _uid() {
  return 'e_' + Math.random().toString(36).slice(2, 8);
}

function _validateDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error('Invalid date; expected YYYY-MM-DD');
}

/* ── Public API ──────────────────────────────────────────── */

function getDay(date) {
  _validateDate(date);
  const store   = read();
  const entries = store.entries.filter(e => e.date === date);
  const goals   = store.goals;
  const totals  = sumTotals(entries);
  const progress = {
    kcal:    cap(totals.kcal    / goals.kcal),
    protein: cap(totals.protein / goals.protein),
    carbs:   cap(totals.carbs   / goals.carbs),
    fat:     cap(totals.fat     / goals.fat),
  };
  return { date, entries, totals, goals, progress };
}

function addEntry(date, foodId, grams) {
  _validateDate(date);

  const g = Number(grams);
  if (!isFinite(g) || g <= 0) throw new Error('Grams must be a positive number');

  const food = getFoodById(foodId);
  if (!food) throw new Error(`Food '${foodId}' not found`);

  const nutrition = nutritionForPortion(foodId, g);
  const entry = {
    id:       _uid(),
    date,
    foodId,
    foodName: food.name,
    grams:    g,
    ...nutrition,
  };

  const store = read();
  store.entries.push(entry);
  write(store);
  return entry;
}

function removeEntry(id) {
  const store = read();
  const idx   = store.entries.findIndex(e => e.id === id);
  if (idx === -1) throw new Error(`Entry '${id}' not found`);
  store.entries.splice(idx, 1);
  write(store);
}

function getGoals() {
  return read().goals;
}

function setGoals(raw) {
  const { kcal, protein, carbs, fat } = raw ?? {};
  for (const [k, v] of Object.entries({ kcal, protein, carbs, fat })) {
    const n = Number(v);
    if (!isFinite(n) || n <= 0)
      throw new Error(`Goal '${k}' must be a positive number`);
  }
  const store = read();
  store.goals = {
    kcal:    Number(kcal),
    protein: Number(protein),
    carbs:   Number(carbs),
    fat:     Number(fat),
  };
  write(store);
  return store.goals;
}

/* ── Helpers ─────────────────────────────────────────────── */

function sumTotals(entries) {
  return entries.reduce(
    (acc, e) => ({
      kcal:    round1(acc.kcal    + e.kcal),
      protein: round1(acc.protein + e.protein),
      carbs:   round1(acc.carbs   + e.carbs),
      fat:     round1(acc.fat     + e.fat),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function round1(v) { return Math.round(v * 10) / 10; }
function cap(ratio) { return Math.min(100, Math.round(ratio * 100)); }

module.exports = { getDay, addEntry, removeEntry, getGoals, setGoals, sumTotals };
