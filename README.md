# Beitar Minyanim · מנייני ביתר

> A lightweight, Hebrew-first directory prototype for browsing local prayer times, synagogue listings and locations.

**Status: community prototype / static data — not a verified live timetable.** The bundled data currently includes three synagogue entries. **Always confirm the actual times with the synagogue**, particularly for Shabbat, holidays and seasonal changes. This project does not automatically verify or update schedules.

## מה המערכת כוללת?

- תצוגת **עכשיו**, **המניין הבא**, **בתי כנסת** ו**מפה**.
- חיפוש לפי שם בית הכנסת וכתובת, וסינון לפי נוסח וסוג תפילה.
- בחירת שעה ידנית; איתור מיקום בהסכמת המשתמש או הזנת כתובת.
- אתר סטטי בעברית (RTL) ללא צורך בחשבון משתמש או שרת אפליקציה.

## Quick start | הרצה מקומית

No build system or package installation is required. To serve the local JSON file correctly, run a small HTTP server from the repository folder:

```bash
python3 -m http.server 8000
```

Open **http://localhost:8000**. Opening `index.html` directly as a `file://` URL may prevent the JSON file from loading.

The interface loads Leaflet and Day.js from public CDNs, so parts of it require an internet connection. Browser geolocation may require HTTPS outside localhost.

## File structure

| File | Purpose |
| --- | --- |
| `index.html` | Hebrew page structure and navigation |
| `styles.css` | Layout and responsive styling |
| `app.js` | Search, scheduling views, geolocation and map behavior |
| `data/shuls.json` | Bundled synagogue records and prayer-time arrays |

## Data maintenance | עדכון נתונים

Edit `data/shuls.json` and preserve its existing JSON structure (including `id`, `name`, `address`, `nusach` and `schedule`). Check each change against a trusted, current source. Avoid adding phone numbers or other personal information without permission.

**Do not treat the current entries as a verified database or current prayer-time service.** There is no built-in moderation, automatic schedule synchronization or live status validation.

## Privacy & external services

- The "near me" feature requests browser geolocation permission.
- A manually entered address may be sent to **OpenStreetMap Nominatim** for geocoding; results are cached locally in `localStorage` (`geoCache_v1`).
- Maps and related libraries may load content from third-party services.
- The repository does not include a user-account backend.

For sensitive situations, do not enter a private home address. Consult the relevant providers' privacy policies before deployment.

## Checks

GitHub Actions runs **JavaScript syntax and JSON parse checks** on pushes and pull requests. These are smoke checks only: they do not verify prayer schedules, location accuracy, security or cross-browser behavior.

## Contributing

Issues describing incorrect data or broken behavior are welcome. **Do not include personal details, exact user locations or private screenshots in public issues.** No open-source license has been granted by this README.
