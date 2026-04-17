import type { GameRecord } from "@/features/games/types";

export type TeacherDashboardExportMatch = {
  matchId: string;
  deckName: string;
  startedAt: string;
  totalTurns: number;
  successfulTurns: number;
  successRate: number;
  avgTurnTimeSeconds: number;
};

export type TeacherDashboardExportTurn = {
  matchId: string;
  deckName: string;
  turnNumber: number;
  success: "yes" | "no";
  playTimeSeconds: number;
  difficulty: string;
  cardId: string;
  turnStartedAt: string;
  recordedAt: string;
};

export type TeacherDashboardExportData = {
  matches: TeacherDashboardExportMatch[];
  turns: TeacherDashboardExportTurn[];
};

function formatCell(value?: string | null) {
  return value || "";
}

function buildFileStamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildTeacherDashboardExportData(games: GameRecord[]): TeacherDashboardExportData {
  const matches = games.map((game) => {
    const totalTurns = game.turns.length;
    const successfulTurns = game.turns.filter((turn) => turn.success).length;
    const totalTurnTime = game.turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0);

    return {
      matchId: game.id,
      deckName: game.deckName || "Sin mazo",
      startedAt: formatCell(game.startDate || game.createdAt || game.updatedAt),
      totalTurns,
      successfulTurns,
      successRate: totalTurns > 0 ? Math.round((successfulTurns / totalTurns) * 100) : 0,
      avgTurnTimeSeconds: totalTurns > 0 ? Math.round((totalTurnTime / totalTurns) * 10) / 10 : 0,
    };
  });

  const turns = games.flatMap((game) =>
    game.turns.map((turn) => ({
      matchId: game.id,
      deckName: game.deckName || "Sin mazo",
      turnNumber: turn.turnNumber,
      success: turn.success ? ("yes" as const) : ("no" as const),
      playTimeSeconds: turn.playTimeSeconds || 0,
      difficulty: formatCell(turn.difficulty),
      cardId: formatCell(turn.cardId),
      turnStartedAt: formatCell(turn.turnStartDate),
      recordedAt: formatCell(turn.createdAt || turn.updatedAt),
    })),
  );

  return { matches, turns };
}

export async function downloadTeacherDashboardExcel(data: TeacherDashboardExportData, fileName = `teacher-dashboard-partidas-${buildFileStamp()}.xlsx`) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const matchesSheet = XLSX.utils.json_to_sheet(data.matches);
  const turnsSheet = XLSX.utils.json_to_sheet(data.turns);

  XLSX.utils.book_append_sheet(workbook, matchesSheet, "Partidas");
  XLSX.utils.book_append_sheet(workbook, turnsSheet, "Turnos");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  downloadBlob(blob, fileName);
}

export async function downloadTeacherDashboardPdf(data: TeacherDashboardExportData, fileName = `teacher-dashboard-partidas-${buildFileStamp()}.pdf`) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 44;

  const ensureSpace = (required = 20) => {
    if (y + required <= pageHeight - 40) return;
    doc.addPage();
    y = 44;
  };

  doc.setFontSize(18);
  doc.text("Exporte de partidas anonimizadas", 40, y);
  y += 24;
  doc.setFontSize(10);
  doc.text("Este archivo omite nombres, ids y cualquier dato identificatorio de jugadores.", 40, y);
  y += 18;
  doc.text(`Partidas: ${data.matches.length} · Turnos: ${data.turns.length}`, 40, y);
  y += 28;

  data.matches.forEach((match) => {
    ensureSpace(72);
    doc.setFontSize(12);
    doc.text(`Partida ${match.matchId} · ${match.deckName}`, 40, y);
    y += 16;
    doc.setFontSize(10);
    doc.text(
      `Inicio: ${match.startedAt || "sin fecha"} · Turnos: ${match.totalTurns} · Aciertos: ${match.successfulTurns} · Éxito: ${match.successRate}% · Promedio: ${match.avgTurnTimeSeconds}s`,
      40,
      y,
    );
    y += 16;

    data.turns
      .filter((turn) => turn.matchId === match.matchId)
      .forEach((turn) => {
        ensureSpace(14);
        doc.text(
          `Turno ${turn.turnNumber} · ${turn.success === "yes" ? "acierto" : "error"} · ${turn.playTimeSeconds}s · dificultad ${turn.difficulty || "n/d"} · carta ${turn.cardId || "n/d"}`,
          54,
          y,
        );
        y += 14;
      });

    y += 12;
  });

  doc.save(fileName);
}
