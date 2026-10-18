/** Resource-bounded JSON only. Domain/canonical-catalog validation is still mandatory. */
export function parseBoundedGameJson(text: string): unknown {
  if (typeof text !== "string" || text.length > 2_000_000) throw new Error("Saved JSON is too large");
  const value: unknown = JSON.parse(text);
  let nodes = 0;
  const walk = (v: unknown, depth: number): void => {
    if (++nodes > 100_000 || depth > 30) throw new Error("Saved JSON exceeds structural limits");
    if (Array.isArray(v)) v.forEach(x => walk(x, depth + 1));
    else if (v && typeof v === "object") for (const [key, child] of Object.entries(v)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Forbidden saved JSON key");
      walk(child, depth + 1);
    }
  };
  walk(value, 0);
  return value;
}
