import { watch, onConnection, serverNow, fmt, esc, elapsed, isRunning, hasFinished } from "./common.js";

const $ = id => document.getElementById(id);
let data = { race: { started: false, elapsed: 0, runningSince: null }, participants: {} };

function render() {
  const race = data.race, run = isRunning(race);
  $("clock").textContent = fmt(elapsed(race));
  $("status").textContent = run ? "Løpet pågår" : race.started ? "Tidtakingen er pauset" : "Venter på start";
  $("indicator").textContent = run ? "LIVE" : race.started ? "Pauset" : "Ikke startet";
  $("indicator").className = "pill " + (run ? "live" : "idle");

  const rows = Object.values(data.participants).filter(hasFinished).sort((a, b) => a.finishTime - b.finishTime);
  $("results").innerHTML = rows.map((p, i) =>
    `<tr><td>${i + 1}</td><td>${p.bib}</td><td>${esc(p.name)}</td><td class="r time">${fmt(p.finishTime)}</td></tr>`).join("");
  $("empty").hidden = rows.length > 0;
}

watch(d => { data = d; $("notice").classList.add("hidden"); render(); }, err => {
  $("notice").textContent = "Får ikke lese fra databasen: " + err.message;
  $("notice").classList.remove("hidden");
});

onConnection(ok => { $("conn").textContent = ok ? "Tilkoblet – oppdateres live" : "Ingen kontakt med serveren"; });

setInterval(render, 100);
render();
