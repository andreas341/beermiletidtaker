# Beer Mile global tidtaker

Dette er en statisk GitHub Pages-side med Firebase Realtime Database og Firebase Authentication.

## 1. Opprett Firebase-prosjekt

1. Gå til https://console.firebase.google.com og opprett et prosjekt.
2. Legg til en Web App.
3. Kopier konfigurasjonen inn i `firebase-config.js`.
4. Opprett Realtime Database. Velg helst region `europe-west1`.
5. Under Authentication > Sign-in method aktiverer du Email/Password.
6. Under Authentication > Users oppretter du én adminbruker.
7. Kopier brukerens UID.
8. Erstatt `LIM_INN_ADMIN_UID` i `database.rules.json` med UID-en.

## 2. Publiser sikkerhetsreglene

Installer Firebase CLI og logg inn:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only database
```

Du kan alternativt kopiere innholdet i `database.rules.json` til Realtime Database > Rules i Firebase Console og trykke Publish.

## 3. Last opp til GitHub

Last opp alle filene til roten av repositoryet. GitHub Pages må være satt til å publisere fra riktig branch og rotmappe.

- `index.html` er offentlig livevisning.
- `main.html` er adminside med Firebase-innlogging.

## 4. Første deltakerliste

Logg inn på `main.html`, trykk **Last opp TXT**, og velg en fil med ett navn per linje. Startnummer tildeles automatisk.

## Viktig

Firebase-konfigurasjonen er ikke et passord. Sikkerheten ligger i databasesikkerhetsreglene. Kun UID-en du legger i reglene kan skrive. Alle kan lese live-resultater.
