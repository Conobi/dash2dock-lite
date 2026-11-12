// gjs -m tests/scroll_cycle_check.js — scroll window-cycling logic checks. Exits 1 on failure.
import System from 'system';

import { nextWindowIndex } from '../scrollCycle.js';

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

if (failures > 0) {
  print(`${failures} failure(s)`);
  System.exit(1);
}
print('all ok');
