"use client";

import { useState, type ReactNode } from "react";
import { IconCheck, IconPencil, IconX } from "@tabler/icons-react";

import type { DemoNoteRow, DemoNoteStatus } from "@/lib/db/demo-notes";
import { Button } from "@/components/ui/Button";

export type NoteReviewPatch = {
  status?: DemoNoteStatus;
  text?: string | null;
  expected?: string | null;
};

/** A turn the report tagged, already reduced to what is shown. `stale` marks
 *  one from a conversation the visitor later restarted past; `context` marks
 *  the other half of the exchange, derived rather than tagged, so a reader
 *  sees what the client was answering and what answered them. */
export type NoteQuote = {
  id: string;
  preview: string;
  stale?: boolean;
  context?: boolean;
  /** Names the conversation a stale quote lives in, instead of the generic
   *  "conversación anterior". */
  where?: string;
};

/**
 * One client report and the verdict on it.
 *
 * Lives on its own because the same card is read in two places: inside the
 * conversation it came from, and in the per client inbox where reports from
 * every conversation are reviewed together. Two copies would drift, and the
 * half that drifts is always the one that decides what reaches the Editor.
 *
 * The rewrite before approving is the reason the edit state is here rather than
 * in the parent: it belongs to this card, and hoisting it made the page own a
 * draft for a note it was not otherwise thinking about.
 */
export function NoteCard({
  note,
  index,
  quotes,
  busy = false,
  onReview,
  footer,
  onJumpToQuote,
  flashed = false,
  cardRef,
}: {
  note: DemoNoteRow;
  /** The pin number drawn on the turns it tags, same convention as the
   *  Playground. */
  index: number;
  quotes: NoteQuote[];
  busy?: boolean;
  onReview: (patch: NoteReviewPatch) => void | Promise<void>;
  /** Where the report came from, when the card is read outside its own
   *  conversation. */
  footer?: ReactNode;
  /** Makes each quote a button that takes the reader to its message, the way
   *  a quoted reply does in WhatsApp. Omit and the quotes are plain text. */
  onJumpToQuote?: (messageId: string) => void;
  flashed?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftExpected, setDraftExpected] = useState("");

  function startEdit() {
    setDraftText(note.text ?? "");
    setDraftExpected(note.expected ?? "");
    setEditing(true);
  }

  async function save(patch: NoteReviewPatch) {
    await onReview(patch);
    setEditing(false);
  }

  // Once it left, the verdict is history: rewriting it here would edit a
  // document the Editor already has.
  const sent = Boolean(note.sent_to_editor_at);
  const statusLabel = sent
    ? "Enviada al Editor"
    : note.status === "pending"
      ? "Sin revisar"
      : note.status === "approved"
        ? "Aprobada"
        : "Descartada";

  return (
    <div
      ref={cardRef}
      // Focusable only by script, so a jump can land the keyboard on it.
      tabIndex={cardRef ? -1 : undefined}
      className={`note-card${flashed ? " is-flashed" : ""}`}
    >
      <div className="note-head">
        <span className="chat-pin note-index">{index}</span>
        {note.message_ids.length === 0 && <span className="note-general">General</span>}
        <span className={`note-status is-${note.status}`}>{statusLabel}</span>
        {note.status !== "pending" && !sent && !editing && (
          <div className="note-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={startEdit}
              aria-label="Editar nota"
            >
              <IconPencil size={14} />
            </button>
          </div>
        )}
      </div>

      {quotes.length > 0 && (
        <div className="note-refs">
          <span className="section-label">Mensajes que marcó</span>
          {quotes.map((q) => {
            const body = (
              <>
                “{q.preview}”
                {q.context && <span className="note-ref-tag">lo que lo provocó</span>}
                {q.stale && !q.context && (
                  <span className="note-ref-tag">
                    {q.where ?? "conversación anterior"}
                    {onJumpToQuote && <span className="note-ref-go"> · ir al mensaje</span>}
                  </span>
                )}
              </>
            );
            return onJumpToQuote ? (
              <button
                key={q.id}
                type="button"
                className={`note-ref${q.context ? " note-ref-context" : ""}`}
                onClick={() => onJumpToQuote(q.id)}
                title="Ir al mensaje"
              >
                {body}
              </button>
            ) : (
              <div
                key={q.id}
                className={`note-ref${q.context ? " note-ref-context" : ""}${q.stale ? " note-ref-stale" : ""}`}
              >
                {body}
              </div>
            );
          })}
        </div>
      )}

      {editing ? (
        <div className="note-review-edit">
          {/* Same order as the client sees: the fix leads, the complaint is
              context. */}
          <textarea
            className="textarea"
            rows={3}
            value={draftExpected}
            onChange={(e) => setDraftExpected(e.target.value)}
            placeholder="Qué debió responder"
          />
          <textarea
            className="textarea"
            rows={2}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Qué está mal"
          />
          <div className="note-composer-actions">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!(draftExpected.trim() || draftText.trim()) || busy}
              onClick={() =>
                save({
                  expected: draftExpected.trim() || null,
                  text: draftText.trim() || null,
                })
              }
            >
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <>
          {note.expected && (
            <p className="note-field">
              <span className="section-label">Debió responder</span>
              {note.expected}
            </p>
          )}
          {note.text && (
            <p className="note-field">
              <span className="section-label">Qué está mal</span>
              {note.text}
            </p>
          )}
        </>
      )}

      {footer}

      {note.status === "pending" && !editing && (
        <div className="note-review-actions">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onReview({ status: "approved" })}
            icon={<IconCheck size={14} />}
          >
            Aprobar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={startEdit}
            icon={<IconPencil size={14} />}
          >
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onReview({ status: "rejected" })}
            icon={<IconX size={14} />}
          >
            Descartar
          </Button>
        </div>
      )}
    </div>
  );
}
