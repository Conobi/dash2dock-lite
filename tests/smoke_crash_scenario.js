// Smoke scenario: churn the Shell Dash so Dash._redisplay destroys items
// (overview hidden => item.destroy(), not animateOutAndDestroy()).
// Loaded by probe.js via D2DA_SMOKE_SCENARIO; isolated nested shell only.
// Includes a virtual-pointer drag reorder: the dropped icon is hovered when
// Dash._redisplay destroys it, which used to abort the shell.
// A clutter assertion aborts the shell, which tools/crash-repro.sh reports.
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';

const POOL = [
  'kitty.desktop',
  'firefox.desktop',
  'htop.desktop',
  'micro.desktop',
  'chromium.desktop',
  'filezilla.desktop',
];
const ROUNDS = Number(GLib.getenv('D2DA_SCENARIO_ROUNDS') ?? 30);
const WINDOW_ROUNDS = Number(GLib.getenv('D2DA_SCENARIO_WINDOW_ROUNDS') ?? 6);
const DRAG_ROUNDS = Number(GLib.getenv('D2DA_SCENARIO_DRAG_ROUNDS') ?? 8);
const STEP_MS = 250;

function sleep(ms) {
  return new Promise((resolve) =>
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    })
  );
}

/**
 * Drags the first dock app icon over the last one with a virtual pointer
 * (reorders favorites through the Dash's own drag-and-drop).
 *
 * @param {object} ext the extension instance
 */
async function dragReorder(ext) {
  const dock = ext.docks?.[0];
  const apps = (dock?._icons ?? []).filter((c) => c._appwell);
  if (apps.length < 2) {
    console.log('d2da-scenario: fewer than 2 dock icons, drag skipped');
    return;
  }
  const center = (c) => {
    const [x, y] = c._appwell.get_transformed_position();
    const [w, h] = c._appwell.get_transformed_size();
    return [x + w / 2, y + h / 2];
  };
  const [x0, y0] = center(apps[0]);
  const [x1, y1] = center(apps[apps.length - 1]);
  const seat = global.stage.context.get_backend().get_default_seat();
  const dev = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
  const now = () => GLib.get_monotonic_time();
  dev.notify_absolute_motion(now(), x0, y0);
  await sleep(150);
  dev.notify_button(now(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED);
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await sleep(60);
    dev.notify_absolute_motion(
      now(),
      x0 + ((x1 - x0) * i) / steps,
      y0 + ((y1 - y0) * i) / steps
    );
  }
  await sleep(200);
  dev.notify_button(now(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED);
  await sleep(600);
}

/**
 * Opens and closes real app windows (running-app items appear and are
 * destroyed by Dash._redisplay), optionally while the app is a favorite.
 *
 * @param {string} id desktop file id of an installed GUI app
 * @param {boolean} favorite pin the app first, so it survives as a favorite
 */
async function churnWindow(id, favorite) {
  const favs = AppFavorites.getAppFavorites();
  const app = Shell.AppSystem.get_default().lookup_app(id);
  if (!app) {
    console.log(`d2da-scenario: ${id} not installed, skipped`);
    return;
  }
  if (favorite) {
    favs.addFavorite(id);
  }
  app.activate();
  await sleep(3000);
  for (const w of app.get_windows()) {
    w.delete(global.get_current_time());
  }
  await sleep(1500);
  if (favorite) {
    favs.removeFavorite(id);
  }
  await sleep(STEP_MS);
}

/**
 * Adds, reorders and removes favorites, letting _redisplay run each time.
 *
 * @param {object} ext the extension instance
 */
export async function run(ext) {

  const favs = AppFavorites.getAppFavorites();
  // first-run dialogs (distro welcome) would swallow the virtual pointer
  for (const d of Main.layoutManager.modalDialogGroup.get_children()) {
    d.close?.();
  }
  await sleep(1500);
  for (let round = 0; round < ROUNDS; round++) {
    for (const id of POOL) {
      favs.addFavorite(id);
      await sleep(STEP_MS);
    }
    favs.moveFavoriteToPos(POOL[3], 0);
    await sleep(STEP_MS);
    for (const id of POOL) {
      favs.removeFavorite(id);
      await sleep(STEP_MS);
    }
    console.log(`d2da-scenario round ${round + 1}/${ROUNDS}`);
  }
  for (const id of POOL.slice(0, 3)) {
    favs.addFavorite(id);
  }
  await sleep(1500);
  for (let i = 0; i < DRAG_ROUNDS; i++) {
    await dragReorder(ext);
    const order = favs.getFavorites().map((a) => a.get_id());
    console.log(`d2da-scenario drag round ${i + 1}/${DRAG_ROUNDS} ${order}`);
  }
  for (let i = 0; i < WINDOW_ROUNDS; i++) {
    await churnWindow('org.gnome.TextEditor.desktop', i % 2 === 1);
    await churnWindow('kitty.desktop', false);
    console.log(`d2da-scenario window round ${i + 1}/${WINDOW_ROUNDS}`);
  }
  console.log('d2da-scenario done');
}
