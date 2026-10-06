# A4 — Component Migration Matrix

| Item | Value |
|---|---|
| Phase | A4 (architecture only) |
| Date | 2026-09-29 |
| Binding | `TARGET_UI_FOUNDATION.md`: Tailwind CSS + shadcn/ui; **`src/components/ui/**` = ATOMS**; no Bootstrap / jQuery / DataTables; no compatibility wrappers |
| Evidence | A1 §6–12 (capabilities, Mapper UI, modals, components), A3.2 §3–19 (visual inventory), B0 component audit |

**Tiers:**
- **ATOM** = `src/components/ui/**`
- **MOLECULE** = `src/components/molecules/**`
- **ORGANISM** = `src/components/organisms/**`
- **TEMPLATE** = `src/components/templates/**`
- **FEATURE** = `src/packages/<f>/presentation/**`

**Decision values:** `REUSE` (exists; use as is), `EXTEND` (exists; add capability), `COMPOSE` (build a new molecule / organism / template from existing atoms), `NEW-DEP` (needs a new dependency; approval required), `REMOVE` (legacy pattern not carried over).

| Legacy Pattern | Evidence | Target Pattern | shadcn Primitive | Tier | Decision | Test |
|---|---|---|---|---|---|---|
| Button (`.btn btn-success/info/danger`, icon buttons) | A3.2 §3, §16 | Button variants (default / secondary / destructive / outline / ghost), icon button with `aria-label` | `ui/button`, `ui/button-group` | ATOM | REUSE | Component: variants, disabled, loading; a11y: accessible name |
| Input (`form_text`, `form_number`, `form_url`, `form_text_icon`) | A1 §11.2 | Input, InputGroup (prefix / suffix), numeric input with sanitisation | `ui/input`, `ui/input-group` | ATOM | REUSE | Component: value, error state, `aria-invalid` |
| Textarea (`form_textarea`) | A1 §11.2 | Textarea | `ui/textarea` | ATOM | REUSE | Component |
| Select (`form_select`, native select) | A1 §11.2 | Select (Radix) / NativeSelect | `ui/select`, `ui/native-select` | ATOM | REUSE | Component + keyboard |
| Select2 single / multi / AJAX (`form_select2`, `form_select2_custom`, `form_select_multiple`, "ALL" option) | A1 §10, §11.2 | Combobox (single), MultipleSelector (multi), AutocompleteSearch (async via a same-origin Route Handler, AbortController), explicit "Select all" | `ui/combobox`, `ui/command`, `ui/popover` | ATOM + MOLECULE (`multiple-selector`, `autocomplete-search`) | REUSE / EXTEND (async cancellation, "select all", empty text) | Component: search, select, clear; Integration: async options |
| Choices.js multi-select (Principal) | A1 §10 | Same as multi-select | `ui/command`, `ui/popover` | MOLECULE | REPLACE (by `multiple-selector`) | Component |
| Checkbox | A1 §11.2, A3.2 §7 | Checkbox (form and table selection) | `ui/checkbox` | ATOM | REUSE | Component; a11y label |
| Radio (`form_radio`) | A1 §11.2 | RadioGroup | `ui/radio-group` | ATOM | REUSE | Component + keyboard |
| Switch / bootstrap-toggle (`form_toggle_switch`, table toggles) | A3.2 §16 | Switch; the in-table toggle is a feature cell using Switch + optimistic pending state | `ui/switch` | ATOM (+ FEATURE cell) | REUSE | Component; Integration: toggle → action → revert on error |
| Modal: confirmation (`#alertdel`, `#alertalldel`, custom confirms) | A1 §12, A3.2 §9 | ConfirmDialog (title, description, destructive confirm, cancel; focus-trapped; Esc closes) | `ui/alert-dialog` | ORGANISM (`organisms/modal/alert-*` existing) | REUSE | Component: open, confirm, cancel, Esc, focus return |
| Modal: info / form / detail (`#validationdel`, `#istock-modal`, `#reviewModal`, reward modals) | A1 §12 | Dialog / Sheet / Drawer | `ui/dialog`, `ui/sheet`, `ui/drawer` | ATOM (+ FEATURE content) | REUSE | Component; a11y focus |
| Native `alert()` / `confirm()` (DataTables warning, "Not Found", upload alerts, stock delete) | A3.2 §9, §20 | Replaced by Toast / inline error / ConfirmDialog | `ui/sonner`, `ui/alert`, `ui/alert-dialog` | — | **REMOVE** (legacy defect) | E2E: no native dialogs on error paths |
| Alert / flash (`.alert alert-info/danger`, auto-fade) | A3.2 §10 | Inline Alert for form-level / page-level messages; **does not auto-fade** for errors | `ui/alert` | ATOM | REUSE | Component |
| Toast (Toastify, toastr) | A3.2 §10 | Sonner toast (success / error / info), top-center or configured; stacked | `ui/sonner` (shadcn Toast is deprecated → Sonner) | ATOM | REUSE | Component; E2E feedback |
| Dropdown / kebab action menu | A1 §8, §12 | DropdownMenu with labelled trigger | `ui/dropdown-menu` | ATOM | REUSE | Component + keyboard |
| Tabs (form tabs, status tabs) | A3.2 §3 | Tabs (roving focus) | `ui/tabs` | ATOM | REUSE | Component |
| Accordion (rule builder) | A1 | Accordion | `ui/accordion` | ATOM / MOLECULE (`rule-builder-accordion`) | REUSE | Component |
| Table (static tables: order items, stock list) | A1 G1 | Table | `ui/table` | ATOM | REUSE | Component |
| DataTable (jQuery DataTables `buildtable`, 32 views) | A1 §7, A2 §9, A3.1 §7, A3.2 §7 | DataTable organism (TanStack Table under shadcn Table): server pagination / sort / filter / search, selection, bulk actions, column visibility, loading / empty / **error + retry**, a11y, URL state | `ui/table`, `ui/checkbox`, `ui/dropdown-menu`, `ui/button`, `ui/skeleton`, `ui/empty` | ORGANISM (`organisms/data-table`) | EXTEND (error / retry / empty / a11y / transitions per contract §10) | Component (states), Integration (URL ↔ query), E2E, a11y, visual |
| Mapper-generated row actions / badges / inline inputs (HTML strings with `data-*` records) | A1 §8, A3.2 §16 | Feature column definitions (React cells) with id-based actions | `ui/button`, `ui/badge`, `ui/switch`, `ui/input`, `ui/dropdown-menu` | FEATURE (`packages/<f>/presentation/table`) | REPLACE (no server-built HTML) | Component per feature |
| Pagination (DataTables pager, `pagination.js` custom pager) | A3.2 §7 | DataTable pagination (page, page size, info text) | `ui/pagination`, `ui/select` | ORGANISM (`data-table-pagination`) | REUSE / EXTEND (labels, a11y) | Component |
| Filter (header-row selects, filter card, status chips, date range) | A3.2 §7, §18 | FilterBar organism: declarative filters (select / multi / date-range / chips) bound to URL state | `ui/select`, `ui/toggle-group`, `ui/popover`, `ui/calendar`, `ui/badge` | ORGANISM (new; from `data-table-toolbar` / `advanced/*`) | COMPOSE / EXTEND | Integration: filter → URL → query |
| Search (DataTables search box, structured type + keyword) | A3.2 §7 | Search input (debounced) + optional search-field select | `ui/input`, `ui/input-group`, `ui/select` | MOLECULE (`search-input`, new) | COMPOSE | Component; Integration |
| Form (Edge components + flash / old / getErrorFor) | A1 §11, A3.1 §9 | RHF + zod + shadcn Form; FormPage template; errors always shown | `ui/form`, `ui/field`, `ui/label` | ATOM + TEMPLATE (`form-page`, new) | REUSE / COMPOSE | Component; Integration (Server Action); E2E |
| Date picker (`form_date`, gijgo datetime, timepicker, bootstrap-datepicker) | A1 §11.2 | DatePicker, DateRangePicker, DateTimePicker | `ui/calendar`, `ui/popover` | MOLECULE (existing pickers) | REUSE (review a11y; the `react-aria` usage in `datetime-picker` is OD-13) | Component + keyboard |
| Upload (`form_image` + `script_image_uploader`, CSV uploads, Principal local upload) | A1 §16, A2 §10, A3.2 §11 | Upload molecule: dropzone / file input, validation, progress, preview, retry / remove; signed-URL flow | `ui/button`, `ui/progress`, `ui/alert` | MOLECULE (`dropzone` existing + `useUpload`) | EXTEND | Component; Integration (sign → PUT); E2E |
| Rich text (Quill) | A1 §11.2, A3.2 §8 | RichTextEditor | — (no shadcn equivalent) | MOLECULE | **NEW-DEP (OD-11)** | Component + round-trip fidelity |
| Badge (status pills, payment badges, toggles as status) | A3.2 §16 | Badge variants; feature status badges map domain status → variant + label | `ui/badge` | ATOM (+ FEATURE `StatusBadge` per feature) | REUSE | Component |
| Breadcrumb (text link + back arrow) | A3.2 §3 | Breadcrumb from the navigation registry, in PageHeader | `ui/breadcrumb` | ORGANISM (`page-header`, new) | COMPOSE | Component |
| Page header / card title | A3.2 §18 | PageHeader (title, description, breadcrumb, primary actions) | `ui/breadcrumb`, `ui/button`, `ui/separator` | ORGANISM (new) | COMPOSE | Component |
| Sidebar (Argon sidebar, 3 email-based menus, minimise, mobile hamburger) | A1 §13, A3.2 §6 | Sidebar from the navigation registry, collapsible, mobile sheet; menu filtered by policy | `ui/sidebar`, `ui/sheet`, `ui/tooltip` | ORGANISM (`organisms/navigation`) + TEMPLATE (`dashboard`) | EXTEND (registry-driven, server-built menu) | Component; E2E per account type |
| Top bar / account dropdown | A3.2 §5 | Header: sidebar trigger, breadcrumb, user menu (logout POST) | `ui/dropdown-menu`, `ui/avatar` | ORGANISM (`organisms/header`) | EXTEND (no client session token reads) | Component; E2E logout |
| Loading ("Processing…", none on pages) | A3.2 §14 | Skeletons (first load), pending indicators (transitions), button spinners | `ui/skeleton`, `ui/spinner` | ATOM / ORGANISM (`data-table-skeleton`, `molecules/loading`) | REUSE | Component; visual |
| Empty ("No data available in table") | A3.2 §13 | Empty state (no data vs no results; optional CTA) | `ui/empty` | ATOM (used by the DataTable organism) | REUSE | Component |
| Error (none: silent empty, stuck processing, native alerts) | A3.1 §7, A3.2 §20 | Error state (inline panel + retry; segment `error.tsx`; AccessDenied; not-found) | `ui/alert`, `ui/empty`, `ui/button` | ORGANISM (`error-state`, new) + TEMPLATE (`access-denied`) | COMPOSE | Component; E2E error paths |
| Stat card / dashboard widgets (static zeros, dead chart) | A3.2 §5 | Card; Chart if real metrics exist | `ui/card`, `ui/chart` | FEATURE (`packages/dashboard`) | REVIEW (OD-10) | Component |
| Mobile app preview mocks (Personalization) | A1 §11.2 | Feature preview component | `ui/card`, `ui/carousel` | FEATURE | COMPOSE (Swiper CDN → `ui/carousel` / embla, already a dependency) | Visual |
| Drag reorder (Group Story banners) | A1 §6 | Sortable list (keyboard-accessible reordering) | `ui/button` (+ `react-easy-sort`, already a dependency) | MOLECULE (new) | COMPOSE | Component + keyboard |
| Tag / ID list input | A1 §11.2 | TagInput | `ui/input`, `ui/badge` | MOLECULE (existing `tag-input`) | REUSE | Component |
| Password input | A3.2 §4 | PasswordInput (with visibility toggle) | `ui/input`, `ui/button` | MOLECULE (existing) | REUSE | Component |
| Templates | A3.2 §18 | `AuthLayout`, `DashboardShell`, `ListPage`, `FormPage`, `DetailPage`, `AccessDenied` | composition | TEMPLATE | COMPOSE (`dashboard.tsx` existing; others new) | Visual; E2E |
| Bootstrap grid / utilities / JS, jQuery, DataTables CSS, FontAwesome / nucleo icons, Argon theme | A0 §7–8 | Tailwind layout utilities; `lucide-react` icons (existing) | — | — | **REMOVE** (binding) | Lint / grep gate: no bootstrap / jquery imports or classes |

**New primitives:** none. Every new item is a composition (molecule / organism / template) of existing atoms, except the rich-text editor, which needs a dependency decision (OD-11).
