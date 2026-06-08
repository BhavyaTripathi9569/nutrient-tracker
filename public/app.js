'use strict';

/* ===================================================================
   NutriTrack — app.js
   Front-end logic. Talks to the back-end over fetch(); the back-end
   owns the food database and all nutrition maths. The two dynamic,
   server-backed features are:
     1. Live food search   -> GET  /api/foods?q=
     2. Logging a portion  -> POST /api/entries (dashboard re-renders
        from the day payload the server returns)
   =================================================================== */

// ---- Small helpers --------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const api = async (url, options) => {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
};

/** Format an ISO date as a friendly label ("Today", "Yesterday", or a date). */
function friendlyDate(iso) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const d = new Date(iso + 'T00:00:00');
  const t = new Date(todayIso + 'T00:00:00');
  const diffDays = Math.round((d - t) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Briefly show a toast message. */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2200);
}

// ---- Application state ----------------------------------------------------
const state = {
  date: new Date().toISOString().slice(0, 10),
  selectedFood: null, // food currently being portioned in the modal
};

// =================== DASHBOARD RENDERING ===================
const RING_CIRCUMFERENCE = 326.7; // 2 * PI * 52

/** Paint the dashboard (calorie ring, macro bars, goal inputs) from a day payload. */
function renderDashboard(day) {
  const { totals, goals, progress, remaining } = day;

  // Calorie ring
  $('#kcalConsumed').textContent = Math.round(totals.kcal);
  $('#kcalGoal').textContent = goals.kcal;
  const offset = RING_CIRCUMFERENCE * (1 - progress.kcal / 100);
  const ring = $('#calorieRing');
  ring.style.strokeDashoffset = offset;
  // Turn the ring amber→red as the user approaches/exceeds the goal.
  ring.style.stroke =
    totals.kcal > goals.kcal ? 'var(--fat)' : progress.kcal >= 90 ? 'var(--citrus)' : 'var(--forest)';

  const rem = remaining.kcal;
  $('#kcalRemaining').textContent =
    rem >= 0 ? `${Math.round(rem)} left` : `${Math.round(-rem)} over`;

  // Explicit goal-completion percentage (uncapped, so "over" days read >100%)
  const pct = goals.kcal > 0 ? Math.round((totals.kcal / goals.kcal) * 100) : 0;
  $('#goalPct').textContent = `${pct}%`;

  // Macro bars
  const macros = ['protein', 'carbs', 'fat'];
  for (const m of macros) {
    $(`#${m}Val`).textContent = Math.round(totals[m]);
    $(`#${m}Goal`).textContent = goals[m];
    $(`#${m}Bar`).style.width = `${progress[m]}%`;
  }

  // Goal inputs (kept in sync so the editor shows current values)
  $('#goalKcal').value = goals.kcal;
  $('#goalProtein').value = goals.protein;
  $('#goalCarbs').value = goals.carbs;
  $('#goalFat').value = goals.fat;
}

/** Render the list of logged entries for the day. */
function renderEntries(entries) {
  const list = $('#entries');
  const empty = $('#emptyState');
  list.innerHTML = '';
  empty.hidden = entries.length > 0;

  for (const e of entries) {
    const li = document.createElement('li');
    li.className = 'entry';
    li.innerHTML = `
      <div class="entry__info">
        <span class="entry__name">${escapeHtml(e.name)}</span>
        <span class="entry__detail">${e.grams} g · P ${e.protein} · C ${e.carbs} · F ${e.fat}</span>
      </div>
      <div class="entry__right">
        <span class="entry__kcal">${Math.round(e.kcal)} kcal</span>
        <button class="entry__del" title="Remove" aria-label="Remove ${escapeHtml(e.name)}">&times;</button>
      </div>`;
    li.querySelector('.entry__del').addEventListener('click', () => removeEntry(e.id));
    list.appendChild(li);
  }
}

/** Escape user-facing strings to avoid accidental HTML injection. */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// =================== WEEKLY TREND CHART ===================
/** Draw the last-7-days calorie bars (with a dashed goal line) into the SVG. */
function renderWeek(week) {
  const svg = $('#weekChart');
  const W = 320, H = 150, padX = 16, padTop = 16, padBottom = 22;
  const chartW = W - padX * 2;
  const chartH = H - padTop - padBottom;
  const slot = chartW / week.days.length;
  const barW = slot * 0.5;

  // Scale to whichever is taller: the goal line or the busiest day.
  const maxVal = Math.max(week.goal, ...week.days.map((d) => d.kcal), 1);
  const y = (v) => padTop + chartH * (1 - v / maxVal);

  let svgInner = '';

  // Goal reference line
  const gy = y(week.goal).toFixed(1);
  svgInner += `<line class="trend__goal-line" x1="${padX}" y1="${gy}" x2="${W - padX}" y2="${gy}" />`;
  svgInner += `<text class="trend__label" x="${W - padX}" y="${(gy - 3)}" text-anchor="end">goal ${week.goal}</text>`;

  // Bars
  week.days.forEach((d, i) => {
    const cx = padX + slot * i + slot / 2;
    const bx = (cx - barW / 2).toFixed(1);
    const by = y(d.kcal);
    const bh = Math.max(0, padTop + chartH - by).toFixed(1);
    const over = d.kcal > week.goal ? ' trend__bar--over' : '';
    svgInner += `<rect class="trend__bar${over}" x="${bx}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh}" rx="3" />`;
    if (d.kcal > 0) {
      svgInner += `<text class="trend__val" x="${cx.toFixed(1)}" y="${(by - 4).toFixed(1)}" text-anchor="middle">${Math.round(d.kcal)}</text>`;
    }
    svgInner += `<text class="trend__label" x="${cx.toFixed(1)}" y="${H - 7}" text-anchor="middle">${d.weekday}</text>`;
  });

  svg.innerHTML = svgInner;
}

async function loadWeek() {
  try {
    const week = await api(`/api/week?end=${state.date}`);
    renderWeek(week);
  } catch (err) {
    /* the chart is non-critical; ignore transient errors */
  }
}

// =================== DATA LOADING ===================
async function loadDay() {
  $('#dateLabel').textContent = friendlyDate(state.date);
  $('#datePicker').value = state.date;
  try {
    const day = await api(`/api/day?date=${state.date}`);
    renderDashboard(day);
    renderEntries(day.entries);
    loadWeek();
  } catch (err) {
    toast(err.message);
  }
}

// =================== DYNAMIC FEATURE 1: SEARCH ===================
let searchTimer;
async function runSearch(query) {
  try {
    const results = await api(`/api/foods?q=${encodeURIComponent(query)}`);
    renderResults(results);
  } catch (err) {
    toast(err.message);
  }
}

function renderResults(results) {
  const list = $('#results');
  list.innerHTML = '';
  for (const f of results) {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.innerHTML = `
      <div>
        <span class="results__name">${escapeHtml(f.name)}</span>
        <span class="results__cat">${escapeHtml(f.category)}</span>
        <div class="results__meta">${f.per100g.kcal} kcal · ${f.per100g.protein}g P / ${f.per100g.carbs}g C / ${f.per100g.fat}g F per 100g</div>
      </div>
      <span aria-hidden="true">＋</span>`;
    li.addEventListener('click', () => openPortionModal(f));
    list.appendChild(li);
  }
}

// =================== PORTION MODAL ===================
function openPortionModal(food) {
  state.selectedFood = food;
  $('#modalFood').textContent = food.name;
  $('#portionInput').value = 100;
  updatePortionPreview();
  $('#portionModal').hidden = false;
  $('#portionInput').focus();
}

function closePortionModal() {
  $('#portionModal').hidden = true;
  state.selectedFood = null;
}

/** Live preview of the portion's macros (client-side mirror of the server maths). */
function updatePortionPreview() {
  const food = state.selectedFood;
  if (!food) return;
  const grams = Number($('#portionInput').value) || 0;
  const factor = grams / 100;
  const r1 = (n) => Math.round(n * 10) / 10;
  const cells = [
    ['kcal', Math.round(food.per100g.kcal * factor)],
    ['protein', r1(food.per100g.protein * factor)],
    ['carbs', r1(food.per100g.carbs * factor)],
    ['fat', r1(food.per100g.fat * factor)],
  ];
  $('#modalPreview').innerHTML = cells
    .map(([label, val]) => `<div class="prev-cell"><b>${val}</b><span>${label}</span></div>`)
    .join('');
}

// =================== DYNAMIC FEATURE 2: LOG A PORTION ===================
async function confirmPortion() {
  const food = state.selectedFood;
  const grams = Number($('#portionInput').value);
  if (!food || !(grams > 0)) {
    toast('Enter a portion greater than 0');
    return;
  }
  try {
    // The server stores the entry and returns the recomputed day; we render that.
    const day = await api('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: state.date, foodId: food.id, grams }),
    });
    renderDashboard(day);
    renderEntries(day.entries);
    closePortionModal();
    loadWeek();
    toast(`Added ${food.name}`);
  } catch (err) {
    toast(err.message);
  }
}

async function removeEntry(id) {
  try {
    const day = await api(`/api/entries/${id}`, { method: 'DELETE' });
    renderDashboard(day);
    renderEntries(day.entries);
    loadWeek();
    toast('Removed');
  } catch (err) {
    toast(err.message);
  }
}

// =================== GOALS ===================
async function saveGoals() {
  const patch = {
    kcal: Number($('#goalKcal').value),
    protein: Number($('#goalProtein').value),
    carbs: Number($('#goalCarbs').value),
    fat: Number($('#goalFat').value),
  };
  try {
    await api('/api/goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await loadDay();
    toast('Goals saved');
  } catch (err) {
    toast(err.message);
  }
}

// =================== DATE NAVIGATION ===================
function shiftDate(days) {
  const d = new Date(state.date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  state.date = d.toISOString().slice(0, 10);
  loadDay();
}

// =================== THEME (light / dark) ===================
const MOON = '\u263E'; // ☾  shown in light mode (tap for dark)
const SUN = '\u2600';  // ☀  shown in dark mode (tap for light)

/** Apply a theme and update the toggle button's icon + label. */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = $('#themeToggle');
  const dark = theme === 'dark';
  btn.textContent = dark ? SUN : MOON;
  btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

/** Load the saved theme (defaults to light) on startup. */
function initTheme() {
  let theme = 'light';
  try {
    theme = localStorage.getItem('nutritrack-theme') || 'light';
  } catch (_) { /* storage unavailable; stay light */ }
  applyTheme(theme);
}

/** Flip the theme and remember the choice. */
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem('nutritrack-theme', next);
  } catch (_) { /* ignore if storage is blocked */ }
}

// =================== WIRING ===================
function init() {
  initTheme();
  $('#themeToggle').addEventListener('click', toggleTheme);
  // Search (debounced)
  $('#searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(e.target.value), 180);
  });

  // Modal
  $('#portionInput').addEventListener('input', updatePortionPreview);
  $('#confirmPortion').addEventListener('click', confirmPortion);
  $('#cancelPortion').addEventListener('click', closePortionModal);
  $('#portionModal').addEventListener('click', (e) => {
    if (e.target.id === 'portionModal') closePortionModal();
  });

  // Goals
  $('#saveGoals').addEventListener('click', saveGoals);

  // Date navigation
  $('#prevDay').addEventListener('click', () => shiftDate(-1));
  $('#nextDay').addEventListener('click', () => shiftDate(1));
  $('#datePicker').addEventListener('change', (e) => {
    if (e.target.value) {
      state.date = e.target.value;
      loadDay();
    }
  });

  // Initial load: show suggestions + today's data
  runSearch('');
  loadDay();
}

document.addEventListener('DOMContentLoaded', init);
