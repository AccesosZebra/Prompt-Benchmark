/**
 * Next runs `register` once when the server boots. This is the app's only
 * scheduled work: the sweep that posts demo deadline notices to Google Chat.
 *
 * Production only, so a `next dev` with real credentials cannot post to the
 * team's channel. The `nodejs` check has to stay in this positive form: it is
 * what lets the build drop the import from the Edge bundle.
 *
 * shortcut: an in-process timer, so a container down for a whole day misses that
 * day's notice. Upgrade to pg_cron calling a route if that ever happens.
 */
const SWEEP_MS = 5 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { notifyDemoDeadlines } = await import("./lib/google-chat/notify");
    void notifyDemoDeadlines();
    setInterval(() => void notifyDemoDeadlines(), SWEEP_MS).unref();
  }
}
