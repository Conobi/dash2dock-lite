// Pure decision logic for cycling an app's windows by scrolling over its dock
// icon (modelled on Plank). No GI imports, so it runs under plain `gjs -m`.
// Only `function` declarations are exported: the legacy (GNOME 42-44)
// transpiler exposes top-level functions via Me.imports but not consts.

/**
 * Index of the window to activate after one scroll step.
 *
 * With no focused window (focusedIndex outside [0, n)), both directions go to
 * the first window, as in Plank. Wraps at both ends.
 * Returns -1 when n <= 0 (nothing to activate).
 */
export function nextWindowIndex(n, focusedIndex, step) {
  if (!(n > 0)) {
    return -1;
  }
  if (!(focusedIndex >= 0 && focusedIndex < n)) {
    return 0;
  }
  const d = step < 0 ? -1 : 1;
  return (((focusedIndex + d) % n) + n) % n;
}

const DEFAULT_SENSITIVITY = 0.4;
const MAX_THROTTLE_MS = 500;
const MIN_THROTTLE_MS = 50;

/**
 * Minimum delay between two window switches, from the `scroll-sensitivity`
 * setting (0..1, higher = faster). The default 0.4 gives Plank's 300 ms.
 * Non-number or NaN input falls back to the default; values are clamped.
 */
export function throttleMs(sensitivity) {
  let s =
    typeof sensitivity === 'number' && !Number.isNaN(sensitivity)
      ? sensitivity
      : DEFAULT_SENSITIVITY;
  s = Math.min(1, Math.max(0, s));
  return Math.round(Math.max(MIN_THROTTLE_MS, MAX_THROTTLE_MS * (1 - s)));
}

/**
 * Whether a step must be dropped because the last switch was too recent.
 * lastSwitchMs is null before the first switch. A step exactly T ms later passes.
 */
export function shouldThrottle(lastSwitchMs, nowMs, sensitivity) {
  if (lastSwitchMs === null) {
    return false;
  }
  return nowMs - lastSwitchMs < throttleMs(sensitivity);
}
