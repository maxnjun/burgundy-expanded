import { hasShield } from "../shields";
import type { GameState, PlayerState, ScoreEntry } from "../types";
import { areAxialNeighbors } from "../boards/axial";

/** @deprecated Historical connection-rule utility retained for legacy regression only.
 * Current placement uses fortress-lines.ts (user-confirmed straight lines).
 * Common player-board overlay: user-marked diagram #23 and rulebook p.14.
 * The bottom post touches either of the two bottom middle hexes.
 */
export const BORDER_POSTS = [
  { id: "left", x: 175, y: 102, cellIds: ["-1,-2"] },
  { id: "right", x: 445, y: 102, cellIds: ["3,-2"] },
  { id: "bottom", x: 310, y: 536, cellIds: ["-2,3", "-1,3"] },
] as const;
export const hasExtension = (state: GameState, id: string) => state.config.extensions.some(e => e.id === id);

export function connectedPostPairs(player: PlayerState): string[] {
  const occupied = player.duchy.cells.filter(c => c.tileId !== null);
  const components = new Map<string, number>();
  for (const cell of occupied) {
    if (components.has(cell.id)) continue;
    const component = components.size, queue = [cell]; components.set(cell.id, component);
    for (let i = 0; i < queue.length; i++) for (const next of occupied) {
      if (!components.has(next.id) && areAxialNeighbors(queue[i].coord, next.coord)) {
        components.set(next.id, component); queue.push(next);
      }
    }
  }
  const posts = BORDER_POSTS.map(post => new Set(post.cellIds.flatMap(id => components.has(id) ? [components.get(id)!] : [])));
  return [[0,1],[0,2],[1,2]].flatMap(([a,b]) => [...posts[a]].some(c => posts[b].has(c)) ? [`${BORDER_POSTS[a].id}-${BORDER_POSTS[b].id}`] : []);
}

export function borderPostScore(state: GameState, before: PlayerState, after: PlayerState): ScoreEntry[] {
  if (!hasExtension(state, "border-posts")) return [];
  const source = { document: "special-edition-rulebook" as const, pages: [14], section: "Border post connections" };
  const previous = connectedPostPairs(before), next = connectedPostPairs(after);
  const entries: ScoreEntry[] = next.filter(pair => !previous.includes(pair)).map(pair => ({
    id: `border:${after.id}:${pair}`, category: "extension", extensionId: "border-posts", points: { A:10,B:8,C:6,D:4,E:2 }[state.turn.phase], source,
  }));
  if (previous.length < 3 && next.length === 3) {
    const claimed = state.players.filter(p => state.scoreLedger[p.id].some(e => e.id === `border:${p.id}:all`)).length;
    if (claimed < 2) entries.push({ id: `border:${after.id}:all`, category: "extension", extensionId: "border-posts", points: (state.config.playerCount + (claimed === 0 ? 3 : 0))*(hasShield(state,after.id,7)?2:1), source });
  }
  return entries;
}
