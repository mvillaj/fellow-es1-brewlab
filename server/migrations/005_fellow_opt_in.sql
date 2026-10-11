-- The Fellow integration becomes opt-in, and the simulated client goes away.
--
-- fellow_opt_in_at records when a user accepted the experimental-feature
-- warning. NULL means they have not, and every Fellow route except status and
-- the opt-in itself refuses them.
--
-- Existing connections are dropped. Some were made against the simulated
-- client and hold a token that was never Fellow's, and none were made after
-- the warning existed. Reconnecting is one form; a stale connection that
-- silently starts writing to a real machine is not something to inherit.

ALTER TABLE users ADD COLUMN fellow_opt_in_at TEXT;

DELETE FROM fellow_connections;
