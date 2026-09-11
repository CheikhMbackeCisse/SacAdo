import test from "node:test";
import assert from "node:assert/strict";
import { heureCalmeDakar } from "./heures-calmes.ts";

function heureUTC(h: number): Date {
  return new Date(Date.UTC(2026, 0, 1, h, 0, 0));
}

test("22h-23h59 -> calme", () => {
  assert.equal(heureCalmeDakar(heureUTC(22)), true);
  assert.equal(heureCalmeDakar(heureUTC(23)), true);
});

test("0h-6h59 -> calme", () => {
  assert.equal(heureCalmeDakar(heureUTC(0)), true);
  assert.equal(heureCalmeDakar(heureUTC(6)), true);
});

test("7h-21h59 -> pas calme", () => {
  assert.equal(heureCalmeDakar(heureUTC(7)), false);
  assert.equal(heureCalmeDakar(heureUTC(12)), false);
  assert.equal(heureCalmeDakar(heureUTC(21)), false);
});
