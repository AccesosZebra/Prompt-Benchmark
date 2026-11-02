/**
 * The message a report becomes in Google Chat.
 *
 * Pure, so what the team reads at eight in the morning can be checked without a
 * network. Chat's own markup: `*bold*` and `<url|text>`, which is why this does
 * not reuse the markdown the app renders elsewhere.
 *
 * What goes in is what decides whether it is worth opening: who, which round,
 * and what the client says the bot should have answered. The complaint is
 * optional for the client, so its heading only exists when there is one.
 */
import { formatDeadlineEs, type DeadlineStage } from "../business-days.ts";

export type NoteMessageInput = {
  clientName: string | null;
  roundLabel: string | null;
  expected: string;
  complaint: string | null;
  /** Absolute link back to the round, when the app knows its own origin. */
  url: string | null;
};

export type DeadlineMessageInput = {
  stage: DeadlineStage;
  clientName: string | null;
  roundLabel: string | null;
  /** YYYY-MM-DD, the link's last day. */
  expiresOn: string;
  /** Absolute link back to the round, when the app knows its own origin. */
  url: string | null;
};

/** One line, trimmed, so a client's line breaks do not push the link out of
 *  the preview a phone shows. */
function oneLine(text: string, max = 300): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function buildDeadlineMessage(input: DeadlineMessageInput): string {
  const client = input.clientName ?? "Cliente";
  const lines = [
    input.stage === "closing" ? `*La demo cierra hoy · ${client}*` : `*Demo por cerrar · ${client}*`,
  ];
  if (input.roundLabel) lines.push(`Ronda: ${input.roundLabel}`);
  lines.push(`Último día para reportes: ${formatDeadlineEs(input.expiresOn)}`);
  if (input.url) lines.push(`<${input.url}|Abrir la demo>`);
  return lines.join("\n");
}

export function buildNoteMessage(input: NoteMessageInput): string {
  const lines: string[] = [
    `*Nuevo reporte · ${input.clientName ?? "Cliente"}*`,
  ];
  if (input.roundLabel) lines.push(`Ronda: ${input.roundLabel}`);
  lines.push(`*Debió responder:* ${oneLine(input.expected)}`);
  if (input.complaint) lines.push(`*Qué estuvo mal:* ${oneLine(input.complaint)}`);
  if (input.url) lines.push(`<${input.url}|Ver la conversación>`);
  return lines.join("\n");
}
