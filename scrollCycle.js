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
