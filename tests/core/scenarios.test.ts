import { test } from "node:test";
import assert from "node:assert/strict";
import { createPracticeSession } from "../../src/game/practice";
import { applyCoreAction, listCoreActionOptions, orderedPlayers, validateCoreState, checkCoreGameEnd } from "../../src/game/core";
import { parseSavedGame, serializeSavedGame } from "../../src/game/save";
import type { ActionIntent, GameAction } from "../../src/game/types";
test("mixed acquisition, placement, sales and effect choices finish 25 rounds for 2/3/4 players", () => {
    const seen = new Set<string>();
    let placements = 0, choices = 0;
    for (const count of [2, 3, 4]) {
        let state = createPracticeSession({ names: Array(count).fill("영주"), seed: `mixed-${count}`, boardIds: Array(count).fill("se:base:2"), officialSlots: count >= 3, fullEffects: true });
        let steps = 0;
        while (state.status !== "finished") {
            assert.ok(++steps < 1500, "scenario must not loop");
            const playerId = state.turn.activePlayerId ?? orderedPlayers(state)[0];
            const result = listCoreActionOptions(state, playerId);
            assert.ok(result.ok, JSON.stringify(result));
            const candidates = result.value.actions;
            assert.ok(candidates.length, "no action at live state");
            const rank = (a: GameAction): number => {
                if (a.type === "resolve-choice") {
                    const payload = state.turn.pendingChoice!.options.find(o => o.id === a.optionId)!.payload as {
                        intent?: ActionIntent;
                    } | null;
                    return payload?.intent?.kind === "place-tile" ? 0 : payload?.intent?.kind === "take-tile" ? 1 : a.optionId === "skip" ? 30 : 3;
                }
                if (a.type !== "use-die")
                    return a.type === "buy-black-tile" ? 40 : 2;
                return a.intent.kind === "place-tile" ? 0 : a.intent.kind === "take-tile" ? 4 : a.intent.kind === "sell-goods" ? 5 : 10;
            };
            const action = [...candidates].sort((a, b) => rank(a) - rank(b))[0];
            if (action.type === "use-die") {
                seen.add(action.intent.kind);
                if (action.intent.kind === "place-tile")
                    placements++;
            }
            if (action.type === "resolve-choice")
                choices++;
            const next = applyCoreAction(state, action);
            assert.ok(next.ok, JSON.stringify(next));
            state = next.value.state;
            assert.equal(validateCoreState(state).valid, true);
            if (state.turn.pendingChoice || steps % 25 === 0) {
                const saved = { format: "burgundy-local-v1" as const, randomAlgorithm: "counter-v1" as const, game: state, logs: [], view: { zoom: 1, focus: false, boardZooms: {} } };
                state = parseSavedGame(serializeSavedGame(saved)).game;
            }
        }
        const end = checkCoreGameEnd(state);
        assert.ok(end.ok && end.value.ended);
        assert.equal(state.turn.phase, "E");
    }
    assert.ok(placements > 10);
    assert.ok(choices > 0);
    assert.ok(seen.has("sell-goods"));
    assert.ok(seen.has("take-tile"));
});
