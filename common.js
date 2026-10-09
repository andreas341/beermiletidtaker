import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, onValue, set, update };
export function hasStarted(race) {
return Boolean(race.started);
}
// Felles tid: Firebase-serverens klokke, slik at alle enheter viser samme tid
let offset = 0;
onValue(ref(db, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });
export const serverNow = () => Date.now() + offset;

export function onConnection(cb) {
  onValue(ref(db, ".info/connected"), s => cb(Boolean(s.val())));
}
export const netTime = serverNow;
export function fmt(ms) {
  ms = Math.max(0, Number(ms) || 0);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000);
  const s = Math.floor(ms % 60000 / 1000), x = Math.floor(ms % 1000);
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":") + "." + String(x).padStart(3, "0");
}

export const esc = v => String(v).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const isRunning = race => Boolean(race.runningSince);
export const elapsed = (race, now = serverNow()) =>
  (Number(race.elapsed) || 0) + (race.runningSince ? now - race.runningSince : 0);

export const hasFinished = p => p.finishTime !== null && p.finishTime !== undefined;

// Lytter på hele løpet. onError får feilmeldingen hvis lesing blir nektet.
export function watch(cb, onError) {
  onValue(ref(db), snap => {
    const v = snap.val() || {};
    cb({
      race: { started: false, elapsed: 0, runningSince: null, ...(v.race || {}) },
      participants: v.participants || {}
    });
  }, onError);
}
