import { watch, onConnection, fmt, esc, elapsed, isRunning, hasFinished, hasStarted, netTime, clockTime } from "./common.js";

const $ = id => document.getElementById(id);
let data = { race: { started: false, elapsed: 0, runningSince: null }, participants: {} };

function render() {
  const race = data.race, run = isRunning(race);
  $("clock").textContent = fmt(elapsed(race));
  $("status").textContent = run ? "Løpet pågår" : race.started ? "Tidtakingen er pauset" : "Venter på start";
  $("indicator").textContent = run ? "LIVE" : race.started ? "Pauset" : "Ikke startet";
  $("indicator").className = "pill " + (run ? "live" : "idle");

  const all = Object.values(data.participants);
  const starters = all.filter(hasStarted).sort((a, b) => a.startTime - b.startTime || a.bib - b.bib);
  $("started").innerHTML = starters.map(p =>
    `<tr><td>${p.bib}</td><td>${esc(p.name)}</td><td class="time">${fmt(p.startTime)}</td><td>${p.startedAt ? clockTime(p.startedAt) : "–"}</td><td class="r">${hasFinished(p) ? "I mål" : "Underveis"}</td></tr>`).join("");
  $("startedEmpty").hidden = starters.length > 0;

  const rows = all.filter(hasFinished).sort((a, b) => netTime(a) - netTime(b));
  $("results").innerHTML = rows.map((p, i) =>
    `<tr><td>${i + 1}</td><td>${p.bib}</td><td>${esc(p.name)}</td><td class="r time">${fmt(netTime(p))}</td></tr>`).join("");
  $("empty").hidden = rows.length > 0;
}

watch(d => { data = d; $("notice").classList.add("hidden"); render(); }, err => {
  $("notice").textContent = "Får ikke lese fra databasen: " + err.message;
  $("notice").classList.remove("hidden");
});

onConnection(ok => { $("conn").textContent = ok ? "Tilkoblet – oppdateres live" : "Ingen kontakt med serveren"; });

setInterval(render, 100);
render();
