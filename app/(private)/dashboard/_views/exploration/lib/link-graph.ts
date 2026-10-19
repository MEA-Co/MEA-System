export function canConnectLink(
  edges: readonly { from: string; to: string }[],
  from: string,
  to: string,
) {
  if (from === to || edges.some((edge) => edge.from === from && edge.to === to))
    return false;
  const pending = [to];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === from) return false;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of edges) if (edge.from === current) pending.push(edge.to);
  }
  return true;
}
