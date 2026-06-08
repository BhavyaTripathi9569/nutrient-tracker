'use strict';

/* ═══════════════════════════════════════════════════════════
   NutriTrack — front-end SPA
   ═══════════════════════════════════════════════════════════ */

/* ── State ───────────────────────────────────────────────── */
let currentDate      = todayISO();
let selectedFood     = null;
let searchResultsData = [];
let toastTimer       = null;

/* ── DOM refs ────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const prevDayBtn     = $('prev-day');
const nextDayBtn     = $('next-day');
const todayBtn       = $('today-btn');
const dateDisplay    = $('date-display');

const ringFill       = $('ring-fill');
const ringConsumed   = $('ring-consumed');
const ringGoalLabel  = $('ring-goal-label');

const proteinBar     = $('protein-bar');
const carbsBar       = $('carbs-bar');
const fatBar         = $('fat-bar');
const proteinVal     = $('protein-val');
const carbsVal       = $('carbs-val');
const fatVal         = $('fat-val');

const goalsForm      = $('goals-form');
const goalKcal       = $('goal-kcal');
const goalProtein    = $('goal-protein');
const goalCarbs      = $('goal-carbs');
const goalFat        = $('goal-fat');

const searchInput    = $('search-input');
const clearSearchBtn = $('clear-search');
const searchResults  = $('search-results');

const entriesList    = $('entries-list');

const modalOverlay   = $('modal-overlay');
const modalTitle     = $('modal-title');
const modalCategory  = $('modal-category');
const modalGrams     = $('modal-grams');
const modalPreview   = $('modal-preview');
const modalConfirm   = $('modal-confirm');
const modalCancel    = $('modal-cancel');
const modalClose     = $('modal-close');

const toastEl        = $('toast');

const CIRCUMFERENCE = 2 * Math.PI * 80; // ≈ 502.65

/* ── Utilities ───────────────────────────────────────────── */

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(iso, days) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso) {
  const today     = todayISO();
  const yesterday = offsetDate(today, -1);
  if (iso === today)     return 'Today';
  if (iso === yesterday) return 'Yesterday';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ── API layer ───────────────────────────────────────────── */

async function apiFetch(url, opts = {}) {
  const res  = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ── Data loading ────────────────────────────────────────── */

async function loadDay(date) {
  try {
    const day = await apiFetch(`/api/day?date=${encodeURIComponent(date)}`);
    renderDashboard(day);
    renderEntries(day.entries);
    populateGoalsForm(day.goals);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Dashboard rendering ─────────────────────────────────── */

function renderDashboard({ totals, goals }) {
  updateRing(totals.kcal, goals.kcal);
  ringConsumed.textContent  = Math.round(totals.kcal);
  ringGoalLabel.textContent = `of ${goals.kcal}`;

  updateMacroBar(proteinBar, proteinVal, totals.protein, goals.protein);
  updateMacroBar(carbsBar,   carbsVal,   totals.carbs,   goals.carbs);
  updateMacroBar(fatBar,     fatVal,     totals.fat,     goals.fat);
}

function updateRing(consumed, goal) {
  const ratio  = Math.min(consumed / goal, 1);
  const offset = CIRCUMFERENCE * (1 - ratio);
  ringFill.style.strokeDashoffset = offset;

  if (ratio >= 1)    ringFill.style.stroke = '#DC2626';
  else if (ratio >= 0.85) ringFill.style.stroke = '#D97706';
  else               ringFill.style.stroke = 'url(#ringGrad)';
}

function updateMacroBar(barEl, valEl, consumed, goal) {
  const pct = Math.min((consumed / goal) * 100, 100);
  barEl.style.width = pct + '%';
  valEl.textContent = `${consumed}g / ${goal}g`;
  barEl.classList.toggle('exceeded', consumed > goal);
}

function populateGoalsForm({ kcal, protein, carbs, fat }) {
  goalKcal.value    = kcal;
  goalProtein.value = protein;
  goalCarbs.value   = carbs;
  goalFat.value     = fat;
}

/* ── Entries rendering ───────────────────────────────────── */

function renderEntries(entries) {
  if (!entries.length) {
    entriesList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" width="48" height="48" aria-hidden="true">
          <circle cx="24" cy="24" r="22" stroke="#D1FAE5" stroke-width="2"/>
          <path d="M16 24h16M24 16v16" stroke="#6EE7B7" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <p>No entries yet.<br/>Search for a food above to get started.</p>
      </div>`;
    return;
  }

  entriesList.innerHTML = entries.map(e => `
    <div class="entry-card" data-id="${escHtml(e.id)}">
      <div class="entry-info">
        <span class="entry-name">${escHtml(e.foodName)}</span>
        <div class="entry-chips">
          <span class="chip kcal">${Math.round(e.kcal)} kcal</span>
          <span class="chip protein">${e.protein}g P</span>
          <span class="chip carbs">${e.carbs}g C</span>
          <span class="chip fat">${e.fat}g F</span>
        </div>
      </div>
      <span class="entry-grams">${e.grams}g</span>
      <button class="delete-btn" aria-label="Remove ${escHtml(e.foodName)}" data-id="${escHtml(e.id)}">
        <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" aria-hidden="true">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
  `).join('');
}

/* ── Search rendering ────────────────────────────────────── */

function renderSearchResults(foods) {
  searchResultsData = foods;

  if (!foods.length) {
    searchResults.innerHTML = '<p class="search-empty">No foods found — try a different term.</p>';
    searchResults.hidden = false;
    return;
  }

  searchResults.innerHTML = foods.map(f => `
    <li role="option">
      <button class="food-result" data-id="${escHtml(f.id)}">
        <div class="food-result-top">
          <span class="food-result-name">${escHtml(f.name)}</span>
          <span class="category-badge">${escHtml(f.category)}</span>
        </div>
        <div class="food-result-macros">
          <span class="kcal-text">${f.per100g.kcal} kcal</span>
          <span class="prot-text">${f.per100g.protein}g P</span>
          <span class="carbs-text">${f.per100g.carbs}g C</span>
          <span class="fat-text">${f.per100g.fat}g F</span>
          <span class="per100">per 100g</span>
        </div>
      </button>
    </li>
  `).join('');
  searchResults.hidden = false;
}

function clearSearch() {
  searchInput.value     = '';
  clearSearchBtn.hidden = true;
  searchResults.hidden  = true;
  searchResults.innerHTML = '';
  searchResultsData = [];
}

/* ── Modal ───────────────────────────────────────────────── */

function openModal(food) {
  selectedFood = food;
  modalTitle.textContent    = food.name;
  modalCategory.textContent = food.category;
  modalGrams.value          = 100;
  renderModalPreview(food, 100);
  modalOverlay.hidden = false;
  requestAnimationFrame(() => modalGrams.select());
}

function closeModal() {
  modalOverlay.hidden = true;
  selectedFood = null;
}

function renderModalPreview(food, gramsRaw) {
  const g = parseFloat(gramsRaw);
  if (!isFinite(g) || g <= 0) {
    modalPreview.innerHTML = '<p class="preview-hint">Enter a portion size to see the nutrition breakdown.</p>';
    return;
  }
  const s    = g / 100;
  const r    = v => Math.round(v * s * 10) / 10;
  const kcal = r(food.per100g.kcal);
  const prot = r(food.per100g.protein);
  const carbs = r(food.per100g.carbs);
  const fat  = r(food.per100g.fat);

  modalPreview.innerHTML = `
    <div class="preview-grid">
      <div class="preview-card kcal">
        <span class="preview-val">${kcal}</span>
        <span class="preview-label">Calories</span>
      </div>
      <div class="preview-card protein">
        <span class="preview-val">${prot}g</span>
        <span class="preview-label">Protein</span>
      </div>
      <div class="preview-card carbs">
        <span class="preview-val">${carbs}g</span>
        <span class="preview-label">Carbs</span>
      </div>
      <div class="preview-card fat">
        <span class="preview-val">${fat}g</span>
        <span class="preview-label">Fat</span>
      </div>
    </div>`;
}

/* ── Toast ───────────────────────────────────────────────── */

function showToast(msg, type = 'success') {
  toastEl.textContent = msg;
  toastEl.className   = `toast toast--${type}`;
  toastEl.hidden      = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
}

/* ── API actions ─────────────────────────────────────────── */

async function handleAddEntry() {
  if (!selectedFood) return;
  const grams = parseFloat(modalGrams.value);
  if (!isFinite(grams) || grams <= 0) {
    showToast('Please enter a valid portion in grams.', 'error');
    modalGrams.focus();
    return;
  }
  modalConfirm.disabled = true;
  try {
    await apiFetch('/api/entries', {
      method: 'POST',
      body: JSON.stringify({ date: currentDate, foodId: selectedFood.id, grams }),
    });
    const name = selectedFood.name;
    closeModal();
    clearSearch();
    showToast(`Added ${name} (${grams}g)`);
    await loadDay(currentDate);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    modalConfirm.disabled = false;
  }
}

async function deleteEntry(id) {
  try {
    await apiFetch(`/api/entries/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('Entry removed');
    await loadDay(currentDate);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSaveGoals(e) {
  e.preventDefault();
  try {
    await apiFetch('/api/goals', {
      method: 'PUT',
      body: JSON.stringify({
        kcal:    parseFloat(goalKcal.value),
        protein: parseFloat(goalProtein.value),
        carbs:   parseFloat(goalCarbs.value),
        fat:     parseFloat(goalFat.value),
      }),
    });
    showToast('Goals saved!');
    await loadDay(currentDate);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Date navigation ─────────────────────────────────────── */

function updateDateDisplay() {
  dateDisplay.textContent = formatDisplayDate(currentDate);
  nextDayBtn.disabled = currentDate >= todayISO();
}

function navigateDay(delta) {
  currentDate = offsetDate(currentDate, delta);
  updateDateDisplay();
  clearSearch();
  loadDay(currentDate);
}

/* ── Debounced search ────────────────────────────────────── */

const doSearch = debounce(async query => {
  const q = query.trim();
  if (!q) { searchResults.hidden = true; return; }
  try {
    const foods = await apiFetch(`/api/foods?q=${encodeURIComponent(q)}`);
    renderSearchResults(foods);
  } catch (err) {
    showToast(err.message, 'error');
  }
}, 280);

/* ── Event wiring ────────────────────────────────────────── */

// Date nav
prevDayBtn.addEventListener('click', () => navigateDay(-1));
nextDayBtn.addEventListener('click', () => navigateDay(+1));
todayBtn.addEventListener('click', () => {
  currentDate = todayISO();
  updateDateDisplay();
  clearSearch();
  loadDay(currentDate);
});

// Search
searchInput.addEventListener('input', () => {
  clearSearchBtn.hidden = !searchInput.value;
  doSearch(searchInput.value);
});
clearSearchBtn.addEventListener('click', clearSearch);

// Click a search result → open modal
searchResults.addEventListener('click', e => {
  const btn = e.target.closest('.food-result');
  if (!btn) return;
  const food = searchResultsData.find(f => f.id === btn.dataset.id);
  if (food) openModal(food);
});

// Close search when clicking outside
document.addEventListener('click', e => {
  if (!searchResults.hidden &&
      !searchInput.contains(e.target) &&
      !searchResults.contains(e.target)) {
    searchResults.hidden = true;
  }
});

// Delete entry
entriesList.addEventListener('click', e => {
  const btn = e.target.closest('.delete-btn');
  if (btn) deleteEntry(btn.dataset.id);
});

// Goals form
goalsForm.addEventListener('submit', handleSaveGoals);

// Modal
modalGrams.addEventListener('input', () => {
  if (selectedFood) renderModalPreview(selectedFood, modalGrams.value);
});
modalConfirm.addEventListener('click', handleAddEntry);
modalCancel.addEventListener('click',  closeModal);
modalClose.addEventListener('click',   closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
});

// Allow pressing Enter in grams field to confirm
modalGrams.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleAddEntry();
});

/* ── Boot ────────────────────────────────────────────────── */
updateDateDisplay();
loadDay(currentDate);
