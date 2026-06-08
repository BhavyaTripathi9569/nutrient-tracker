'use strict';

const express = require('express');
const path    = require('path');

const { searchFoods }                       = require('./src/foodService');
const { getDay, addEntry, removeEntry,
        getGoals, setGoals }                = require('./src/logService');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ── FR-1  Search the food database ─────────────────────── */
app.get('/api/foods', (req, res) => {
  const q = (req.query.q ?? '').trim();
  if (!q) return res.json([]);
  res.json(searchFoods(q));
});

/* ── FR-3  Get a day's data ──────────────────────────────── */
app.get('/api/day', (req, res) => {
  const date = req.query.date ?? new Date().toISOString().slice(0, 10);
  try {
    res.json(getDay(date));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── FR-2  Log a portion ─────────────────────────────────── */
app.post('/api/entries', (req, res) => {
  const { date, foodId, grams } = req.body ?? {};
  try {
    res.status(201).json(addEntry(date, foodId, grams));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── FR-5  Remove an entry ───────────────────────────────── */
app.delete('/api/entries/:id', (req, res) => {
  try {
    removeEntry(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

/* ── FR-4  Goals ─────────────────────────────────────────── */
app.get('/api/goals', (_req, res) => res.json(getGoals()));

app.put('/api/goals', (req, res) => {
  try {
    res.json(setGoals(req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`NutriTrack running at http://localhost:${PORT}`)
);
