import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  update
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = id => document.getElementById(id);

let data = {
  race: { started: false, elapsed: 0, runningSince: null },
  participants: {}
};

const e = {
  gmt: $("gmt"),
  loginCard: $("loginCard"),
  adminArea: $("adminArea"),
  loginError: $("loginError"),
  email: $("email"),
  password: $("password"),
  login: $("login"),
  logout: $("logout"),
  clock: $("clock"),
  status: $("status"),
  start: $("start"),
  stop: $("stop"),
  reset: $("reset"),
  search: $("search"),
  file: $("file"),
  grid: $("grid"),
  results: $("results"),
  empty: $("empty"),
  export: $("export")
};

function formatTime(ms) {
  ms = Math.max(0, Number(ms) || 0);
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);

  return [hours, minutes, seconds]
    .map(value => String(value).padStart(2, "0"))
    .join(":") + "." + String(milliseconds).padStart(3, "0");
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

function isRunning() {
  return Boolean(data.race?.runningSince);
}

function elapsedTime(now = Date.now()) {
  const race = data.race || {};
  return (Number(race.elapsed) || 0) +
    (race.runningSince ? now - race.runningSince : 0);
}

function participants() {
  return Object.values(data.participants || {})
    .sort((a, b) => a.bib - b.bib);
}

function resultList() {
  return participants()
    .filter(person => person.finishTime !== null && person.finishTime !== undefined)
    .sort((a, b) => a.finishTime - b.finishTime);
}

function render() {
  const race = data.race || {};
  const running = isRunning();

  e.clock.textContent = formatTime(elapsedTime());
  e.status.textContent = running
    ? "Tidtakingen pågår"
    : race.started
      ? "Pauset. Trykk Fortsett løpet."
      : "Klar til start";

  e.start.textContent = running
    ? "Løpet pågår"
    : race.started
      ? "Fortsett løpet"
      : "Start løpet";

  e.start.disabled = running;
  e.stop.disabled = !running;

  const query = e.search.value.trim().toLowerCase();

  e.grid.innerHTML = participants()
    .filter(person =>
      !query ||
      person.name.toLowerCase().includes(query) ||
      String(person.bib).includes(query)
    )
    .map(person => {
      const finished = person.finishTime !== null && person.finishTime !== undefined;

      return `
        <article class="participant ${finished ? "done" : ""}">
          <div class="person">
            <span class="bib">${person.bib}</span>
            <b class="name">${escapeHtml(person.name)}</b>
          </div>
          ${finished
            ? `<span class="time">${formatTime(person.finishTime)}</span>`
            : `<button class="green" data-finish="${person.id}" ${running ? "" : "disabled"}>I mål</button>`}
        </article>
      `;
    })
    .join("");

  const rows = resultList();

  e.results.innerHTML = rows
    .map((person, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${person.bib}</td>
        <td>${escapeHtml(person.name)}</td>
        <td class="time">${formatTime(person.finishTime)}</td>
        <td><button class="danger" data-undo="${person.id}">Angre</button></td>
      </tr>
    `)
    .join("");

  e.empty.hidden = rows.length > 0;
}

onAuthStateChanged(auth, user => {
  e.loginCard.classList.toggle("hidden", Boolean(user));
  e.adminArea.classList.toggle("hidden", !user);
});

e.login.addEventListener("click", async () => {
  try {
    await signInWithEmailAndPassword(auth, e.email.value, e.password.value);
    e.loginError.classList.add("hidden");
  } catch (error) {
    e.loginError.textContent = "Innlogging feilet: " + error.message;
    e.loginError.classList.remove("hidden");
  }
});

e.logout.addEventListener("click", () => signOut(auth));

onValue(ref(db), snapshot => {
  data = snapshot.val() || data;
  render();
});

e.start.addEventListener("click", async () => {
  if (!data.race?.started) {
    await set(ref(db, "race"), {
      started: true,
      elapsed: 0,
      runningSince: Date.now()
    });
  } else if (!isRunning()) {
    await update(ref(db, "race"), {
      runningSince: Date.now()
    });
  }
});

e.stop.addEventListener("click", async () => {
  if (!isRunning()) return;

  await update(ref(db, "race"), {
    elapsed: elapsedTime(),
    runningSince: null
  });
});

e.reset.addEventListener("click", async () => {
  if (!confirm("Slette løpet og alle målgangstider?")) return;

  const updates = {
    race: {
      started: false,
      elapsed: 0,
      runningSince: null
    }
  };

  participants().forEach(person => {
    updates[`participants/${person.id}/finishTime`] = null;
  });

  await update(ref(db), updates);
});

e.grid.addEventListener("click", async event => {
  const button = event.target.closest("[data-finish]");
  if (!button || !isRunning()) return;

  await set(
    ref(db, `participants/${button.dataset.finish}/finishTime`),
    elapsedTime()
  );
});

e.results.addEventListener("click", async event => {
  const button = event.target.closest("[data-undo]");
  if (!button) return;

  await set(
    ref(db, `participants/${button.dataset.undo}/finishTime`),
    null
  );
});

e.search.addEventListener("input", render);

e.file.addEventListener("change", async () => {
  const file = e.file.files[0];
  if (!file) return;

  if (!confirm("Erstatte deltakerlisten og nullstille løpet?")) {
    e.file.value = "";
    return;
  }

  const names = (await file.text())
    .split(/\r?\n/)
    .map(name => name.trim())
    .filter(name => name && !name.startsWith("#"));

  const newParticipants = {};

  names.forEach((name, index) => {
    const id = `p${index + 1}`;
    newParticipants[id] = {
      id,
      bib: index + 1,
      name,
      finishTime: null
    };
  });

  await set(ref(db), {
    race: {
      started: false,
      elapsed: 0,
      runningSince: null
    },
    participants: newParticipants
  });

  e.file.value = "";
});

e.export.addEventListener("click", () => {
  const rows = [
    ["Plass", "Startnummer", "Navn", "Tid"],
    ...resultList().map((person, index) => [
      index + 1,
      person.bib,
      person.name,
      formatTime(person.finishTime)
    ])
  ];

  const csv = "\uFEFF" + rows
    .map(row => row
      .map(value => `"${String(value).replace(/"/g, '""')}"`)
      .join(";"))
    .join("\r\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = "resultater.csv";
  link.click();
  URL.revokeObjectURL(url);
});

setInterval(() => {
  e.gmt.textContent = new Date().toUTCString();
  if (isRunning()) {
    e.clock.textContent = formatTime(elapsedTime());
  }
}, 100);

render();
