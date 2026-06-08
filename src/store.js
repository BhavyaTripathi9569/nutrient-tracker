'use strict';

const fs   = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'store.json');

const DEFAULT_GOALS = { kcal: 2000, protein: 120, carbs: 250, fat: 65 };
const EMPTY_STORE   = () => ({ goals: { ...DEFAULT_GOALS }, entries: [] });

let _storePath = DEFAULT_PATH;

function setStorePath(p)  { _storePath = p; }
function resetStorePath() { _storePath = DEFAULT_PATH; }

function read() {
  try {
    return JSON.parse(fs.readFileSync(_storePath, 'utf8'));
  } catch {
    return EMPTY_STORE();
  }
}

function write(data) {
  fs.writeFileSync(_storePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { read, write, setStorePath, resetStorePath, DEFAULT_GOALS };
