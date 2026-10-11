-- First-run getting started.
--
-- New accounts no longer arrive with an ES1 and an Opus 2 on the bench. A new
-- user goes through the getting-started page instead, which asks what they
-- actually own (possibly nothing yet) and adds that.
--
-- onboarded_at records when they finished or skipped it. NULL means they have
-- not, and the client sends them there before anything else.
--
-- Everyone already here has a bench and has been using it, so they count as
-- onboarded from the day they joined rather than being sent through a tour of
-- an app they know.

ALTER TABLE users ADD COLUMN onboarded_at TEXT;

UPDATE users SET onboarded_at = created_at;
