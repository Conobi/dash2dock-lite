#!/bin/sh
# Reproduces the Clutter destroy_all_children assertion abort in a nested,
# isolated headless shell (see tools/smoke-shell.sh). Runs the working tree
# (not the installed copy) by pointing XDG_DATA_HOME at a private directory
# that symlinks the repo as the extension; the user's session, extensions
# and dconf are never touched.
#
# Usage: tools/crash-repro.sh [ROUNDS] [WINDOW_ROUNDS]   (default 30 / 6)
# Env:   D2DA_SMOKE_LOG  shell log (default /tmp/d2da-crash.log)
# Exit:  0 shell survived all rounds, 1 shell died / assertion seen.
ROUNDS=${1:-30}
WROUNDS=${2:-6}
REPO=$(cd "$(dirname "$0")/.." && pwd)
UUID=dash2dock-lite@icedman.github.com
XDG=$(mktemp -d /tmp/d2da-xdg.XXXXXX)
LOG=${D2DA_SMOKE_LOG:-/tmp/d2da-crash.log}
trap 'rm -rf "$XDG"' EXIT

mkdir -p "$XDG/gnome-shell/extensions"
ln -s "$REPO" "$XDG/gnome-shell/extensions/$UUID"
glib-compile-schemas --strict --targetdir="$REPO/schemas" "$REPO/schemas" || exit 2

D2DA_SMOKE_LOG=$LOG D2DA_SMOKE_SETTLE=$((ROUNDS * 7 + WROUNDS * 12 + 90)) \
	D2DA_SMOKE_SCENARIO="$REPO/tests/smoke_crash_scenario.js" \
	D2DA_SCENARIO_ROUNDS=$ROUNDS D2DA_SCENARIO_WINDOW_ROUNDS=$WROUNDS XDG_DATA_HOME=$XDG \
	"$REPO/tools/smoke-shell.sh" 0 >"$LOG.out" 2>&1
grep -E 'initial state|gnome-shell died|SMOKE' "$LOG.out"
echo "scenario rounds done: $(grep -c 'd2da-scenario round' "$LOG")/$ROUNDS"
if grep -q 'destroy_all_children' "$LOG"; then
	echo "RED: clutter_actor_destroy_all_children assertion"
	exit 1
fi
grep -q 'd2da-scenario done' "$LOG" || { echo "RED: scenario did not finish"; exit 1; }
echo "GREEN"
