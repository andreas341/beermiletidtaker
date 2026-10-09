import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
await setPersistence(auth, browserLocalPersistence);

const $ = id => document.getElementById(id);

let data = { race: { started: false, elapsed: 0, runningSince: null }, participants: {} };
let databaseLoaded = false;

const e = {
  gmt: $("gmt"), loginCard: $("loginCard"), adminArea: $("adminArea"),
  loginError: $("loginError"), email: $("email"), password: $("password"),
  login: $("login"), logout: $("logout"), clock: $("clock"), status: $("status"),
  start: $("start"), stop: $("stop"), reset: $("reset"), search: $("search"),
  file: $("file"), grid: $("grid"), results: $("results"), empty: $("empty"), export: $("export")
};

function fmt(ms) {
  ms = Math.max(0, Number(ms) || 0);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000), x = Math.floor(ms % 1000);
  return [h,m,s].map(v => String(v).padStart(2,"0")).join(":") + "." + String(x).padStart(3,"0");
}
function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
}
function running() { return Boolean(data.race?.runningSince); }
function elapsed(now = Date.now()) {
  const race = data.race || {};
  return (Number(race.elapsed) || 0) + (race.runningSince ? now - race.runningSince : 0);
}
function people() { return Object.values(data.participants || {}).sort((a,b) => a.bib - b.bib); }
function resultList() {
  return people().filter(p => p.finishTime !== null && p.finishTime !== undefined).sort((a,b) => a.finishTime - b.finishTime);
}

function render() {
  const race = data.race || {}, run = running();
  e.clock.textContent = fmt(elapsed());
  e.status.textContent = run ? "Tidtakingen pågår" : race.started ? "Pauset. Trykk Fortsett løpet." : "Klar til start";
  e.start.textContent = run ? "Løpet pågår" : race.started ? "Fortsett løpet" : "Start løpet";
  e.start.disabled = run || !databaseLoaded;
  e.stop.disabled = !run || !databaseLoaded;
  e.reset.disabled = !databaseLoaded;

  const q = e.search.value.trim().toLowerCase();
  e.grid.innerHTML = people().filter(p => !q || p.name.toLowerCase().includes(q) || String(p.bib).includes(q)).map(p => {
    const done = p.finishTime !== null && p.finishTime !== undefined;
    return `<article class="participant ${done ? "done" : ""}"><div class="person"><span class="bib">${p.bib}</span><b class="name">${esc(p.name)}</b></div>${done ? `<span class="time">${fmt(p.finishTime)}</span>` : `<button class="finish" data-finish="${p.id}">Målgang</button>`}</article>`;
  }).join("");

  const rows = resultList();
  e.results.innerHTML = rows.map((p,i) => `<tr><td>${i+1}</td><td>${p.bib}</td><td>${esc(p.name)}</td><td class="time">${fmt(p.finishTime)}</td><td><button class="danger" data-undo="${p.id}">Angre</button></td></tr>`).join("");
  e.empty.hidden = rows.length > 0;
}

onAuthStateChanged(auth, user => {
  e.loginCard.classList.toggle("hidden", Boolean(user));
  e.adminArea.classList.toggle("hidden", !user);
});

e.login.onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, e.email.value, e.password.value);
    e.loginError.classList.add("hidden");
  } catch (error) {
    e.loginError.textContent = "Innlogging feilet: " + error.message;
    e.loginError.classList.remove("hidden");
  }
};

e.logout.onclick = () => signOut(auth);

onValue(ref(db), snapshot => {
  const value = snapshot.val();
  data = value || { race: { started:false, elapsed:0, runningSince:null }, participants:{} };
  data.race ||= { started:false, elapsed:0, runningSince:null };
  data.participants ||= {};
  databaseLoaded = true;
  render();
}, error => {
  databaseLoaded = false;
  e.loginError.textContent = "Databasefeil: " + error.message;
  e.loginError.classList.remove("hidden");
  render();
});

e.start.onclick = async () => {
  if (!databaseLoaded) return;
  if (!data.race?.started) {
    await update(ref(db, "race"), { started:true, elapsed:0, runningSince:Date.now() });
  } else if (!running()) {
    await update(ref(db, "race"), { runningSince:Date.now() });
  }
};

e.stop.onclick = async () => {
  if (!running()) return;
  await update(ref(db, "race"), { elapsed:elapsed(), runningSince:null });
};

e.reset.onclick = async () => {
  if (!confirm("Slette løpet og alle målgangstider?")) return;
  const changes = { race:{ started:false, elapsed:0, runningSince:null } };
  people().forEach(p => changes[`participants/${p.id}/finishTime`] = null);
  await update(ref(db), changes);
};

e.grid.onclick = async event => {
  const button = event.target.closest("[data-finish]");
  if (button && running()) await set(ref(db, `participants/${button.dataset.finish}/finishTime`), elapsed());
};

e.results.onclick = async event => {
  const button = event.target.closest("[data-undo]");
  if (button) await set(ref(db, `participants/${button.dataset.undo}/finishTime`), null);
};

e.search.oninput = render;

e.file.onchange = async () => {
  const file = e.file.files[0];
  if (!file) return;
  if (!confirm("Erstatte deltakerlisten og nullstille løpet?")) { e.file.value = ""; return; }
  const names = (await file.text()).split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith("#"));
  const newParticipants = {};
  names.forEach((name,i) => {
    const id = `p${i+1}`;
    newParticipants[id] = { id, bib:i+1, name, finishTime:null };
  });
  await set(ref(db), { race:{ started:false, elapsed:0, runningSince:null }, participants:newParticipants });
  e.file.value = "";
};

e.export.onclick = () => {
  const rows = [["Plass","Startnummer","Navn","Tid"], ...resultList().map((p,i) => [i+1,p.bib,p.name,fmt(p.finishTime)])];
  const csv = "\uFEFF" + rows.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url; link.download = "resultater.csv"; link.click(); URL.revokeObjectURL(url);
};

setInterval(() => {
  e.gmt.textContent = new Date().toUTCString();
  if (running()) e.clock.textContent = fmt(elapsed());
}, 100);
render();
