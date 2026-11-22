// Order items by a saved id list: listed ids first in that order, the rest after in their
// original order. Unknown ids in `order` are ignored.
export function orderByIds<T>(items: T[], order: string[], keyOf: (t: T) => string): T[] {
  const rank = new Map(order.map((id, i) => [id, i] as const))
  return items
    .map((t, i) => ({ t, i, r: rank.get(keyOf(t)) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.t)
}

// Move `id` so it sits just before `beforeId`; appends when `beforeId` isn't in the list.
export function moveBefore(ids: string[], id: string, beforeId: string): string[] {
  if (id === beforeId) return ids
  const rest = ids.filter((x) => x !== id)
  const at = rest.indexOf(beforeId)
  rest.splice(at < 0 ? rest.length : at, 0, id)
  return rest
}
