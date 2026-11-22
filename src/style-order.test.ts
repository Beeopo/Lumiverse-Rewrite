import { test, expect } from "bun:test"
import { orderByIds, moveBefore } from "./style-order"

const items = ["a", "b", "c", "d"].map((id) => ({ id }))
const key = (x: { id: string }) => x.id

test("orderByIds puts listed ids first, keeps the rest in original order", () => {
  expect(orderByIds(items, ["c", "a"], key).map(key)).toEqual(["c", "a", "b", "d"])
})

test("orderByIds ignores unknown ids and handles an empty order", () => {
  expect(orderByIds(items, ["zz", "d"], key).map(key)).toEqual(["d", "a", "b", "c"])
  expect(orderByIds(items, [], key).map(key)).toEqual(["a", "b", "c", "d"])
})

test("moveBefore moves an id ahead of another, or to the end", () => {
  expect(moveBefore(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"])
  expect(moveBefore(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"])
  expect(moveBefore(["a", "b"], "a", "missing")).toEqual(["b", "a"])
  expect(moveBefore(["a", "b"], "a", "a")).toEqual(["a", "b"])
})
