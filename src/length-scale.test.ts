import { test, expect } from "bun:test"
import { pctToPos, posToPct } from "./length-scale"

test("100% sits at the centre, ends map to 25% and 400%", () => {
  expect(pctToPos(100)).toBe(50)
  expect(posToPct(0)).toBe(25)
  expect(posToPct(100)).toBe(400)
  expect(posToPct(51)).toBe(100)
})

test("round trip stays close and out-of-range values pin the slider", () => {
  for (const pct of [25, 50, 75, 150, 200, 300, 400]) expect(Math.abs(posToPct(pctToPos(pct)) - pct)).toBeLessThanOrEqual(10)
  expect(pctToPos(1000)).toBe(100)
  expect(pctToPos(1)).toBe(0)
})
