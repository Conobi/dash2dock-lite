// gjs -m tests/scroll_cycle_check.js — scroll window-cycling logic checks. Exits 1 on failure.
import System from 'system';

import { nextWindowIndex, throttleMs, shouldThrottle, scrollStep, initialScrollState } from '../scrollCycle.js';

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

// scrollStep
const A = {};
const B = {};
function feed(events) {
  // events: [kind, delta, target, nowMs][]; returns last result
  let state = initialScrollState();
  let r = null;
  for (const [kind, delta, target, nowMs] of events) {
    r = scrollStep(kind, delta, state, target, nowMs);
    state = r.state;
  }
  return r;
}

check(feed([['prev', 0, A, 0]]).step === -1, 'discrete prev -> -1');
check(feed([['next', 0, A, 0]]).step === 1, 'discrete next -> +1');
check(feed([['bogus', 0, A, 0]]).step === 0, 'unknown kind -> 0');

let r = feed([['smooth', 0.4, A, 0], ['smooth', 0.4, A, 10]]);
check(r.step === 0 && Math.abs(r.state.acc - 0.8) < 1e-9, 'smooth below 1 accumulates, no step');
r = feed([['smooth', 0.4, A, 0], ['smooth', 0.4, A, 10], ['smooth', 0.4, A, 20]]);
check(r.step === 1 && r.state.acc === 0, 'smooth reaching 1 -> +1 and acc reset');
r = feed([['smooth', -0.6, A, 0], ['smooth', -0.6, A, 10]]);
check(r.step === -1 && r.state.acc === 0, 'negative smooth -> -1');
r = feed([['smooth', 2.5, A, 0]]);
check(r.step === 1 && r.state.acc === 0, 'large delta -> one step, overshoot dropped');

r = feed([['smooth', 0.8, A, 0], ['smooth', 0.5, B, 10]]);
check(r.step === 0 && r.state.acc === 0.5, 'target change resets acc');
r = feed([['smooth', 0.8, A, 0], ['smooth', 0.5, A, 501]]);
check(r.step === 0 && r.state.acc === 0.5, 'idle > 500 ms resets acc');
r = feed([['smooth', 0.8, A, 0], ['smooth', 0.5, A, 500]]);
check(r.step === 1, 'idle exactly 500 ms keeps acc');

r = feed([['smooth', 0.8, A, 0], ['smooth', NaN, A, 10]]);
check(r.step === 0 && r.state.acc === 0.8, 'NaN delta ignored');
r = feed([['smooth', 0.8, A, 0], ['smooth', Infinity, A, 10]]);
check(r.step === 0 && r.state.acc === 0.8, 'Infinity delta ignored');
r = feed([['smooth', 0.8, A, 0], ['next', 0, A, 10]]);
check(r.step === 1 && r.state.acc === 0, 'discrete event resets acc');
check(r.state.lastTarget === A && r.state.lastEventMs === 10, 'state records target and time');

const s0 = { acc: 0.5, lastEventMs: 0, lastTarget: A };
scrollStep('smooth', 0.7, s0, A, 10);
check(s0.acc === 0.5 && s0.lastEventMs === 0, 'input state not mutated');

if (failures > 0) {
  print(`${failures} failure(s)`);
  System.exit(1);
}
print('all ok');
