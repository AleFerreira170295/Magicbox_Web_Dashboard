import type { DeviceGameTurn } from "@/features/device-import/types";

const DECK_NAMES_BY_CARD_PREFIX: Record<string, string> = {
  "11": "1.1 ANS | Fácil",
  "12": "1.2 ANS | Medio",
  "13": "1.3 ANS | Difícil",
  "21": "2.1 ANS + Pre símbolos | Fácil",
  "22": "2.2 ANS + Pre símbolos | Medio",
  "23": "2.3 ANS + Pre símbolos | Difícil",
  "31": "3.1 Geometría | Fácil",
  "32": "3.2 Geometría | Medio",
  "33": "3.3 Geometría | Difícil",
  "41": "4.1 ANS + Operaciones | Fácil",
  "42": "4.2 ANS + Operaciones | Medio",
  "43": "4.3 ANS + Operaciones | Difícil",
  "51": "5.1 Simbólico + Operaciones | Fácil",
  "52": "5.2 Simbólico + Operaciones | Medio",
  "53": "5.3 Simbólico + Operaciones | Difícil",
};

function inferCardPrefix(turn: DeviceGameTurn) {
  for (const value of [turn.difficulty, turn.cardId]) {
    const prefix = String(value || "").trim().match(/^([1-5][1-3])/u)?.[1];
    if (prefix && DECK_NAMES_BY_CARD_PREFIX[prefix]) return prefix;
  }
  return null;
}

export function inferDeckNameFromTurns(turns: DeviceGameTurn[], fallbackDeckName: string) {
  const prefixes = new Set(turns.map(inferCardPrefix).filter((prefix): prefix is string => Boolean(prefix)));
  if (prefixes.size > 1) return "Mazo mezclado";
  const [prefix] = prefixes;
  return (prefix && DECK_NAMES_BY_CARD_PREFIX[prefix]) || fallbackDeckName.trim() || "UNKNOWN";
}
