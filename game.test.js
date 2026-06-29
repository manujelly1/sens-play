const test = require("node:test");
const assert = require("node:assert/strict");

const {
  clamp,
  angleDiff,
  circleIntersectsRect,
  normalizeWantedLevel,
  formatWantedStars,
  updateWantedState
} = require("./game-logic.js");

test("clamp keeps values inside bounds", () => {
  assert.equal(clamp(-4, 0, 5), 0);
  assert.equal(clamp(3, 0, 5), 3);
  assert.equal(clamp(9, 0, 5), 5);
});

test("angleDiff returns the shortest signed angular distance", () => {
  const diff = angleDiff(Math.PI * 1.5, 0);
  assert.ok(Math.abs(diff + Math.PI / 2) < 1e-9);
});

test("circleIntersectsRect detects overlap and separation", () => {
  const rect = { x: 10, y: 10, w: 20, h: 20 };
  assert.equal(circleIntersectsRect(8, 20, 3, rect), true);
  assert.equal(circleIntersectsRect(0, 0, 4, rect), false);
});

test("normalizeWantedLevel respects lower and upper bounds", () => {
  assert.equal(normalizeWantedLevel(0, -2), 0);
  assert.equal(normalizeWantedLevel(2, 2), 4);
  assert.equal(normalizeWantedLevel(4, 3), 5);
});

test("formatWantedStars keeps the visible stars aligned with the wanted level", () => {
  assert.equal(formatWantedStars(0), "☆☆☆☆☆");
  assert.equal(formatWantedStars(3), "★★★☆☆");
  assert.equal(formatWantedStars(8), "★★★★★");
});

test("updateWantedState accumulates evade time while police are far", () => {
  const next = updateWantedState(2, 3, 420, 1.5);
  assert.deepEqual(next, {
    wanted: 2,
    evadeTimer: 4.5,
    cooledDown: false
  });
});

test("updateWantedState drops wanted level after enough time away", () => {
  const next = updateWantedState(2, 9.5, 420, 0.6);
  assert.deepEqual(next, {
    wanted: 1,
    evadeTimer: 0,
    cooledDown: true
  });
});

test("updateWantedState resets evade timer when police get close again", () => {
  const next = updateWantedState(2, 6, 150, 0.5);
  assert.deepEqual(next, {
    wanted: 2,
    evadeTimer: 0,
    cooledDown: false
  });
});
