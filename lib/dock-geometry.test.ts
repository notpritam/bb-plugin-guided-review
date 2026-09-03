import { test, expect } from "vitest";
import { clampRect, defaultRect, DOCK_MIN } from "./dock-geometry";

const bounds = { width: 1000, height: 800 };

test("clamps a rect back inside the bounds", () => {
  const r = clampRect({ x: 2000, y: -50, w: 400, h: 300 }, bounds);
  expect(r.x).toBe(bounds.width - 400);
  expect(r.y).toBe(0);
});

test("enforces the minimum size", () => {
  const r = clampRect({ x: 0, y: 0, w: 10, h: 10 }, bounds);
  expect(r.w).toBe(DOCK_MIN.w);
  expect(r.h).toBe(DOCK_MIN.h);
});

test("default placement sits fully within the bounds, near bottom-right", () => {
  const r = defaultRect(bounds);
  expect(r.x + r.w).toBeLessThanOrEqual(bounds.width);
  expect(r.y + r.h).toBeLessThanOrEqual(bounds.height);
  expect(r.x).toBeGreaterThan(bounds.width / 2);
});

test("degrades gracefully when bounds are smaller than the dock", () => {
  const r = clampRect({ x: 0, y: 0, w: 400, h: 300 }, { width: 200, height: 150 });
  expect(r.x).toBe(0);
  expect(r.y).toBe(0);
});
