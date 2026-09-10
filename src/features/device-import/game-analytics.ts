import type { ImportedGame } from "@/features/device-import/types";

export interface RoundOutcomePoint {
  round: number;
  label: string;
  hits: number;
  misses: number;
  total: number;
  accuracy: number;
  averageTimeSeconds: number;
}

export interface PlayerOutcomePoint {
  playerUid: string;
  label: string;
  colorCode: string;
  hits: number;
  misses: number;
  total: number;
  accuracy: number;
}

function percentage(hits: number, total: number) {
  return total > 0 ? Math.round((hits / total) * 100) : 0;
}

export function buildRoundOutcomeSeries(game: ImportedGame): RoundOutcomePoint[] {
  const rounds = new Map<number, { hits: number; misses: number; totalTimeSeconds: number }>();

  for (const turn of game.turns) {
    const current = rounds.get(turn.turnNumber) ?? { hits: 0, misses: 0, totalTimeSeconds: 0 };
    if (turn.correct) current.hits += 1;
    else current.misses += 1;
    current.totalTimeSeconds += Math.max(0, turn.playTimeSeconds);
    rounds.set(turn.turnNumber, current);
  }

  return [...rounds.entries()]
    .sort(([left], [right]) => left - right)
    .map(([round, outcome]) => {
      const total = outcome.hits + outcome.misses;
      return {
        round,
        label: `Ronda ${round}`,
        hits: outcome.hits,
        misses: outcome.misses,
        total,
        accuracy: percentage(outcome.hits, total),
        averageTimeSeconds: total > 0 ? Number((outcome.totalTimeSeconds / total).toFixed(1)) : 0,
      };
    });
}

export function buildPlayerOutcomeSeries(game: ImportedGame): PlayerOutcomePoint[] {
  const outcomes = new Map(game.players.map((player) => [player.uid, { hits: 0, misses: 0 }]));

  for (const turn of game.turns) {
    const current = outcomes.get(turn.playerUid) ?? { hits: 0, misses: 0 };
    if (turn.correct) current.hits += 1;
    else current.misses += 1;
    outcomes.set(turn.playerUid, current);
  }

  return game.players.map((player) => {
    const outcome = outcomes.get(player.uid) ?? { hits: 0, misses: 0 };
    const total = outcome.hits + outcome.misses;
    const assignment = game.assignments[player.uid];
    return {
      playerUid: player.uid,
      label: assignment?.name || player.name || `Jugador ${player.position}`,
      colorCode: player.colorCode,
      hits: outcome.hits,
      misses: outcome.misses,
      total,
      accuracy: percentage(outcome.hits, total),
    };
  });
}
