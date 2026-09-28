# A3.2 — Legacy Runtime / Visual Baseline

| Item | Value |
|---|---|
| Phase | A3.2: browser-based visual and interaction baseline (read-only toward the source) |
| Date | 2026-09-28 (WIB) |
| Inputs | `FRONTEND_SCOPE.md`, `ROUTE_SCREEN_MAP.md`, `AUTH_API_PERMISSION_MAP.md`, `RUNTIME_BEHAVIOR_AUDIT.md` (§20 queue) |
| Screenshots | `docs/migration/screenshots/a3.2/` (56 PNG files) |
| Secrets | None recorded. Prefilled login values were masked in the DOM before capture. All data and identities are synthetic, and no real account email appears in any screenshot |

---

## 1. Executive Summary

- The **unmodified legacy app** (commit `00bc6ea`) was driven in a **real browser**: the locally installed Google Chrome 154, run headless and automated through the Chrome DevTools Protocol. No new framework was installed.
- The data came from the isolated **mock gateway** harness used in A3.1, fed synthetic, realistic-looking rows. No real gateway, backend or storage was contacted.
- **56 screenshots** cover all 20 required categories.

**What the legacy CMS looks like** [RUNTIME]:
- Argon Dashboard (Bootstrap 4) with a fixed white left sidebar of **5 uppercase group headings** and 30 links, an orange→blue gradient header band, and white content cards.
- Lists are **jQuery DataTables**, with "Show N entries", a Copy/Excel/PDF/Print/Column-visibility button bar, "Search:", sortable headers, a checkbox + Action column (cyan edit / red delete button group), a bulk "Delete" footer row, and a "Showing x to y of z entries" pager.
- Forms are single cards with labels on top, `*` required markers, and green "Save" / white "Back" buttons.
- Feedback comes in four forms: auto-fading Bootstrap alerts, Toastify toasts at the top centre, Bootstrap modals, and **native `alert()` dialogs**.

**Key visual/interaction findings:**
1. **A gateway error looks exactly like an empty table.** The error and empty screenshots are identical ("No data available in table").
2. **When the session expires during use**, a DataTables action shows a native alert, "DataTables warning … Invalid JSON response", and the table then **keeps showing the old rows**. Navigating to any page shows the login page.
3. **A Notification list gateway error leaves the table stuck on "Processing…"** forever.
4. **Personalization delete after a gateway error shows a native `alert("Not Found")`.** This **contradicts the A3.1 inference** that it looks like success; see §20.
5. **Bulk-delete feedback is inverted** on Content: a gateway error shows the blue "Berhasil menghapus Konten"; a gateway success shows nothing.
6. **Validation feedback comes in 4 different visual patterns** (none, alert, inline text, toast), and invalid-credential logins show no message at all.
7. **The mobile navigation's "My profile" and "Logout" links have `href="null"`**. This resolves A1-U01 for these links.
8. **The layout is only partly responsive.** The sidebar collapses to a hamburger below 768 px, but pages overflow horizontally on mobile, and the tables scroll within their cards.

**A3.2 STATUS: GO** (§24).

## 2. Browser / Runtime Environment

| Item | Value |
|---|---|
| Browser | Google Chrome (existing installation), headless mode (`--headless=new`), automated via the Chrome DevTools Protocol from a Node 24 script (built-in WebSocket). Temporary profile in `/tmp`, deleted afterwards |
| Browser version | Chrome 154.0.8037.57 |
| Viewports | Desktop 1440 × 900 (default); Tablet 1024 × 768; Mobile 390 × 844 (mobile emulation) |
| OS | macOS 26.5 |
| Legacy app URL | `http://127.0.0.1:19000` (local, unmodified source, config overrides via process env only) |
| Gateway | Local mock `http://127.0.0.1:18080` (synthetic rows, switchable errors, CORS-enabled `/storage` for signed-upload PUTs) |
| Account types | SUPERADMIN (default), PAYMENT, MARKETING (synthetic sessions; identifiers not recorded) |
| Build / commit | `00bc6ea` |
| Side effects | 12 session files created during the run were deleted (the 98 pre-existing files are untouched). All processes were stopped. Only `docs/` is new in `git status` |
| Limits | Native `alert()` dialogs were auto-accepted by the automation. Their **text is recorded, but they cannot appear in screenshots**. Hover/keyboard focus rings were not systematically captured |

## 3. Screenshot Inventory

| Category | Screen | State | Screenshot | Important UI elements |
|---|---|---|---|---|
| Login | `/` | Default (values masked) | `A3.2_auth_login_default.png` | "GPOS B2B" wordmark (Nortune font); rounded "claymorphism" card; user/lock icon inputs; gradient "Sign in" button; "Forgot password?" link (`#`); copyright footer; orange→blue gradient background |
| Login | `/` | Empty email | `A3.2_auth_login_validation_empty-email.png` | Red alert "Email is required" above the fields |
| Login | `/` | Empty password | `A3.2_auth_login_validation_empty-password.png` | Red alert "Password is required" |
| Login | `/` | Invalid credentials | `A3.2_auth_login_invalid-credentials.png` | **No message**; the form is simply re-shown |
| Login | `/` | Mobile 390 px | `A3.2_auth_login_mobile.png` | Card fills the width; same elements |
| Dashboard | `/home` | Default | `A3.2_dashboard_default.png` | Two stat cards ("PAGE TOTAL Rp. 0", "ARTICLE TOTAL 0") with round icons; dark "OVERVIEW / Visitors" card with WEEK/MONTH/YTD buttons and an empty chart area; "© 2026 GPOS Team" footer |
| Navigation | `/home` | Superadmin (full page) | `A3.2_nav_superadmin.png` | Logo; "Beranda" (active: light-blue background, blue text, left border); 5 dark group headings; 30 links with FontAwesome icons |
| Navigation | `/home` | Sidebar minimised | `A3.2_nav_superadmin_collapsed.png` | Header "expand" icon toggles the minimised sidebar |
| Navigation | `/payment` | Payment account | `A3.2_nav_payment.png` | One heading "MENU" → "Pembayaran" (no Beranda) |
| Navigation | `/payment` | Marketing account | `A3.2_nav_marketing.png` | "MENU" → "Push Notification", "Banner" |
| DataTable | `/content` | Default | `A3.2_datatable_content_default.png` | Page title card "Content Management"; green "Create New Content"; Show 5/10/25/50/All; button bar; Search; columns CHECK/ACTION/CODE/NAME/ACTIVE/CREATED AT with sort arrows; footer Delete; pager `< 1 2 3 4 5 >` |
| DataTable | `/content` | Search "Sample" | `A3.2_datatable_content_search.png` | Search box filled; server-side redraw |
| DataTable | `/content` | Page 2 | `A3.2_datatable_content_pagination.png` | "Showing 6 to 10 of 23 entries"; active page bubble (indigo) |
| DataTable | `/content` | Rows selected | `A3.2_datatable_content_selection.png` | Checked row checkboxes; row highlight |
| DataTable | `/products` | Filter "Active" | `A3.2_datatable_products_filtered.png` | Header-row filter selects (All/Active/Not Active, All/Draft/Not Draft); image column |
| DataTable | `/order` | Filter bar | `A3.2_datatable_order_filterbar.png` | Filter card: Customer ID select2, "Filter" select (Purchase No / Invoice No / Customer Name / ID Order), keyword, disabled Search button |
| DataTable | `/banner` | Mapper actions | `A3.2_datatable_banner_actions.png` | Page length 15; inline sequence inputs; image thumbnails; green/red Active/Inactive toggles; header status filter "All Status" |
| DataTable | `/personalization/channels` | Default | `A3.2_datatable_personalization_default.png` | Status chips "Semua / Draft / Aktif / Tidak Aktif"; Edit + Delete (Delete only on non-ACTIVE rows); no export buttons |
| DataTable | `/content` | Gateway 500 | `A3.2_datatable_content_gateway-error.png` | "No data available in table"; "Showing 0 to 0 of 0 entries"; **no error indication** |
| DataTable | `/notification` | Gateway 500 | `A3.2_datatable_notification_error.png` | Status buttons SEMUA/DIKIRIM/TERJADWAL/DRAFT/BATAL; **"Processing…" box stuck**, no rows, no info line |
| Empty | `/content` | 0 rows | `A3.2_empty_datatable_content.png` | "No data available in table" (identical to the error state) |
| Empty | `/notification` | 0 rows | `A3.2_empty_datatable_notification.png` | "No data available in table", "Showing 0 to 0 of 0 entries" |
| Loading | `/content` | Slow gateway (4 s) | `A3.2_loading_datatable_content.png` | Centered "Processing…" box over the table |
| Form | `/content/create` | Default | `A3.2_form_content_default.png` | Title "Create new Content"; fields Code*, Name*, "Ative*" (select), Value (textarea); Save / Back |
| Form | `/content/create` | Validation (code empty) | `A3.2_form_content_validation.png` | **Nothing shown**; entered values lost |
| Form | `/inventories/create` | Validation | `A3.2_form_inventory_validation.png` | Red alert "product_id is required" at the top of the card |
| Form | `/principal/create` | Default | `A3.2_form_principal_default.png` | Image picker area, text fields, Choices multi-select |
| Form | `/principal/create` | Validation | `A3.2_form_principal_validation.png` | Inline red text "Kode prinsipal wajib diisi." under the field |
| Form | `/banner/create` | Default (viewport + full page) | `A3.2_form_banner_default.png`, `A3.2_form_banner_default_full.png` | Breadcrumb-style header ("Daftar Banner & Iklan / Buat…" with back arrow); one "Konten" tab; toggle; type select; image uploads with ratio hints; display-mode checkboxes; Quill editor; 4 select2 fields; 2 date inputs; **Save disabled until complete** |
| Edit | `/content/1/edit` | Default | `A3.2_edit_content_default.png` | "Edit Content"; prefilled fields; Save / Back |
| Detail | `/order/1/edit` | Read-only detail | `A3.2_detail_order_default.png` | "Detail Order"; 12 read-only inputs; order-items table; only a **Back** button (no submit) |
| Modal | `/content` | Row delete | `A3.2_modal_row-delete_confirmation.png` | "⚠ Delete Confirmation" / "Are you sure delete this data?" / red **Yes**, blue **No**, × close; dark backdrop |
| Modal | `/content` | Bulk delete | `A3.2_modal_bulk-delete_confirmation.png` | Same layout-level `#alertalldel` modal |
| Modal | `/banner` | Nothing selected | `A3.2_modal_info_nothing-selected.png` | Info modal "Delete Alert — Tidak bisa menghapus data, pastikan Anda sudah memilih data" / OK |
| Modal | `/personalization/channels` | Delete confirmation | `A3.2_modal_personalization_delete.png` | Custom modal "Konfigurasi Penghapusan Produk" / "Apakah Anda yakin…" / Batal · Lanjutkan |
| Feedback | `/content` | Create success | `A3.2_feedback_success_flash.png` | Blue (info) alert "Konten berhasil ditambahkan" at the top of the list card |
| Feedback | `/content/create` | Create error (gateway 400) | `A3.2_feedback_error_flash.png` | Red alert "Konten tidak berhasil ditambahkan" |
| Feedback | `/content` | Bulk delete, gateway **error** | `A3.2_feedback_inverted_bulk-delete_gateway-error.png` | Blue "**Berhasil** menghapus Konten" (inverted) |
| Feedback | `/content` | Bulk delete, gateway **success** | `A3.2_feedback_inverted_bulk-delete_gateway-success.png` | **No message** (inverted) |
| Feedback | `/banner` | Toggle rejected (gateway 400) | `A3.2_feedback_toast_error_banner-toggle.png` | Toastify error toast (top centre, pink, cross icon) with the gateway message; toggle reverted |
| Feedback | `/personalization/channels` | Delete after gateway 500 | `A3.2_feedback_personalization_delete_after-gateway-error.png` | Page after the native `alert("Not Found")`; rows unchanged |
| Upload | `/banner/create` | Default | `A3.2_upload_default.png` | Native file input "Choose File / No file chosen" + trash button; hint "Ukuran gambar harus 2:1 (Max. 5 Mb)" |
| Upload | `/banner/create` | Success | `A3.2_upload_success.png` | File name shown; upload completed (hidden URL field set) |
| Upload | `/banner/create` | Oversize (6 MB) | `A3.2_upload_error_oversize.png` | Red border around the input group; red text "Ukuran gambar harus 2:1 (Max. 5 Mb)"; input cleared |
| Expired session | `/content` | DataTables redraw after expiry | `A3.2_auth_expired_datatable-redraw.png` | Search "x" entered, **stale rows still displayed** (after a native alert "DataTables warning … Invalid JSON response") |
| Expired session | `/content` → `/` | Navigation after expiry | `A3.2_auth_expired.png` | Login page (values masked) |
| Mapper UI | `/banner` | Row cells | `A3.2_mapper_banner_row-actions.png` | Crop: checkbox, ID, edit/delete button group, sequence input, image, toggle, title, type |
| Mapper UI | `/payment` | Status badges | `A3.2_mapper_payment_status-badges.png` | Badges PAID (green) / PENDING (info) and receipt APPLIED / UNAPPLIED |
| Responsive | `/home` | Tablet 1024 | `A3.2_responsive_tablet_dashboard.png` | Sidebar still visible (250 px) |
| Responsive | `/content` | Tablet | `A3.2_responsive_tablet_datatable.png` | Table fits (≈712 px) |
| Responsive | `/content/create` | Tablet | `A3.2_responsive_tablet_form.png` | Form card narrower |
| Responsive | `/home` | Mobile 390 | `A3.2_responsive_mobile_dashboard.png` | Top bar with hamburger + large logo; page width 441 px, so **horizontal overflow** |
| Responsive | `/home` | Mobile nav open | `A3.2_responsive_mobile_nav-open.png` | Collapsed menu opened from the hamburger |
| Responsive | `/content` | Mobile | `A3.2_responsive_mobile_datatable.png` | Table (≈712 px) scrolls horizontally inside the card; button bar is cut off at the right |
| Responsive | `/content/create` | Mobile | `A3.2_responsive_mobile_form.png` | Stacked fields |

## 4. Login Baseline

| Aspect | Observed [RUNTIME] |
|---|---|
| Title | `Login - GPOS B2B Admin Panel` |
| Branding | Large white "GPOS B2B" wordmark (h1); no image logo |
| Fields | `email` (type text, placeholder "Email", user icon); `password` (type password, placeholder "Password", lock icon). No labels, placeholders only |
| Prefilled | Email: **PRESENT**, value [REDACTED]. Password: **PRESENT**, value [REDACTED]. Masked in screenshots |
| Password visibility toggle | None |
| Button | "Sign in" (gradient) |
| Links | "Forgot password?" → `#`; footer "GPOS B2B" → `#` |
| Background | `bg-login-gradient` (orange → blue) |
| Validation | Server-side only; red alert box above the fields ("Email is required" / "Password is required"); one message at a time |
| Invalid credentials | Page reloads; **no message** (A3.1 cause: ApiService wrapper) |
| Responsive | Card becomes full-width on mobile |

## 5. Dashboard Baseline

| Element | Observed |
|---|---|
| Sidebar | White, fixed left, logo on top, "Beranda" active |
| Top navigation | Gradient band with an "expand" icon (sidebar minimise) on the left and an "Account" dropdown on the right (dropdown: Welcome! / Logout) |
| Page title | None (no heading on the dashboard) |
| Cards | "PAGE TOTAL — Rp. 0" (green round icon), "ARTICLE TOTAL — 0" (indigo round icon); static values |
| Chart | Dark card "OVERVIEW / Visitors" with WEEK / MONTH / YTD buttons; **empty canvas** (the chart is never drawn) |
| Loading / empty | None displayed |
| Footer | "© 2026 GPOS Team" |

## 6. Navigation Baseline (MENU VISIBILITY)

| Account type | Visible groups / links | Notes |
|---|---|---|
| SUPERADMIN | Beranda; TRANSAKSI (4); PRODUK & KATALOG (5); INTERAKSI PELANGGAN (9); PENGATURAN & KONFIGURASI (8); BANTUAN PENGGUNA (3), i.e. 30 links | `A3.2_nav_superadmin.png` |
| PAYMENT | MENU → Pembayaran | No Beranda/dashboard link |
| MARKETING | MENU → Push Notification, Banner | No Beranda link |

**Structure and behavior:**
- **Nesting:** none. The menu is flat, with group headings only; there are no submenus or accordions.
- **Active item:** highlighted only on an exact path match (light-blue background, blue text, left border).
- **Collapse:** the header icon minimises the sidebar (`A3.2_nav_superadmin_collapsed.png`). On mobile, the sidebar becomes a top bar with a hamburger that expands the menu.
- **Profile and logout:**
  - Desktop: "Account" → Logout (`/logout`).
  - Mobile: user dropdown with placeholder items "Action / Another action / Something else here" (`#`) plus **"My profile" → `null`** and **"Logout" → `null`** [RUNTIME], and an empty name label.
- **What this shows:** only **menu visibility** differs between the three accounts. A3.1 showed that route access is identical; menu visibility is not a permission.

## 7. DataTable Baseline

| Aspect | Observed |
|---|---|
| Width | Full width of the content card; columns auto-sized; horizontal scroll inside the card when too wide |
| Header | Uppercase small grey column labels; sort arrows (↑↓) on sortable columns; CHECK/ACTION not sortable |
| Search | Top-right "Search:" input (server-side, per keystroke) |
| Filters | Varies per screen: header-row selects (Products Active/Draft; Banner status), a separate filter card (Order), status chips (Personalization, Notification), date/customer filters (Payment) |
| Page size | "Show [5] entries" (5/10/25/50/All); Banner and User Management default to 15 |
| Buttons | Copy / Excel / PDF / Print / Column visibility (grey pill group); absent on Personalization, Referral, GPOS Brand |
| Pagination | Circular `<` `1 2 3…` `>` buttons; active page filled indigo; info text "Showing x to y of z entries" |
| Loading | Centered "Processing…" box |
| Actions | Cyan edit + red delete square buttons grouped per row; custom buttons on some screens |
| Checkboxes | Leftmost column + a footer row with a red "Delete" button (bulk) |
| Badges / toggles | bootstrap-toggle pills (Active green / Inactive red); Payment status badges |
| Empty state | "No data available in table" + "Showing 0 to 0 of 0 entries" |
| Error state | Content: **identical to empty**. Notification: **stuck "Processing…"**. Expired session: native alert + stale rows |
| Responsive | No DataTables responsive collapse observed; the table overflows horizontally on narrow screens |

## 8. Form Baseline

| Form | Pattern | Observed |
|---|---|---|
| Content create/edit | Simple | Labels above fields; `*` in the label; "Ative" typo in the label; select + textarea; Save (green) / Back (white) |
| Principal create | Upload + multi-select | Image picker; Choices multi-select; inline field errors |
| Inventory create | Select2 + select | Error shown as a single alert |
| Banner create | Rich form | Header with breadcrumb link + back arrow; tab "Konten"; toggle switch; selects; conditional sections (carousel/story); image uploads with hints; select2 multi-selects; date inputs; Quill editor; **Save disabled until the required fields are complete**; no Cancel button (back arrow only) |
| Order detail | Read-only | All inputs readonly; Back only |

**Validation display patterns observed at runtime:**

| Pattern | Where | What the user sees |
|---|---|---|
| None | Content create | Nothing, and the entered values are gone |
| Alert (first message) | Inventory, Login | A red alert at the top of the card |
| Inline text | Principal | Red text under the field |
| Client gating + toast | Banner | Save button disabled; errors as toast |

## 9. Modal / Dialog Baseline

| Modal | Type | Title / message | Buttons | Close behavior |
|---|---|---|---|---|
| `#alertdel` (row delete) | Confirmation | "⚠ Delete Confirmation" / "Are you sure delete this data?" | red **Yes**, blue **No**, × | × / No / backdrop; **Esc closes it** [RUNTIME] |
| `#alertalldel` (bulk delete, layout) | Confirmation | Same | Yes / No | Same |
| `#validationdel` (nothing selected) | Information | "Delete Alert" / "Tidak bisa menghapus data, pastikan Anda sudah memilih data" | OK | OK / × |
| `#modal-delete` (Personalization) | Confirmation (custom style) | "Konfigurasi Penghapusan Produk" / "Apakah Anda yakin ingin menghapus konfigurasi channel ini?" | Batal / **Lanjutkan** | Batal / × |
| Native `alert()` | Error dialog | "DataTables warning: table id=… - Invalid JSON response…" (expired session); "Not Found" (Personalization delete error) | OK (browser) | Blocks the page until dismissed |

All Bootstrap modals use the standard dark backdrop and a centered or top-aligned dialog.

## 10. Toast / Flash Baseline

| Type | Mechanism | Position | Duration / dismissal | Icon | Navigation | Example |
|---|---|---|---|---|---|---|
| Success flash | Bootstrap `alert-info` inside the card (after redirect) | Top of the content card | Auto-fades after ~3.5 s (`main.js`) | None | Yes (redirect) | "Konten berhasil ditambahkan" |
| Error flash | `alert-danger` | Top of the card | Auto-fades | None | Yes (redirect back) | "Konten tidak berhasil ditambahkan" |
| Validation flash | `alert-danger` (first message) or inline text | Card top / under the field | Alerts fade; inline text persists | None | Redirect back | "product_id is required" |
| Toast (AJAX) | Toastify | Top centre | 10 s, stops on hover | Check / cross image | No | "Mock: banner update rejected" |
| Native alert | `alert()` | Browser modal | Until OK | Browser | No | "Not Found", DataTables warning |

Multiple Toastify toasts stack vertically (library behavior; not specifically exercised). Only one flash alert per key is shown.

## 11. Upload Baseline

| Aspect | Observed [RUNTIME] |
|---|---|
| File picker | Native "Choose File" input inside an input group with a grey trash (remove) button |
| Hint | Ratio/size hint under the field ("Ukuran gambar harus 2:1 (Max. 5 Mb)") |
| Selected file | File name shown in the native input |
| Progress | **None shown** |
| Flow | `POST /files/signurl` (200 JSON) → **browser `PUT` directly to storage** (`image/png`, signed URL with query `[REDACTED]`) → hidden URL field set → preview image requested from the file URL |
| Validation | Oversize (6 MB): input cleared, red border, red hint text. No MIME error UI (client ratio check only) |
| Errors | Upload/sign failures are only logged to the console (no UI), per source and A3.1 |
| Remove | Trash button clears the input and hidden field (per source) |
| Final display | Preview thumbnail only (on screens with an `imageClass`); the stored value is a URL string |

## 12. Detail / Edit Baseline

| Screen | Breadcrumb / header | Fields | Tabs | Actions |
|---|---|---|---|---|
| Order detail (`/order/1/edit`) | "Detail Order" card header | 12 read-only inputs + items table | None | **Back only** (no submit, although the form is PUT/multipart) |
| Content edit (`/content/1/edit`) | "Edit Content" | code, name, is_active, value (editable) | None | Save / Back |
| Banner create/edit | Breadcrumb link "Daftar Banner & Iklan / Buat…" + back arrow | Many (see §8) | "Konten" (+ "Katalog Produk" on edit per source) | Save (gated) |

## 13. Empty States

| Screen | Message | Illustration | CTA | Pagination |
|---|---|---|---|---|
| DataTables lists (Content, Notification) | "No data available in table" | None | None (the page's "Create New…" button remains) | "Showing 0 to 0 of 0 entries"; pager disabled |
| Form-related empty state | **EMPTY STATE: NOT OBSERVED** (no dedicated empty form/related-list UI found in captured screens) | — | — | — |

## 14. Loading States

| Mechanism | Observed |
|---|---|
| DataTable loading | "Processing…" box centered over the table (`A3.2_loading_datatable_content.png`) |
| Initial page load | Full server render; no skeleton or spinner. **LOADING SCREENSHOT: NOT CAPTURED** (not applicable) |
| AJAX action loading (banner toggle) | Source shows a spinner next to the toggle (`.toggle-loading`) and disables it; **LOADING SCREENSHOT: NOT CAPTURED** (spinner not observed within the capture window) |
| Upload loading | None visible |
| Modal loading | `#loading-overlay` exists on Gamification (source); not captured |

## 15. Session Expired State

| Path | What the browser shows [RUNTIME] |
|---|---|
| DataTable redraw after expiry | Native **alert "DataTables warning: table id=dataTable-contents - Invalid JSON response…"**, then the table **keeps the previous rows** (stale UI) with the new search term in the box (`A3.2_auth_expired_datatable-redraw.png`) |
| Page navigation after expiry | Redirected to the **login page** (`A3.2_auth_expired.png`); no message explains the expiry |
| AJAX action after expiry | Per A3.1: 302 → login HTML (action-specific UI not separately captured) |

## 16. Mapper-Generated HTML

```text
SOURCE  app/Mapper/BannerMapper.ToBannerListSuccessResponse (server builds HTML strings)
        ↓
RUNTIME /banner DataTable row (A3.2_mapper_banner_row-actions.png)
```

| Feature | Present in rendered row [RUNTIME] |
|---|---|
| Inline `onclick` | **No** (behavior bound by delegated jQuery handlers) |
| `data-*` attributes | **Yes, many**: `data-id`, `data-title`, `data-isactive`, `data-type`, `data-image`, `data-startdate`, `data-enddate`, `data-platform`, `data-author`, `data-link`, `data-contenttype`, `data-restrictid/area/channel`, `data-displaymode`, `data-content`, `data-storyimage`, `data-opentab` (the full record is embedded in the markup) |
| `href` | Edit → relative `./banner/1/edit` |
| Buttons | Edit (cyan, `fa-edit`), Delete (red, `.alertdel`, opens a confirmation modal) |
| Checkbox | Yes, plus hidden `item[]` (duplicate id `titleCheckdel` on every row) |
| Toggle | bootstrap-toggle Active/Inactive (`.checkbox-toggle`) with a loading spinner element |
| Inline input | Number input `.sequenceEdit` |
| IDs | Row element ids equal to the record id |
| Permission-like visibility | **None** (the same actions for every account) |
| Confirmation | Delete → `#alertdel` modal |

Payment (`A3.2_mapper_payment_status-badges.png`): server-built badges PAID (green), PENDING (info, for UNPAID), APPLIED / UNAPPLIED receipt labels, and the payment number as a link.

Personalization: server-built Edit (`btn-info`) and Delete (`btn-danger btn-delete`), with **Delete omitted for ACTIVE rows** (a data-state condition, not a permission).

## 17. Responsive Baseline

| Viewport | Navigation | Table | Form | Verdict |
|---|---|---|---|---|
| Desktop 1440 × 900 | Fixed sidebar 250 px | Fits | Fits | Primary target |
| Tablet 1024 × 768 | Sidebar still shown | Fits (≈712 px) | Narrower card | Works |
| Mobile 390 × 844 | Sidebar becomes a top bar with hamburger + logo; menu collapsible | Table ≈712 px, **scrolls horizontally inside the card**; the button bar is clipped | Fields stack | **Partially responsive**: page scroll width 441 px on the dashboard (horizontal overflow); mobile-only user dropdown has broken links |

## 18. Visual Pattern Inventory

| Pattern | Observed in | Approx. frequency | Source | Runtime |
|---|---|---:|---|---|
| Sidebar (Argon, flat groups) | All layout pages | 110 views | `layouts.edge` + `Extender.js` menu | Observed, 3 variants |
| Gradient header band + top bar | All layout pages | 110 | `layouts.edge` | Observed |
| Page header / card title | Lists and forms | Most | Per view | Observed ("Content Management", "Create new Content") |
| Breadcrumb (text link + back arrow) | Newer screens (Banner, Group Story, Referral, Channel) | ~15 | Per view | Observed on Banner |
| DataTable (buildtable) | Lists | 32 views | `main.js` | Observed |
| Filter bar (header selects / filter card / chips) | Banner, Products, Order, Payment, Notification, Channel, Verifikasi, User Mgmt | ~10 | Views | Observed (3 variants) |
| Form section (single card, labels on top) | Create/edit | ~45 | `components/form_*` | Observed |
| Tabs | Banner, Custom Catalog, Notification, Gamification, Referral, Channel, Produk Gpos B2b | ~8 | Views | Observed (single tab on Banner create) |
| Modal (confirmation / info / custom) | Delete, bulk, publish | 55 dialogs | Views + layout | Observed (4) |
| Native `alert()` | Error paths | Several | Inline JS, DataTables | Observed (2 texts) |
| Toast (Toastify) | AJAX screens | 22 views | `cms-toastify.js` | Observed |
| Flash alert (auto-fade) | Redirect flows | Most forms | `main.js` + views | Observed |
| Upload (signed URL) | 19 views | 19 | `script_image_uploader` | Observed |
| Status badge / toggle | Banner, Payment, Channel, Referral, Notification | ~10 | Mappers | Observed |
| Action button group (edit/delete) | DataTables | ~25 | Mappers / controllers | Observed |
| Action dropdown (kebab) | Notification cards, Setting Point, Voucher | ~4 | Mappers / views | Not captured (source only) |
| Pagination (DataTables) | Lists | 32 | DataTables | Observed |
| Pagination (custom `pagination.js`) | Setting Point, Gamification, Loyalty | 3 | `pagination.js` | Not captured |
| Stat cards | Dashboard | 1 | `dashboard.edge` | Observed |

## 19. Interaction Inventory

| Screen | Interaction | Trigger | Result | Screenshot | Evidence |
|---|---|---|---|---|---|
| Login | Submit empty field | Sign in | Reload + red alert | `…validation_empty-*.png` | RUNTIME |
| Login | Invalid credentials | Sign in | Reload, no message | `…invalid-credentials.png` | RUNTIME |
| Sidebar | Minimise | Header expand icon | Sidebar narrows | `A3.2_nav_superadmin_collapsed.png` | RUNTIME |
| Sidebar (mobile) | Open menu | Hamburger | Menu expands | `A3.2_responsive_mobile_nav-open.png` | RUNTIME |
| DataTable | Search | Type in Search | Server redraw | `…content_search.png` | RUNTIME |
| DataTable | Paginate | Click "2" | Page 2 rows | `…content_pagination.png` | RUNTIME |
| DataTable | Filter | Header select | Server redraw | `…products_filtered.png` | RUNTIME |
| DataTable | Select rows | Row checkbox | Checked; hidden `item[]` enabled | `…content_selection.png` | RUNTIME |
| DataTable | Sort | Header click | Arrow state (server sort) | `…content_default.png` (indicators) | RUNTIME (visual indicators only) |
| DataTable | Bulk delete, nothing selected | Delete | Info modal | `A3.2_modal_info_nothing-selected.png` | RUNTIME |
| DataTable | Bulk delete | Delete → Yes | Redirect + (inverted) flash | `…inverted_bulk-delete_*.png` | RUNTIME |
| DataTable | Row delete | Red button | Confirmation modal | `A3.2_modal_row-delete_confirmation.png` | RUNTIME |
| Modal | Close | Esc | Closes | — | RUNTIME |
| Banner list | Toggle active (gateway error) | Toggle | Revert + error toast | `…toast_error_banner-toggle.png` | RUNTIME |
| Personalization | Delete (gateway error) | Delete → Lanjutkan | Native alert "Not Found"; rows unchanged | `…personalization_delete_after-gateway-error.png` | RUNTIME |
| Form | Submit | Save | Redirect + flash, or back + one of 4 validation patterns | `A3.2_form_*` | RUNTIME |
| Form | Cancel | Back button / arrow | Navigate to list | — | RUNTIME (links) |
| Upload | Select file | File input | Signurl + PUT; hidden value set | `A3.2_upload_success.png` | RUNTIME |
| Upload | Oversize file | File input | Cleared, red border, hint in red | `A3.2_upload_error_oversize.png` | RUNTIME |
| Upload | Remove file | Trash button | Clears the field (source) | — | Source only |
| Toast | Dismiss | Auto (10 s) / hover | Auto-close | `…toast_error…png` | RUNTIME |
| Session | Expiry during use | Any DataTable redraw | Native alert + stale rows | `A3.2_auth_expired_datatable-redraw.png` | RUNTIME |
| Session | Expiry + navigation | Any link | Login page | `A3.2_auth_expired.png` | RUNTIME |
| Logout | Desktop | Account → Logout | Login page | — | A3.1 RUNTIME |
| Logout / profile (mobile) | Mobile dropdown | Tap | `href="null"` (broken) | — | RUNTIME (DOM) |

## 20. Observed Defects (legacy; recorded as-is)

| Observed visual behavior | Classification | Screenshot |
|---|---|---|
| Gateway error shows the same "No data available in table" as a truly empty list | LEGACY DEFECT (silent failure) | `…content_gateway-error.png` vs `…empty_datatable_content.png` |
| Notification list stuck on "Processing…" after a gateway error | LEGACY DEFECT | `…notification_error.png` |
| Session expiry during use → native DataTables warning alert + stale rows | LEGACY DEFECT | `…auth_expired_datatable-redraw.png` |
| Content bulk delete: error shows "Berhasil…", success shows nothing | LEGACY DEFECT (inverted flash) | `…inverted_bulk-delete_*.png` |
| Content create validation shows nothing and loses the input | LEGACY DEFECT | `…form_content_validation.png` |
| Invalid-credential login shows no message | LEGACY DEFECT | `…invalid-credentials.png` |
| Personalization delete after a gateway error → native alert "Not Found" (the redirected DELETE is re-sent to the list URL and returns 404). **CONTRADICTS the A3.1 inference** that axios would treat it as success; the browser keeps the DELETE method on 302 | LEGACY DEFECT; runtime correction to A3.1 §8 / A1-U16 | `…personalization_delete_after-gateway-error.png` |
| Mobile dropdown "My profile" / "Logout" → `href="null"`; placeholder menu items | LEGACY DEFECT | `A3.2_responsive_mobile_nav-open.png` |
| "Ative*" label typo; dashboard values hardcoded 0; empty chart | OBSERVED VISUAL BEHAVIOR (legacy content) | `…form_content_default.png`, `…dashboard_default.png` |
| Duplicate element ids on Mapper rows (`titleCheckdel`) and banner hints (`hint-image`) | LEGACY DEFECT (markup) | `…banner_actions.png` |
| Horizontal overflow on mobile | OBSERVED VISUAL BEHAVIOR | `…responsive_mobile_*.png` |

## 21. Migration-Relevant Visual Facts

These are facts only. Each row keeps the **legacy UI pattern** separate from any **target architecture decision**, which is left to A4 and later.

| Fact | LEGACY UI PATTERN | TARGET ARCHITECTURE DECISION |
|---|---|---|
| Shell | Argon/Bootstrap 4 sidebar + gradient band + cards | Pending (A4) |
| Lists | jQuery DataTables server-side, with a button bar and a checkbox/action column | Pending; no equivalence implied |
| Row actions | Server-built HTML with embedded `data-*` records | Pending |
| Feedback | Four feedback types (flash alert, toast, modal, native alert) | Pending |
| Validation display | Four inconsistent patterns | Pending (the legacy app is not a spec, see A2 §11) |
| Menu | Three email-selected menu sets; flat groups | Pending (OD-3/OD-4) |
| Upload | Native file input + signed-URL PUT, no progress UI | Pending (OD-7) |
| Responsiveness | Desktop-first; partial mobile support | Pending |
| Language | Indonesian UI labels mixed with English (Content/FAQ/Feedback pages) | Pending |

## 22. A4 Input Summary

Patterns A4 must consider (evidence inventory only):
- Authentication layout: standalone gradient page, card form, server-side validation alert.
- Dashboard shell: stat cards and a chart card (static in legacy).
- Sidebar/navigation: flat grouped menu, active state, minimise, mobile hamburger, account-dependent visibility.
- Top bar: account dropdown with logout.
- Page header / card title, and the breadcrumb + back arrow (newer screens).
- DataTable: server-side, page size, search, sort indicators, info + pager, export button bar, column visibility.
- Filter toolbar variants: header-row selects, a separate filter card, status chips, date range.
- Row selection + bulk-delete footer.
- Row action group (edit/delete), inline toggle, inline sequence input, status badges.
- Form sections: labels on top, `*` markers, select, select2 (single/multi, AJAX), date/datetime/time, textarea, rich text (Quill), toggle switch.
- Tabs within forms.
- Upload control: file input, hint, oversize error, preview, remove.
- Confirmation modal, info modal, custom modals.
- Feedback: flash alert (auto-fade), toast (top centre), native alert usages.
- Empty state ("No data available in table"), loading ("Processing…").
- Session-expiry handling (legacy: native alert + stale data / login redirect).
- Read-only detail pages.
- Responsive behavior (desktop-first).

## 23. Remaining Unknowns

| ID | Unknown | Reason |
|---|---|---|
| V-U01 | Visual state of screens that failed to render with mock data: FAQ create, feature edit pages (Principal / Global config edit), Gamification, Loyalty, Setting Point pagination | Needs realistic gateway data (A3.1 RT-U02) |
| V-U02 | Action dropdown (kebab) and custom `pagination.js` lists | Not captured (screens need realistic data) |
| V-U03 | AJAX toggle spinner and Gamification loading overlay | Too transient / not reproduced |
| V-U04 | Visual behavior with real long data (wrapping, very wide tables, many badges) | Synthetic data only |
| V-U05 | Keyboard focus / accessibility states | Not in scope of the capture automation |
| V-U06 | Native dialog appearance | Auto-accepted; only the text is recorded |
| Carried | A3.1 gateway/backend unknowns (real payload, backend authorization, storage policy) | Need a test gateway |

## 24. A3.2 GO / NO-GO

### Screenshot Count

```text
Total:   56
Desktop: 48
Tablet:  3
Mobile:  5
```

### Coverage

```text
Login:            OBSERVED
Dashboard:        OBSERVED
Navigation:       OBSERVED (SUPERADMIN, PAYMENT, MARKETING, collapsed, mobile)
DataTable:        OBSERVED (default, search, pagination, filter, selection, actions, error, stuck-processing)
Forms:            OBSERVED (simple, rich, upload/multi-select, read-only)
Modals:           OBSERVED (confirmation, info, custom; native alert text recorded)
Toasts:           OBSERVED (flash success/error/inverted, Toastify error)
Upload:           OBSERVED (default, success, oversize error)
Detail/Edit:      OBSERVED
Empty:            OBSERVED (DataTable); form-related: NOT OBSERVED
Loading:          OBSERVED (DataTable); AJAX/upload/modal: NOT OBSERVED
Expired session:  OBSERVED
Mapper UI:        OBSERVED
Responsive:       OBSERVED (tablet, mobile)
```

The baseline is representative enough to begin A4:
- A real browser was used, and every required category was captured.
- The screenshot, interaction and pattern inventories are complete.
- No secrets are exposed, and no legacy source was modified.
- One A3.1 inference was corrected by runtime evidence (Personalization delete).

A3.2 STATUS: GO
