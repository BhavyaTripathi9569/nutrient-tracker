'use strict';

const path  = require('path');
const foods = require(path.join(__dirname, '..', 'data', 'foods.json'));

function searchFoods(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  return foods.filter(f => f.name.toLowerCase().includes(q));
}

function getFoodById(id) {
  return foods.find(f => f.id === id) ?? null;
}

function nutritionForPortion(foodId, grams) {
  const food = getFoodById(foodId);
  if (!food) throw new Error(`Food '${foodId}' not found`);

  const g = Number(grams);
  if (!isFinite(g) || g <= 0) throw new Error('Grams must be a positive number');

  const scale = g / 100;
  const r = v => Math.round(v * scale * 10) / 10;
  return {
    kcal:    r(food.per100g.kcal),
    protein: r(food.per100g.protein),
    carbs:   r(food.per100g.carbs),
    fat:     r(food.per100g.fat),
  };
}

module.exports = { searchFoods, getFoodById, nutritionForPortion };
