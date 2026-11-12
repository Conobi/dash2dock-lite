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

const SCROLL_IDLE_RESET_MS = 500;

/** Empty state for scrollStep: no accumulated delta, no previous event. */
export function initialScrollState() {
  return { acc: 0, lastEventMs: null, lastTarget: null };
}

/**
 * Turn one scroll event into at most one cycling step (-1 prev, +1 next, 0 none).
 *
 * kind is 'prev' | 'next' (wheel clicks) or 'smooth' (touchpad; `delta` is the
 * scroll delta, positive = down/right). Smooth deltas accumulate until |acc|
 * reaches 1; the overshoot is dropped so one event never yields more than one
 * step. The accumulator resets when the target differs (compared with ===)
 * or after more than 500 ms without events; discrete events also reset it.
 * Non-finite deltas are ignored. Returns a new state; the input is not mutated.
 */
export function scrollStep(kind, delta, state, target, nowMs) {
  const stale =
    target !== state.lastTarget ||
    state.lastEventMs === null ||
    nowMs - state.lastEventMs > SCROLL_IDLE_RESET_MS;
  let acc = stale ? 0 : state.acc;
  let step = 0;

  if (kind === 'prev' || kind === 'next') {
    step = kind === 'prev' ? -1 : 1;
    acc = 0;
  } else if (kind === 'smooth' && Number.isFinite(delta)) {
    acc += delta;
    if (Math.abs(acc) >= 1) {
      step = Math.sign(acc);
      acc = 0;
    }
  }

  return { step, state: { acc, lastEventMs: nowMs, lastTarget: target } };
}
