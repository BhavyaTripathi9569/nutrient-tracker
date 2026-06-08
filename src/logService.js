'use strict';

/**
 * logService.js
 * -------------
 * Business logic for the daily food log: adding entries, removing them,
 * fetching a single day, and computing daily totals + progress against goals.
 *
 * It depends on `store` for persistence and `foodService` for nutrition maths,
 * keeping HTTP concerns out of this layer so it can be unit-tested directly.
 */

const crypto = require('crypto');
const store = require('./store');
const foodService = require('./foodService');

/**
 * Sum the macros of a list of log entries.
 * @param {object[]} entries
 * @returns {{kcal:number, protein:number, carbs:number, fat:number}}
 */
function sumEntries(entries) {
  return entries.reduce(
    (acc, e) => ({
      kcal: foodService.round1(acc.kcal + e.kcal),
      protein: foodService.round1(acc.protein + e.protein),
      carbs: foodService.round1(acc.carbs + e.carbs),
      fat: foodService.round1(acc.fat + e.fat),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

/**
 * Build the full payload for one day: its entries, totals, the active goals,
 * and the percentage of each goal consumed (capped at 100 for the progress bar,
 * but the raw remaining value is also returned).
 * @param {string} date  ISO date string, e.g. "2026-06-01"
 * @returns {object}
 */
function getDay(date) {
  const data = store.read();
  const entries = data.entries.filter((e) => e.date === date);
  const totals = sumEntries(entries);
  const goals = data.goals;

  const percent = (consumed, goal) =>
    goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;

  return {
    date,
    goals,
    totals,
    progress: {
      kcal: percent(totals.kcal, goals.kcal),
      protein: percent(totals.protein, goals.protein),
      carbs: percent(totals.carbs, goals.carbs),
      fat: percent(totals.fat, goals.fat),
    },
    remaining: {
      kcal: foodService.round1(goals.kcal - totals.kcal),
      protein: foodService.round1(goals.protein - totals.protein),
      carbs: foodService.round1(goals.carbs - totals.carbs),
      fat: foodService.round1(goals.fat - totals.fat),
    },
    entries,
  };
}

// Fixed weekday labels so the result doesn't depend on the server's locale.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Build a 7-day calorie trend ending on `endDate` (inclusive).
 * Each item carries that day's total calories so the front-end can draw a
 * weekly chart; the current calorie goal is returned alongside as a reference line.
 * @param {string} endDate  ISO date string, e.g. "2026-06-01"
 * @returns {{goal:number, days:{date:string, kcal:number, weekday:string}[]}}
 */
function getWeek(endDate) {
  const data = store.read();
  const goal = data.goals.kcal;
  const end = new Date(endDate + 'T00:00:00');
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const kcal = sumEntries(data.entries.filter((e) => e.date === iso)).kcal;
    days.push({ date: iso, kcal, weekday: WEEKDAYS[d.getDay()] });
  }

  return { goal, days };
}

/**
 * Add a food portion to a given day's log.
 * Validates the food id and portion size before writing.
 * @param {string} date
 * @param {string} foodId
 * @param {number} grams
 * @returns {object} the updated day payload (see getDay)
 * @throws {Error} with a `.status` property for the HTTP layer to read
 */
function addEntry(date, foodId, grams) {
  const food = foodService.getFoodById(foodId);
  if (!food) {
    const err = new Error('Unknown food id');
    err.status = 400;
    throw err;
  }
  const g = Number(grams);
  if (!Number.isFinite(g) || g <= 0) {
    const err = new Error('Portion size must be a positive number of grams');
    err.status = 400;
    throw err;
  }

  const macros = foodService.nutritionForPortion(food, g);
  const entry = {
    id: crypto.randomUUID(),
    date,
    foodId: food.id,
    name: food.name,
    grams: g,
    ...macros,
  };

  const data = store.read();
  data.entries.push(entry);
  store.write(data);

  return getDay(date);
}

/**
 * Remove a single log entry by id.
 * @param {string} entryId
 * @returns {object} the updated day payload for the removed entry's date
 * @throws {Error} 404 if the entry does not exist
 */
function removeEntry(entryId) {
  const data = store.read();
  const entry = data.entries.find((e) => e.id === entryId);
  if (!entry) {
    const err = new Error('Entry not found');
    err.status = 404;
    throw err;
  }
  data.entries = data.entries.filter((e) => e.id !== entryId);
  store.write(data);
  return getDay(entry.date);
}

/**
 * Read the current daily goals.
 * @returns {{kcal:number, protein:number, carbs:number, fat:number}}
 */
function getGoals() {
  return store.read().goals;
}

/**
 * Update daily goals. Only known, positive numeric fields are accepted.
 * @param {object} patch  partial goals object
 * @returns {object} the saved goals
 */
function setGoals(patch) {
  const data = store.read();
  const next = { ...data.goals };
  for (const key of ['kcal', 'protein', 'carbs', 'fat']) {
    if (patch[key] !== undefined) {
      const v = Number(patch[key]);
      if (Number.isFinite(v) && v >= 0) next[key] = v;
    }
  }
  data.goals = next;
  store.write(data);
  return next;
}

module.exports = {
  sumEntries,
  getDay,
  getWeek,
  addEntry,
  removeEntry,
  getGoals,
  setGoals,
};
