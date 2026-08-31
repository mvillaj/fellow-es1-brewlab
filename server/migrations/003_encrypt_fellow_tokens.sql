-- Fellow credentials move to encrypted-at-rest, and the refresh token goes away.
--
-- refresh_token was written on connect and read back into the session object,
-- but never passed to a refresh call anywhere in the codebase. It was a live
-- credential in the database buying nothing, and the cheapest way to protect a
-- secret is to not hold it.
--
-- Existing access tokens are plaintext and SQL cannot re-encrypt them, so the
-- rows are dropped rather than migrated. The cost is reconnecting on the Fellow
-- page; the alternative is a column that is sometimes ciphertext and sometimes
-- not, which is worse than either.

DELETE FROM fellow_connections;

ALTER TABLE fellow_connections DROP COLUMN refresh_token;
