#!/bin/sh
# Hover-geometry check for multi-monitor setups (nested headless shell).
#
# Boots an isolated gnome-shell (memory GSettings, private XDG_DATA_HOME
# holding a copy of this worktree, private D-Bus session) with two 1920x1080
# virtual monitors, moves them to the requested layout, enables the extension
# with D2DA_SMOKE_SETTINGS, and prints one `d2da-hover` line per dock.
# Exit 0 only if every dock judged a pointer on its own icons as "within".
#
# Usage: tools/hover-shell.sh PRIMARY_X,PRIMARY_Y SECOND_X,SECOND_Y
# Env:   D2DA_SMOKE_SETTINGS  'key=value ...' (GVariant text), as smoke-shell.sh
#        D2DA_HOVER_LOG       shell log (default /tmp/d2da-hover.log)
# Never touches the user's session, dconf or installed extensions.

UUID=dash2dock-lite@icedman.github.com
REPO=$(cd "$(dirname "$0")/.." && pwd)
LOG=${D2DA_HOVER_LOG:-/tmp/d2da-hover.log}

if [ -z "$D2DA_HOVER_INNER" ]; then
	[ $# -eq 2 ] || { echo "usage: $0 PX,PY SX,SY"; exit 2; }
	D2DA_HOVER_INNER=1 exec dbus-run-session -- "$0" "$@" 2>"$LOG.bus"
fi

DATA=$(mktemp -d /tmp/d2da-hover-data.XXXXXX)
mkdir -p "$DATA/gnome-shell/extensions/$UUID"
(cd "$REPO" && tar --exclude=.git --exclude=node_modules -cf - .) |
	tar -xf - -C "$DATA/gnome-shell/extensions/$UUID"

: >"$LOG"
rm -f "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/gnome-shell-disable-extensions"
XDG_DATA_HOME=$DATA D2DA_PROBE=1 D2DA_PROBE_HOVER=1 \
	D2DA_SMOKE_SETTINGS=$D2DA_SMOKE_SETTINGS GSETTINGS_BACKEND=memory \
	gnome-shell --headless --no-x11 \
	--virtual-monitor 1920x1080 --virtual-monitor 1920x1080 >>"$LOG" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; wait $PID 2>/dev/null; rm -rf "$DATA"' EXIT

i=0
until gnome-extensions list >/dev/null 2>&1; do
	i=$((i + 1))
	[ $i -gt 60 ] && { echo "FAIL: shell did not start"; exit 2; }
	sleep 0.5
done

/usr/bin/python3 - "$1" "$2" <<'PY' || exit 2
import sys
from gi.repository import Gio, GLib
bus = Gio.bus_get_sync(Gio.BusType.SESSION)
def call(m, args=None, t=None):
    return bus.call_sync('org.gnome.Mutter.DisplayConfig',
        '/org/gnome/Mutter/DisplayConfig', 'org.gnome.Mutter.DisplayConfig',
        m, args, t, Gio.DBusCallFlags.NONE, 5000, None)
serial, mons, _, _ = call('GetCurrentState').unpack()
assert len(mons) == 2, mons
lms = []
for n, (mon, xy) in enumerate(zip(mons, sys.argv[1:3])):
    x, y = map(int, xy.split(','))
    conn = mon[0][0]
    mode = next(m[0] for m in mon[1] if m[1] == 1920 and m[2] == 1080)
    lms.append((x, y, 1.0, 0, n == 0, [(conn, mode, {})]))
call('ApplyMonitorsConfig', GLib.Variant('(uua(iiduba(ssa{sv}))a{sv})',
     (serial, 1, lms, {})))
print('layout applied:', [(l[0], l[1], l[4]) for l in lms])
PY

gnome-extensions enable "$UUID"
sleep 14
grep -c 'dash2dock-lite enabled' "$LOG" | sed 's/^/enabled msgs: /'
grep 'd2da-hover' "$LOG" | sed 's/.*d2da-hover //'
BAD=$(grep 'd2da-hover' "$LOG" | grep -c '"isWithin":false')
GOT=$(grep -c 'd2da-hover' "$LOG")
echo "docks reported: $GOT; isWithin=false: $BAD"
[ "$GOT" -gt 0 ] && [ "$BAD" -eq 0 ]
