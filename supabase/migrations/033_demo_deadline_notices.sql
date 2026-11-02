-- ============================================================
-- Demo: notices before a link's deadline.
--
-- Each column holds the `expires_on` a notice was already sent for, not a flag.
-- Changing the deadline therefore re-arms both notices with no reset logic, and
-- reopening a link on the same date does not repeat them.
--
-- Safe to re-run. Null on every existing link means nothing was sent yet, and
-- the sweep only ever matches today's exact dates, so links already past their
-- deadline stay silent.
-- ============================================================

alter table demo_links
  add column if not exists warned_for date,
  add column if not exists closing_notified_for date;
