'use strict';

/**
 * server.js
 * ---------
 * The NutriTrack back-end. An Express server that:
 *   1. Serves the static front-end from /public.
 *   2. Exposes a small JSON REST API the front-end talks to.
 *
 * Endpoints
 *   GET    /api/foods?q=<query>        -> search the food database
 *   GET    /api/day?date=<ISO date>    -> a day's entries, totals & progress
 *   POST   /api/entries                -> add a food portion to a day
 *   DELETE /api/entries/:id            -> remove a log entry
 *   GET    /api/goals                  -> current daily goals
 *   PUT    /api/goals                  -> update daily goals
 *
 * The front-end's two dynamic, back-end-backed features are:
 *   (a) live food search   -> GET /api/foods
 *   (b) logging a portion  -> POST /api/entries  (dashboard updates from the response)
 */

const path = require('path');
const express = require('express');

const foodService = require('./src/foodService');
const logService = require('./src/logService');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request bodies.
app.use(express.json());

// Serve the front-end (index.html, styles.css, app.js).
app.use(express.static(path.join(__dirname, 'public')));

// Today's date as an ISO "YYYY-MM-DD" string (used as a default).
function today() {
  return new Date().toISOString().slice(0, 10);
}

// --- Food search -----------------------------------------------------------
app.get('/api/foods', (req, res) => {
  const results = foodService.searchFoods(req.query.q);
  res.json(results);
});

// --- Daily log -------------------------------------------------------------
app.get('/api/day', (req, res) => {
  const date = req.query.date || today();
  res.json(logService.getDay(date));
});

// 7-day calorie trend ending on the given date (for the weekly chart).
app.get('/api/week', (req, res) => {
  const end = req.query.end || today();
  res.json(logService.getWeek(end));
});

app.post('/api/entries', (req, res) => {
  try {
    const { date, foodId, grams } = req.body || {};
    const day = logService.addEntry(date || today(), foodId, grams);
    res.status(201).json(day);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/entries/:id', (req, res) => {
  try {
    const day = logService.removeEntry(req.params.id);
    res.json(day);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Goals -----------------------------------------------------------------
app.get('/api/goals', (req, res) => {
  res.json(logService.getGoals());
});

app.put('/api/goals', (req, res) => {
  const goals = logService.setGoals(req.body || {});
  res.json(goals);
});

// Only start listening when run directly (so tests can import the app instead).
if (require.main === module) {
  app.listen(PORT, () => {
    /* eslint-disable no-console */
    console.log(`NutriTrack running at http://localhost:${PORT}`);
  });
}

module.exports = app;
