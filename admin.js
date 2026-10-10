import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { app, db, ref, set, update, watch, serverNow, fmt, esc, elapsed, isRunning, hasFinished, hasStarted, netTime } from "./common.js";

const auth = getAuth(app);
const $ = id => document.getElementById(id);
const EMPTY_RACE = { started: false, elapsed: 0, runningSince: null };

let data = { race: { ...EMPTY_RACE }, participants: {} };
let loggedIn = false;

const people = () => Object.values(data.participants).sort((a, b) => a.bib - b.bib);

function showMsg(text) { $("msg").textContent = text; $("msg").classList.remove("hidden"); }
async function run(fn) {
  try { await fn(); $("msg").classList.add("hidden"); }
  catch (err) { showMsg("Ikke lagret: " + err.message + " (sjekk at du er innlogget som admin og at UID-en i reglene stemmer)"); }
}

function render() {
  const race = data.race, running = isRunning(race);
  $("clock").textContent = fmt(elapsed(race));
  $("status").textContent = running ? "Tidtakingen pågår" : race.started ? "Pauset" : "Klar til start";
  $("start").textContent = race.started ? "Fortsett løpet" : "Start løpet";
  $("startAll").disabled = !running || !loggedIn;
  $("start").disabled = running || !loggedIn;
  $("stop").disabled = !running || !loggedIn;
  $("reset").disabled = !loggedIn;

  const q = $("search").value.trim().toLowerCase();
  $("grid").innerHTML = people()
    .filter(p => !q || p.name.toLowerCase().includes(q) || String(p.bib).includes(q))
    .map(p => hasFinished(p)
      ? `<div class="runner done"><span class="bib">${p.bib}</span><b>${esc(p.name)}</b><span class="time">${fmt(netTime(p))}</span></div>`
      : hasStarted(p)
      ? `<div class="runner"><span class="bib">${p.bib}</span><b>${esc(p.name)}</b><span class="muted time">${fmt(p.startTime)}</span><button class="btn small" data-unstart="${p.id}">Angre start</button><button class="btn finish" data-finish="${p.id}">Målgang</button></div>`
      : `<div class="runner"><span class="bib">${p.bib}</span><b>${esc(p.name)}</b><button class="btn small danger" data-remove="${p.id}">Fjern</button><button class="btn primary" data-start="${p.id}">Start</button></div>`)
    .join("");

  const rows = people().filter(hasFinished).sort((a, b) => netTime(a) - netTime(b));
  $("results").innerHTML = rows.map((p, i) =>
    `<tr><td>${i + 1}</td><td>${p.bib}</td><td>${esc(p.name)}</td><td class="r time">${fmt(netTime(p))}</td><td><button class="btn small danger" data-undo="${p.id}">Angre</button></td></tr>`).join("");
  $("empty").hidden = rows.length > 0;
}

onAuthStateChanged(auth, user => {
  loggedIn = Boolean(user);
  $("loginCard").classList.toggle("hidden", loggedIn);
  $("adminArea").classList.toggle("hidden", !loggedIn);
  render();
});

$("login").onclick = async () => {
  try { await signInWithEmailAndPassword(auth, $("email").value, $("password").value); $("msg").classList.add("hidden"); }
  catch (err) { showMsg("Innlogging feilet: " + err.message); }
};
$("logout").onclick = () => signOut(auth);

watch(d => { data = d; render(); }, err => showMsg("Databasefeil: " + err.message));

$("start").onclick = () => run(() => data.race.started
  ? update(ref(db, "race"), { runningSince: serverNow() })
  : update(ref(db, "race"), { started: true, elapsed: 0, runningSince: serverNow() }));
  const t = elapsed(data.race), at = serverNow(), changes = {};
    people().filter(p => !hasStarted(p)).forEach(p => {
      changes[`participants/${p.id}/startTime`] = t;
      changes[`participants/${p.id}/startedAt`] = at;

$("stop").onclick = () => run(() =>
  update(ref(db, "race"), { elapsed: elapsed(data.race), runningSince: null }));

$("reset").onclick = () => {
  if (!confirm("Nullstille løpet og alle målgangstider?")) return;
  const changes = { race: { ...EMPTY_RACE } };
  people().forEach(p => { for (const k of ["finishTime", "startTime", "startedAt"]) changes[`participants/${p.id}/${k}`] = null; });
  run(() => update(ref(db), changes));
};

$("grid").onclick = e => {
  const rm = e.target.closest("[data-remove]");
  if (rm) {
    const p = data.participants[rm.dataset.remove];
    if (p && confirm(`Fjerne ${p.name} (nr ${p.bib})?`)) run(() => set(ref(db, `participants/${rm.dataset.remove}`), null));
    return;
  }
  const st = e.target.closest("[data-start]");
  if (st) {
    if (!isRunning(data.race)) return showMsg("Start løpsklokka først.");
    return run(() => update(ref(db, `participants/${st.dataset.start}`), { startTime: elapsed(data.race), startedAt: serverNow() }));
  }
  const un = e.target.closest("[data-unstart]");
  if (un) return run(() => update(ref(db, `participants/${un.dataset.unstart}`), { startTime: null, startedAt: null }));
  const b = e.target.closest("[data-finish]");
  if (b && isRunning(data.race)) run(() => set(ref(db, `participants/${b.dataset.finish}/finishTime`), elapsed(data.race)));
};
$("results").onclick = e => {
  const b = e.target.closest("[data-undo]");
  if (b) run(() => set(ref(db, `participants/${b.dataset.undo}/finishTime`), null));
};
$("startAll").onclick = () => {
  if (!isRunning(data.race)) return showMsg("Start løpsklokka først.");
  const t = elapsed(data.race), at = serverNow(), changes = {};
  people().filter(p => !hasStarted(p)).forEach(p => {
    changes[`participants/${p.id}/startTime`] = t;
    changes[`participants/${p.id}/startedAt`] = at;
  });
  if (Object.keys(changes).length) run(() => update(ref(db), changes));
};
function addPerson() {
  const name = $("newName").value.trim();
  if (!name) return showMsg("Skriv inn et navn.");
  const bib = Math.max(0, ...people().map(p => p.bib)) + 1;
  const id = `p${bib}`;
  run(async () => {
    await set(ref(db, `participants/${id}`), { id, bib, name, finishTime: null, startTime: null, startedAt: null });
    $("newName").value = "";
  });
}
$("addPerson").onclick = addPerson;
$("newName").onkeydown = e => { if (e.key === "Enter") addPerson(); };
$("search").oninput = render;

$("file").onchange = async () => {
  const file = $("file").files[0];
  if (!file) return;
  if (!confirm("Erstatte deltakerlisten og nullstille løpet?")) { $("file").value = ""; return; }
  const names = (await file.text()).split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith("#"));
  const participants = {};
  names.forEach((name, i) => { participants[`p${i + 1}`] = { id: `p${i + 1}`, bib: i + 1, name, finishTime: null, startTime: null, startedAt: null }; });
  await run(() => update(ref(db), { race: { ...EMPTY_RACE }, participants }));
  $("file").value = "";
};

$("export").onclick = () => {
  const rows = [["Plass", "Nr", "Navn", "Tid"],
    ...people().filter(hasFinished).sort((a, b) => netTime(a) - netTime(b)).map((p, i) => [i + 1, p.bib, p.name, fmt(netTime(p))])];
  const csv = "\uFEFF" + rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "resultater.csv"; a.click(); URL.revokeObjectURL(a.href);
};

// Kun klokken oppdateres ofte, så knapper ikke tegnes på nytt midt i et trykk
setInterval(() => { $("clock").textContent = fmt(elapsed(data.race)); }, 100);
render();
