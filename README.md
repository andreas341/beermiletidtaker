# Beer Mile tidtaker

To sider som deler data via Firebase Realtime Database:

- `index.html` – offentlig livevisning (alle kan åpne den, ingen innlogging)
- `admin.html` – start/pause, målgang, deltakerliste (krever innlogging)

## 1. Firebase (gjøres én gang)
1. Opprett prosjekt på https://console.firebase.google.com
2. Legg til en **Web-app** og kopier config inn i `firebase-config.js`.
3. Opprett **Realtime Database** (velg gjerne `europe-west1`). Kopier adressen øverst i Data-fanen
   til `databaseURL` i `firebase-config.js`. **Uten denne virker ikke livevisningen.**
4. Authentication → Sign-in method → aktiver **E-post/passord**.
5. Authentication → Users → opprett én adminbruker og kopier **UID**.
6. Lim UID-en inn i `database.rules.json` (erstatt `LIM_INN_ADMIN_UID`).
7. Realtime Database → **Rules** → lim inn innholdet i `database.rules.json` → **Publish**.

## 2. GitHub Pages
1. Last opp alle filene i roten av repoet.
2. Settings → Pages → Deploy from a branch → `main` / `(root)`.
3. Livevisning: `https://BRUKER.github.io/REPO/`  
   Admin: `https://BRUKER.github.io/REPO/admin.html`

## 3. Bruk
Logg inn på admin, last opp `participants.txt`, trykk **Start løpet**.
Trykk **Målgang** per deltaker. Alle enheter bruker Firebase-serverens klokke, så tiden er lik overalt.

## Feilsøking
- Livesiden viser nederst om den har kontakt med serveren.
- Rød feilmelding «Permission denied» ved start: UID-en i reglene er feil eller reglene er ikke publisert.
- Ser du gammel versjon på mobil: åpne siden i privat fane.
