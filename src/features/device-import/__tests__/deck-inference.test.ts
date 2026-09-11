import { describe, expect, it } from "vitest";
import { inferDeckNameFromTurns } from "@/features/device-import/deck-inference";
import type { DeviceGameTurn } from "@/features/device-import/types";

function turn(difficulty: string, cardId = "rfid-uid"): DeviceGameTurn {
  return { turnNumber: 1, playerUid: "p1", cardId, correct: true, difficulty, timestamp: 0, playTimeSeconds: 1 };
}

describe("inferDeckNameFromTurns", () => {
  it("infers the thematic deck and level from logical card numbers", () => {
    expect(inferDeckNameFromTurns([turn("2101"), turn("2136")], "STANDARD"))
      .toBe("2.1 ANS + Pre símbolos | Fácil");
    expect(inferDeckNameFromTurns([turn("3102")], "3.1"))
      .toBe("3.1 Geometría | Fácil");
  });

  it("labels games containing cards from different deck prefixes as mixed", () => {
    expect(inferDeckNameFromTurns([turn("2101"), turn("3102")], "STANDARD"))
      .toBe("Mazo mezclado");
  });

  it("can read a logical number from cardId when difficulty does not contain it", () => {
    expect(inferDeckNameFromTurns([turn("EASY", "5107")], "STANDARD"))
      .toBe("5.1 Simbólico + Operaciones | Fácil");
  });

  it("keeps the box-provided name when no logical card number is available", () => {
    expect(inferDeckNameFromTurns([turn("EASY", "1D4548BB990000")], "Mazo manual"))
      .toBe("Mazo manual");
  });
});
