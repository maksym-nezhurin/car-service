# Hourly AUTO.RIA catalog sync (launchd)

Runs `pnpm catalog:sync:autoria` (structure phase, PL plan) once an hour via
macOS `launchd`. Not run through any cloud sandbox — it uses your normal
Terminal environment, so the existing Prisma client / node_modules just work.

## One-time setup

```bash
cp "scripts/automation/com.autivo.autoria-sync.plist" ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.autivo.autoria-sync.plist
```

Run those two lines from the `services/car` directory in a real Terminal
window (not through Claude). The job then fires once immediately, then every
hour, and keeps firing after reboots/logins as long as you're logged in.

## Check it

```bash
launchctl list | grep autoria-sync          # should show a PID or last exit code
tail -f logs/autoria-sync.log               # script's own log (progress, errors)
tail -f logs/launchd-autoria-sync.err.log   # only non-empty if launchd itself couldn't start it
```

## Stop / uninstall

```bash
launchctl bootout gui/$(id -u)/com.autivo.autoria-sync
rm ~/Library/LaunchAgents/com.autivo.autoria-sync.plist
```

## Notes

- Self-limiting: the script enforces AUTO.RIA's ~25-30 req/hour and ~969
  req/month caps itself, and `SYNC_RESUME=1` (default) skips models already
  in the DB — so it's safe to just leave this running. Once the `structure`
  phase (~85 requests) is fully synced, later hourly runs become near no-ops.
- Uses `SYNC_PLAN=pl SYNC_PHASE=structure SYNC_REQUEST_BUDGET=969
  SYNC_DELAY_MS=800` (edit `run-autoria-sync-hourly.sh` to change phase, e.g.
  to `trims-pilot` or `trims`, once structure is done).
- Only runs while you're logged into macOS (a LaunchAgent, not a
  LaunchDaemon) — if this Mac is usually asleep/logged-out, say so and we can
  switch to a LaunchDaemon (runs system-wide, no login needed) instead.
