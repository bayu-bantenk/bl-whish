I've written the A1 deliverable to gpos-b2b-cms/docs/migration/ROUTE_SCREEN_MAP.md. It has all 29 required sections, and its bulk tables were generated from start/routes.js, the controllers, the views, the Mappers and the validators. Only that file was added; nothing else changed in either repo, and it isn't committed.


# A1 RESULT

Status: GO

Total Routes:
247 route calls in routes.js (217 explicit + 30 Route.resource).
427 entries once resources are expanded; 330 are frontend-relevant.
The other 97 are resource routes with no controller action behind them.

Frontend Page Routes:
107 routes render a page (106 GET, plus POST-rendered wizard summaries).

Screens:
107. By status: 82 ACTIVE-CANDIDATE · 22 UNKNOWN · 3 MISSING-VIEW.

Feature Areas:
32, named with the legacy menu labels.

Forms:
40 form groups inventoried. The views contain 145 POST <form> elements in 105 views,
plus AJAX forms on Banner, Group Story, Notification, Gamification, Customer Group and Channel.

DataTable Screens:
32 views call $.fn.buildtable.
9 more list screens use custom JSON with pagination.js, or server-rendered cards.

Modal/Dialog Patterns:
55 distinct modals plus 1 loading overlay, in 6 kinds:
confirmation, form, detail, loading, alert, custom popup.

Upload/File Capabilities:
13. All go through OSS signed-URL upload, except the Principal image,
which is saved to the server's local disk. Includes 4 CSV imports.

Export/Import Capabilities:
12. DataTables exports run in the browser and cover only the current page (not yet run to confirm).
Also: server CSV generation (Gamification), template downloads (Loyalty, Folamil) and CSV imports.

Orphan Views:
21. All 21 are LIKELY UNUSED: stale copies or prototypes.
Separately, 5 screens have routes but are only static mockups.

Missing Views:
3 (product_gposb2b_homepages/list, create, edit).
The same capability works on the Produk Gpos B2b page, tab 2.

Unknowns:
30 (U01–U30), each assigned to A2, A3.1 or A3.2.

Critical Findings:
None is critical enough to block A2. The HIGH findings:
- Failure messages are often never shown to the user. Some controllers use the key
  `Warning` (capital W), which no view renders, and list pages only display `notification`.
- Bulk-delete messages are swapped on Content and Order Review:
  success shows nothing, failure shows "Berhasil".
- Delete is broken on Order (single and bulk), Product and User Management.
- Deleting a Principal sends the user to /custom-catalog.
- Several screens work but can only be reached by typing the URL: their menu or hub
  links are commented out (Inject Point, Mutasi/Redeem, Voucher Setting,
  Gamification multi-period, and the standalone catalog-product and criteria screens).
- The login page still ships with a filled-in email and password (the A0 finding).

Migration-Relevant Findings:
- A lot of screen behavior is built on the server: 34 functions write the table's
  buttons, toggles and badges as HTML. None of them checks role or email;
  the only visibility control is the menu.
- Some JSON endpoints answer errors with a redirect, so the browser gets an HTML page instead of an error.
- Some filters on the screen are ignored by the server:
  - Mutasi: `mutation_type` and `no_invoice` are dropped.
  - Loyalty search is ignored.
  - Custom Catalog sorts by the wrong column.
  - Mutasi branch filter overrides the chosen customers.
- Validation messages are mostly not displayed; fields only get a red border.
- The dashboard is placeholders only.
- Some links point to controller actions that don't exist; the page probably renders the link as the text "null".
GO for A2. Every route, screen and view has a status, and what's left is behavior that needs runtime checks or an owner decision. Stopping here; A2 not started.

A few scope questions need your call before A4:

Hidden screens: should the URL-only screens be migrated?
Mockups: should the five mockup screens (Poin Reguler, Payment, Folamil create) be dropped?
Broken deletes: should Order, Product and User Management support delete at all in the new app?