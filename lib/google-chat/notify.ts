/**
 * The seam between a client's report and Google Chat.
 *
 * Nothing here is allowed to throw. A report is already saved by the time this
 * runs, the bell will show it regardless, and the client on the other side must
 * never see their report fail because Google is having a morning. Every path
 * ends in a return or a console.error.
 *
 * ponytail: no retry and no queue. A lost message costs a glance at the bell,
 * which is the same place the report was going to be reviewed anyway. A queue
 * would be infrastructure for a convenience.
 */
import {
  claimDeadlineNotice,
  listDeadlineNotices,
  releaseDeadlineNotice,
  type DemoLink,
} from "../db/demo-links";
import { getClientName } from "../db/clients";
import { getGoogleChatSettings } from "../db/google-chat-settings";
import { baseUrlFromHeaders } from "../base-url";
import { buildDeadlineMessage, buildNoteMessage } from "./message.ts";
import { isGoogleChatConfigured, postMessage } from "./client.ts";

export async function notifyNoteCreated(input: {
  link: DemoLink;
  expected: string;
  complaint: string | null;
  /** The app's own origin, resolved from the request that carried the note. */
  baseUrl: string | null;
}): Promise<void> {
  // Not configured is not a failure: an install without the env vars, or
  // without a space picked, is simply one that does not use this.
  if (!isGoogleChatConfigured()) return;

  try {
    const settings = await getGoogleChatSettings();
    if (!settings.space_name) return;

    const clientName = await getClientName(input.link.client_id);
    await postMessage(
      settings.space_name,
      buildNoteMessage({
        clientName,
        roundLabel: input.link.label ?? `v${input.link.version_number_snapshot}`,
        expected: input.expected,
        complaint: input.complaint,
        url: input.baseUrl ? `${input.baseUrl}/lab/demo/${input.link.id}` : null,
      }),
    );
  } catch (err) {
    console.error("Google Chat: no se pudo avisar del reporte.", err);
  }
}

/**
 * The sweep behind the deadline notices, run on a timer by instrumentation.ts.
 *
 * Unlike a report, nothing else carries this message to the channel, and the
 * retry is free: a failed send gives its claim back and the next sweep tries
 * again. A failure on one link never stops the rest. Nothing is claimed while
 * Chat is off, so turning it on the same morning still delivers.
 */
export async function notifyDemoDeadlines(): Promise<void> {
  if (!isGoogleChatConfigured()) return;

  try {
    const settings = await getGoogleChatSettings();
    if (!settings.space_name) return;

    const baseUrl = baseUrlFromHeaders(new Headers());
    for (const notice of await listDeadlineNotices()) {
      let claimed = false;
      try {
        claimed = await claimDeadlineNotice(notice);
        if (!claimed) continue;
        await postMessage(
          settings.space_name,
          buildDeadlineMessage({
            stage: notice.stage,
            clientName: notice.client_name,
            roundLabel: notice.round_label,
            expiresOn: notice.expires_on,
            url: baseUrl ? `${baseUrl}/lab/demo/${notice.link_id}` : null,
          }),
        );
      } catch (err) {
        console.error("Google Chat: no se pudo avisar del plazo de una demo.", err);
        if (claimed) {
          await releaseDeadlineNotice(notice).catch((releaseErr) =>
            console.error("Google Chat: el aviso quedó reservado sin enviarse.", releaseErr),
          );
        }
      }
    }
  } catch (err) {
    console.error("Google Chat: no se pudieron revisar los plazos de las demos.", err);
  }
}
