#!/bin/sh
set -e

# Exported, not just computed: the app resolves its own default relative to the
# source tree, so without this litestream would replicate /data/brewlab.db while
# the server happily wrote to ephemeral container storage — backups of an empty
# database, discovered only when you need one.
DB="${BREWLAB_DB:-/data/brewlab.db}"
export BREWLAB_DB="$DB"
mkdir -p "$(dirname "$DB")"

# Litestream is opt-in: set LITESTREAM_REPLICA_URL (plus the two credential
# variables) to turn on continuous backup. Unset, the app still runs — it just
# has no copy of the database anywhere but this machine's volume, which is worth
# saying out loud on every boot rather than discovering after a bad deploy.
if [ -n "$LITESTREAM_REPLICA_URL" ]; then
  echo "  litestream  restoring $DB if the volume is empty"
  litestream restore -if-db-not-exists -if-replica-exists -o "$DB" "$LITESTREAM_REPLICA_URL"

  echo "  litestream  replicating $DB -> $LITESTREAM_REPLICA_URL"
  exec litestream replicate -exec "npm run start -w server" "$DB" "$LITESTREAM_REPLICA_URL"
fi

echo "  litestream  DISABLED (LITESTREAM_REPLICA_URL unset) — this volume is the only copy"
exec npm run start -w server
