'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  searchFoods,
  getFoodById,
  nutritionForPortion,
} = require('../src/foodService');

/* ── searchFoods ─────────────────────────────────────────── */

describe('searchFoods', () => {

  it('returns matching results for a known name', () => {
    const results = searchFoods('chicken');
    assert.ok(results.length > 0, 'expected at least one result');
    assert.ok(
      results.every(f => f.name.toLowerCase().includes('chicken')),
      'all results should include the query term'
    );
  });

  it('is case-insensitive', () => {
    const lower = searchFoods('salmon');
    const upper = searchFoods('SALMON');
    assert.deepEqual(lower, upper);
  });

  it('matches on a partial name', () => {
    const results = searchFoods('bro');
    assert.ok(results.length > 0, 'partial match should return results');
  });

  it('returns an empty array for an empty string', () => {
    assert.deepEqual(searchFoods(''), []);
  });

  it('returns an empty array for a whitespace-only string', () => {
    assert.deepEqual(searchFoods('   '), []);
  });

});

/* ── getFoodById ─────────────────────────────────────────── */

describe('getFoodById', () => {

  it('returns the correct food object for a valid id', () => {
    const food = getFoodById('f001');
    assert.ok(food, 'should return a food object');
    assert.equal(food.name, 'Chicken breast, grilled');
  });

  it('returns null for an unknown id', () => {
    assert.equal(getFoodById('does_not_exist'), null);
  });

});

/* ── nutritionForPortion ─────────────────────────────────── */

describe('nutritionForPortion', () => {

  it('scales kcal correctly for a 200g portion', () => {
    // f001: 165 kcal per 100g → 200g = 330 kcal
    const n = nutritionForPortion('f001', 200);
    assert.equal(n.kcal, 330);
  });

  it('rounds values to one decimal place', () => {
    // f005 Eggs: fat = 10.6 per 100g → 150g = 15.9
    const n = nutritionForPortion('f005', 150);
    const str = String(n.fat);
    const decimals = str.includes('.') ? str.split('.')[1].length : 0;
    assert.ok(decimals <= 1, `fat should have at most 1 decimal, got: ${n.fat}`);
  });

  it('throws for a negative gram value', () => {
    assert.throws(() => nutritionForPortion('f001', -50), /positive/i);
  });

  it('throws for zero grams', () => {
    assert.throws(() => nutritionForPortion('f001', 0), /positive/i);
  });

  it('throws for an unknown food id', () => {
    assert.throws(() => nutritionForPortion('unknown_id', 100), /not found/i);
  });

});
