# BodyTape — iPhone measurement tracker

A private, offline-friendly Progressive Web App (PWA) for logging your tape measurements, tracking waist and weight trends, and viewing calculated ratios. No servers, accounts, subscriptions, analytics, or external JavaScript libraries.

## What it does
- Records dated waist, navel, neck, hip, chest, upper arm, thigh, and weight measurements (partial check-ins are allowed).
- Calculates BMI, waist-to-height ratio, waist-to-hip ratio, and an **approximate male US Navy tape body-fat percentage** (navel, neck, and height).
- Shows simple progress charts for waist, weight, and estimated body fat.
- Allows editing and deleting past check-ins.
- Supports cm/kg and in/lb, custom height and waist goal, light/dark mode, measurement tips.
- Exports CSV and a full JSON backup; restores from JSON.
- Stores your measurements locally on your own device. Works offline after successful first online load and service worker installation.

## Publish using free GitHub Pages
1. Create a **public** repository at https://github.com/new called `bodytape` (or another name).
2. Extract `BodyTape-GitHub-Pages.zip` onto a computer.
3. In the repository, select **Add file → Upload files**. Upload the **contents of `bodytape-pwa`**, preserving this structure:

   ```
   index.html
   styles.css
   app.js
   sw.js
   manifest.webmanifest
   .nojekyll
   icons/
     icon-192.png
     icon-512.png
     apple-touch-icon.png
   README.md
   ```

   **Do not upload only the .zip file. GitHub Pages will not unzip it.**
4. Commit the upload. Under **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/(root)`, then **Save**.
5. Your website address will usually be `https://YOUR-USERNAME.github.io/bodytape/`. Check the exact live URL shown in **Settings → Pages**.
6. On iPhone, open the live URL in Safari. Use the Safari Share menu → **Add to Home Screen** → turn on **Open as Web App** → **Add**.
7. **Import your personal starter file privately** (downloaded separately from this ZIP): open the installed BodyTape app → **Settings → Import backup** → select `BodyTape-PRIVATE-Starter.json` in the iPhone Files picker.

**IMPORTANT privacy note:** Do NOT commit/upload your PRIVATE starter JSON file, backup JSONs, CSVs, or personal measurements to GitHub. The website source may be public, but your measurements remain in the app's on-device storage. A GitHub repository is for app code, *not* your readings. GitHub Pages sites themselves are publicly accessible.

## Important backup notes
- Export **Settings → Backup JSON** after several check-ins; keep a safe copy in Files/iCloud Drive.
- The installed Home Screen app and Safari tab may use separate website storage. To avoid losing entries, import your starter file **inside the installed app** and keep using the installed app.
- Data does not automatically sync between devices, Safari, or installations. Restoring a JSON backup replaces the entries currently saved in that app (you are asked to confirm).
- Clearing website data, uninstalling the Home Screen app, or device loss can delete the readings. Export backups periodically.
- CSV is for a spreadsheet; use JSON for a complete restore. The JSON includes notes and measurements and should be kept private.

## Technical notes
- Pure HTML, CSS, vanilla JavaScript, no build pipeline.
- Service worker caches the app shell for offline access; deployment requires HTTPS (GitHub Pages supplies it).
- To publish changes, update the source and increment `CACHE_VERSION` in `sw.js`. Users may need to close/reopen the app to load a new version.
- If you want to preview locally on a computer, run `python -m http.server 8000` in the extracted folder and visit `http://localhost:8000`.

## What BodyTape cannot measure
The US Navy tape formula is an approximation and can be off by multiple percentage points. Neither it nor a measuring tape directly measures visceral fat, true muscle mass, or body water. BMI and circumference ratios are screening indicators, not diagnoses. BodyTape does not recommend rapid weight loss or intensive exercise, and does not substitute for clinical assessment.
