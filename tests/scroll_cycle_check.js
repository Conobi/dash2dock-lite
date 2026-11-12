// gjs -m tests/scroll_cycle_check.js — scroll window-cycling logic checks. Exits 1 on failure.
import System from 'system';

import { nextWindowIndex, throttleMs, shouldThrottle } from '../scrollCycle.js';

let failures = 0;
function check(cond, msg) {
  print(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) {
    failures++;
  }
}

// nextWindowIndex
check(nextWindowIndex(3, -1, 1) === 0, 'no focus, next -> first');
check(nextWindowIndex(3, -1, -1) === 0, 'no focus, prev -> first');
check(nextWindowIndex(3, 0, 1) === 1, 'next from 0 -> 1');
check(nextWindowIndex(3, 1, -1) === 0, 'prev from 1 -> 0');
check(nextWindowIndex(3, 2, 1) === 0, 'next wraps last -> first');
check(nextWindowIndex(3, 0, -1) === 2, 'prev wraps first -> last');
check(nextWindowIndex(1, 0, 1) === 0, 'single window, next -> 0');
check(nextWindowIndex(1, 0, -1) === 0, 'single window, prev -> 0');
check(nextWindowIndex(0, -1, 1) === -1, 'empty list -> -1');
check(nextWindowIndex(3, 5, 1) === 0, 'out-of-range focus treated as none');

// throttleMs: max(50, 500 * (1 - s)), s clamped to [0, 1], default 0.4
check(throttleMs(0) === 500, 'throttle s=0 -> 500');
check(throttleMs(0.4) === 300, 'throttle s=0.4 -> 300 (Plank default)');
check(throttleMs(1) === 50, 'throttle s=1 -> 50 floor');
check(throttleMs(-1) === 500, 'throttle clamps s<0');
check(throttleMs(2) === 50, 'throttle clamps s>1');
check(throttleMs(NaN) === 300, 'throttle NaN -> default');
check(throttleMs(undefined) === 300, 'throttle undefined -> default');
check(throttleMs('0.9') === 300, 'throttle non-number -> default');

// shouldThrottle
check(shouldThrottle(null, 0, 0.4) === false, 'never switched -> not throttled');
check(shouldThrottle(1000, 1299, 0.4) === true, 'inside window -> throttled');
check(shouldThrottle(1000, 1300, 0.4) === false, 'exactly T -> passes');

if (failures > 0) {
  print(`${failures} failure(s)`);
  System.exit(1);
}
print('all ok');
