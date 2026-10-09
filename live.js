import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let data = {
  race: {
    started: false,
    elapsed: 0,
    runningSince: null
  },
  participants: {}
};

const elements = {
  gmt: document.getElementById("gmt"),
  clock: document.getElementById("clock"),
  status: document.getElementById("status"),
  indicator: document.getElementById("indicator"),
  results: document.getElementById("results"),
  empty: document.getElementById("empty"),
  updated: document.getElementById("updated"),
  notice: document.getElementById("notice")
};

function formatTime(milliseconds) {
  milliseconds = Math.max(0, Number(milliseconds) || 0);

  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const ms = Math.floor(milliseconds % 1000);

  return [hours, minutes, seconds]
    .map(value => String(value).padStart(2, "0"))
    .join(":") + "." + String(ms).padStart(3, "0");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function elapsedTime(now = Date.now()) {
  const race = data.race || {};
  const savedElapsed = Number(race.elapsed) || 0;
  const currentPeriod = race.runningSince ? now - race.runningSince : 0;
  return savedElapsed + currentPeriod;
}

function render() {
  const now = Date.now();
  const race = data.race || {};
  const running = Boolean(race.runningSince);

  elements.gmt.textContent = new Date(now).toUTCString();
  elements.clock.textContent = formatTime(elapsedTime(now));

  if (running) {
    elements.status.textContent = "Løpet pågår";
    elements.indicator.textContent = "LIVE";
  } else if (race.started) {
    elements.status.textContent = "Tidtakingen er pauset";
    elements.indicator.textContent = "Pauset";
  } else {
    elements.status.textContent = "Venter på start";
    elements.indicator.textContent = "Ikke startet";
  }

  elements.indicator.classList.toggle("paused", !running);

  const resultList = Object.values(data.participants || {})
    .filter(person =>
      person.finishTime !== null &&
      person.finishTime !== undefined
    )
    .sort((a, b) => a.finishTime - b.finishTime);

  elements.results.innerHTML = resultList
    .map((person, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${person.bib}</td>
        <td>${escapeHtml(person.name)}</td>
        <td class="time">${formatTime(person.finishTime)}</td>
      </tr>
    `)
    .join("");

  elements.empty.hidden = resultList.length > 0;
  elements.updated.textContent =
    "Oppdatert " + new Date(now).toLocaleTimeString("nb-NO");
}

onValue(
  ref(db),
  snapshot => {
    const firebaseData = snapshot.val();
    if (firebaseData) {
      data = firebaseData;
    } else {
      data = {
        race: {
          started: false,
          elapsed: 0,
          runningSince: null
        },
        participants: {}
      };
    }

    elements.notice.classList.add("hidden");
    render();
  },
  error => {
    elements.notice.textContent =
      "Kunne ikke hente live-data: " + error.message;
    elements.notice.classList.remove("hidden");
  }
);

// Render every 100ms to keep clock and results fresh
setInterval(render, 100);
render();
