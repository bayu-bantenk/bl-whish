1. **Created file:** `gpos-b2b-cms/docs/migration/VISUAL_BASELINE.md`

2. **Screenshot directory:** `gpos-b2b-cms/docs/migration/screenshots/a3.2/`

3. **Screenshot count:** 56 in total (48 desktop at 1440×900, 3 tablet at 1024×768, 5 mobile at 390×844). Every screenshot the report names exists in the folder.

4. **Summary**
   - **Browser:** the existing Google Chrome 154 (headless), driven through its DevTools Protocol by a small Node script. Nothing was installed.
   - **Environment:** the unmodified legacy app (commit `00bc6ea`) on 127.0.0.1, against the isolated mock gateway from A3.1.
   - **Data and secrets:** all data is synthetic, the prefilled login values were masked before capture, and no real account emails or secrets appear.
   - **Coverage:** all 20 categories are captured, and the report includes screenshot, interaction and pattern inventories plus an A4 input list.
   - **Clean-up:** the test session files and the temporary browser profile are removed, all processes are stopped, and only `docs/` is new in the repo.

5. **Major visual findings**
   - The UI is an Argon/Bootstrap 4 shell: a fixed white sidebar with 5 flat menu groups, a gradient header band, and content cards. Lists are jQuery DataTables with an export button bar, checkbox and action columns, a bulk-delete footer, and the "Processing…" and "No data available in table" states.
   - A gateway error looks **exactly like an empty table**. On the Notification list, a gateway error leaves it **stuck on "Processing…"** forever.
   - If the session expires mid-use, redrawing a table shows a **native alert "DataTables warning … Invalid JSON response"** and the old rows stay on screen. Navigating anywhere lands on the login page with no explanation.
   - **Personalization delete after a gateway error shows a native `alert("Not Found")`.** This corrects the A3.1 inference that it would look like success: the browser re-sends the DELETE to the redirected list URL, which returns 404.
   - Content bulk-delete messages are visibly swapped: a failure shows "Berhasil…" and a success shows nothing.
   - Validation shows up in four different ways:
     - Content: nothing at all, and the typed values are lost.
     - Inventory: a red alert with the first message.
     - Principal: red text under the field.
     - Banner: Save stays disabled until the form is complete.
   - Invalid credentials at login show no message.
   - The mobile "My profile" and "Logout" links point to `href="null"`, next to placeholder menu items.
   - Uploads show no progress indicator. An oversize file gets a red border and hint text. The file goes from the browser directly to storage with a PUT to the signed URL.
   - Responsive support is partial. The sidebar becomes a hamburger menu under 768 px, but the page scrolls sideways on mobile and tables scroll inside their cards.
   - **Menu visibility differs by account:** Superadmin has 30 links, Payment 1, Marketing 2. As A3.1 showed, route access is the same for everyone.

6. **Remaining unknowns**
   - **V-U01:** screens that didn't render with mock data. These are FAQ create, the Principal and Global Config edit pages, Gamification, Loyalty, and Setting Point pagination.
   - **V-U02:** the kebab action dropdowns and the custom `pagination.js` lists weren't captured.
   - **V-U03:** the AJAX toggle spinner and the Gamification loading overlay were too brief to capture.
   - **V-U04:** how screens look with long, real-world data.
   - **V-U05:** keyboard focus and accessibility states.
   - **V-U06:** native alert dialogs couldn't be screenshotted; only their text is recorded.
   - **Carried over from A3.1:** everything that depends on the real gateway or backend.
   - **What would close most of these:** a test gateway with realistic data and test accounts.

7. **A3.2 STATUS: GO**

8. **A4 readiness:** ready. The pattern inventory is in §18, the A4 input list in §22, and each legacy pattern is kept separate from any target decision in §21.