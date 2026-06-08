# NutriTrack

A daily nutrient & macronutrient tracking web application built with Node.js, Express, and vanilla JavaScript.

## Features

- **Food search** — live search across 47 foods (case-insensitive, partial match)
- **Portion logging** — enter grams; server scales per-100g values to your portion
- **Daily dashboard** — animated calorie ring + colour-coded macro progress bars
- **Editable goals** — set your own calorie, protein, carb, and fat targets
- **Date navigation** — browse and log for any past date
- **Delete entries** — remove mistaken logs; totals update instantly
- **Persistent storage** — entries and goals survive server restarts (JSON file, no database)
- **Responsive** — works on desktop and mobile; no horizontal scrolling

## Stack

| Layer    | Technology                    |
|----------|-------------------------------|
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend  | Node.js + Express             |
| Storage  | `data/store.json`             |
| Tests    | Node.js built-in test runner  |

## Setup & run

**Requirements:** Node.js 18 or newer.

```bash
# 1. Install the single dependency
npm install

# 2. Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Run tests

```bash
npm test
```

All 16 tests (7 foodService + 9 logService) should pass.

## Project structure

```
nutritrack/
├── data/
│   ├── foods.json          # 47 foods — read-only food database
│   └── store.json          # mutable store: entries + goals
├── public/
│   ├── index.html          # page structure
│   ├── styles.css          # design system + responsive layout
│   └── app.js              # SPA logic (fetch, render, events)
├── src/
│   ├── store.js            # read/write JSON store
│   ├── foodService.js      # search, lookup, portion scaling
│   └── logService.js       # day data, add/remove entries, goals
├── test/
│   ├── foodService.test.js # 7 tests
│   └── logService.test.js  # 9 tests (isolated temp store)
├── server.js               # Express server + REST API routes
└── package.json
```

## API reference

| Method | Route               | Description                          |
|--------|---------------------|--------------------------------------|
| GET    | `/api/foods?q=`     | Search foods (dynamic feature 1)     |
| POST   | `/api/entries`      | Log a portion (dynamic feature 2)    |
| GET    | `/api/day?date=`    | Day entries, totals, goals, progress |
| DELETE | `/api/entries/:id`  | Remove an entry                      |
| GET    | `/api/goals`        | Read current goals                   |
| PUT    | `/api/goals`        | Update goals                         |

### POST `/api/entries` body
```json
{ "date": "2026-06-08", "foodId": "f001", "grams": 180 }
```

### PUT `/api/goals` body
```json
{ "kcal": 2000, "protein": 120, "carbs": 250, "fat": 65 }
```
