# A4 — Form Architecture

| Item | Value |
|---|---|
| Phase | A4 (architecture only) |
| Date | 2026-09-29 |
| Evidence | A1 §11 (40 form groups, 22 Edge components), §17 (47 validators), §18 (redirect / flash); A2 §11; A3.1 §9 (4 runtime validation patterns); A3.2 §8; B0 (RHF + zodResolver + shadcn `form`) |
| Related | `A4_API_DATA_ACCESS_ARCHITECTURE.md` §6 (ActionResult), §9 (upload); `TARGET_UI_FOUNDATION.md` §4 |

## 1. Building blocks (reuse before create)

| Need | Target | Tier | Present? |
|---|---|---|---|
| Form state | react-hook-form 7 | library | Yes (direct) |
| Schema validation | zod 4 + `@hookform/resolvers` | library | zod **transitive only**; a direct declaration needs approval (OD-14) |
| Form layout / labels / errors | shadcn `ui/form` (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`) and `ui/field` | ATOM | Yes |
| Inputs | `ui/input`, `textarea`, `select`, `native-select`, `checkbox`, `radio-group`, `switch`, `combobox`, `input-group` | ATOM | Yes |
| Multi / async select (legacy select2) | `molecules/multiple-selector`, `molecules/autocomplete-search` (async via a same-origin Route Handler) | MOLECULE | Yes |
| Dates (legacy `form_date`, gijgo datetime, timepicker, bootstrap-datepicker) | `molecules/datetime-picker`, `daterange-picker`, `datetimerange-picker` (`ui/calendar` + `ui/popover`) | MOLECULE | Yes |
| Password | `molecules/password-input` | MOLECULE | Yes |
| Tags / CSV-like lists | `molecules/tag-input` | MOLECULE | Yes |
| Upload | `molecules/dropzone/file-dropzone` + `useUpload` (API document §9) | MOLECULE | Dropzone yes; `useUpload` to be built |
| Rich text | **See §9** (no shadcn primitive) | — | No |
| Form page layout | `templates/form-page` (header, breadcrumb, sections, sticky actions) | TEMPLATE | To be built from existing atoms |

No custom form primitive is created where a shadcn primitive covers the need (binding).

## 2. Schema and typed form model

- **Location:** `packages/<f>/domain/<f>.schema.ts`. The schema lives in the domain, so it is reusable by both client and server. The project rule places it in presentation (drift, `A4_TARGET_ARCHITECTURE.md` §17); A4 moves schemas to the domain for server reuse and records this as rule drift to fix.
- One schema per operation (`createXSchema`, `updateXSchema`). The form model type comes from `z.infer`. The **domain command** is derived from the parsed form model by the use case (no raw `FormData` beyond the action boundary).
- **Legacy validator parity:** each A1 §17 validator rule is ported as a zod rule, **messages included** (Indonesian copy kept where the legacy message is meaningful). Examples:
  - `ReferralCode`: `referral_code` `required|alphaNumeric`, `points_earned` `requiredWhen status=ACTIVE`, dates DD/MM/YYYY with start ≤ end.
  - `SponsoredProductCreateEdit`: `product_category_id` `requiredWhen sponsor_type=CATEGORY`.
- **Cross-field rules** are expressed with `superRefine` and cover the manual checks listed in A1 §17 (e.g. Notification requires one relation; Group Story start not in the past; Bonus point start < end **for every program type**, whereas legacy only checked `single_item`).

## 3. Client validation

- RHF with the zod resolver, in `mode: 'onTouched'`, then `reValidateMode: 'onChange'`.
- **Every field error is always rendered** via `FormMessage` next to its field, with `aria-invalid` and `aria-describedby`. The legacy "red border only / nothing shown" patterns (A3.1 §9: Content, Global configuration) are not carried over.
- Submit buttons are enabled by default. Validation runs on submit, and the first invalid field is focused. The legacy "Save disabled until complete" gating (Banner, Referral, Group Story) is replaced by explicit errors, because gating gives no reason to the user (IMPROVE; the decision register records it).

## 4. Server validation and error mapping

```text
Server Action (thin, "use server")
  → schema.safeParse(input)                     // never trust the client
      fail → { ok:false, error:{kind:'Validation', fieldErrors} }
  → useCase.command(parsed)                      // authz + gateway call
      gateway 400/422 with field info  → Validation.fieldErrors (repository maps gateway field names → form field names)
      gateway 400 message only         → Business (form-level error)
      Conflict                         → Conflict (form-level, or a specific dialog, e.g. personalization relation conflict)
      Unauthenticated                  → session flow (refresh-once, else login)
  → success → revalidatePath / redirect / toast
```

| Error type | Display |
|---|---|
| Field error | `FormMessage` under the field, plus focus on the first invalid field |
| Form-level error | `ui/alert` (destructive) at the top of the form, persistent until the next submit. It does not fade (legacy alerts auto-faded after ~3.5 s) |
| Conflict with details | Feature dialog (e.g. a relation-conflict table), using `ui/dialog` |
| Success | Sonner toast + navigation (or stay), per the feature rule (§6) |

**Legacy flash keys** (`notification`, `warning`, `Warning`, `error`, `success` …) do not exist in the target. Feedback derives from `ActionResult` (fixes the invisible `Warning` flashes, A1-F01).

## 5. Submit state, reset and dirty state

| Concern | Rule |
|---|---|
| Submit state | `useTransition` / `useActionState` pending → the submit button shows a spinner (`ui/spinner`) and is disabled, and fields become read-only. Double-submit is prevented |
| Reset | "Reset" restores the initial server values (`form.reset(initial)`). After a successful save that stays on the page, the form resets with the returned values |
| Dirty state | `formState.isDirty` drives the unsaved-changes guard (§7) and optionally a "changes not saved" indicator |
| Old input on failure | Always preserved (the client keeps state). Fixes the legacy loss of input on validation failure (A3.1 §9, contradicting the A1 claim) |

## 6. Navigation after save

| Screen type | Default after success |
|---|---|
| Create | Redirect to the list (or to edit, when the legacy flow continued editing: Custom Catalog create → edit; Banner create → edit) + success toast |
| Edit | Stay, reset to the saved values, show a toast. Features that returned to the list in legacy may keep that (per-feature decision in the specification phase) |
| Wizard (legacy create → POST-rendered summary → store) | One client-side multi-step form (steps + review step), a single Server Action on confirm, with draft / publish modes where legacy had them (Poin bonus program, Voucher, Inject Point) |

## 7. Unsaved changes

- `beforeunload` guard when `isDirty` (browser-native prompt, the only allowed native dialog).
- In-app navigation guard: the `FormPage` template intercepts clicks on internal links / back buttons while dirty and asks via `ui/alert-dialog` (legacy: Notification `changeupdate` modal, Gamification cancel modal, Folamil leave modal).
- **Limitation:** the App Router has no route-change blocking API. The guard therefore covers template-controlled navigation and `beforeunload` only. This is an accepted limitation, to be tested in E2E.

## 8. File upload in forms

- The Upload molecule sets the field value to the returned `fileUrl` (API document §9).
- The field is "pending" while uploading. Submit is blocked while any upload is in flight, with an explicit message.
- Validation feedback (type / size / ratio) is shown inline under the field; upload failures show inline errors with Retry / Remove (fixes the legacy console-only errors).
- Preview for images; file name + size for CSV.

## 9. RICH_TEXT_EDITOR_DECISION

| Item | Value |
|---|---|
| Requirement evidence | Legacy Quill 1.3.6 (CDN) editors: Banner `content` (create / edit), Loyalty "Cara Dapat Poin" (`#getPointModal`), `components/form_texteditor_quill` (3 uses). The content is **stored as HTML** and rendered raw (`{{{ value }}}`) in legacy (A1 §11.2) |
| shadcn/ui | No rich-text editor primitive |
| Present dependencies | None suitable (no Quill / Tiptap / Lexical in `frontend/`) |
| Decision | **DEFERRED — NEW DEPENDENCY, APPROVAL REQUIRED (OD-11).** No dependency is installed in A4 |

**Options to evaluate:**

| Option | Notes |
|---|---|
| A. Tiptap (ProseMirror, headless) | Composes with shadcn atoms for the toolbar (Toggle / ToggleGroup / DropdownMenu). Outputs HTML. Must be tested against existing Quill HTML (lists, links, headers, images) |
| B. Lexical | Headless; HTML import / export via its serializers. Same compatibility test required |
| C. Quill 2 | Closest format parity with the existing content. A React integration wrapper is needed, and its styling is non-Tailwind (a theme override would be required) |
| D. No editor (textarea / markdown) | No dependency, but it **breaks compatibility** with the stored HTML content and the downstream consumers (mobile app) |

**Evaluation criteria:**
1. Round-trip fidelity with existing stored HTML (sample content from the backend, runtime dependency).
2. Output format accepted by downstream consumers (backend / mobile, OD-11).
3. Accessibility (keyboard, labels).
4. Bundle impact (load via `next/dynamic` only on screens that need it).
5. Licence.
6. Maintenance.

**Security:**
- HTML produced by the editor must be **sanitized before any rendering in the CMS** (preview).
- Server-side sanitization responsibility is shared with the backend (security document §4).
- A sanitizer library would be another NEW DEPENDENCY (OD-11).

## 10. Other field behaviors (legacy evidence → target rule)

| Legacy | Target |
|---|---|
| IDR formatting (`formatRupiah`, `.price-format`) | Number fields store numbers. Display uses `Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR'})`. Inputs may show grouping |
| Dates shown in server-local time (WIB) (A3.2: `2026-09-01T08:00Z` shown as `15:00`) | Timezone display policy: OD-21 (default proposal: Asia/Jakarta, explicit) |
| Toggle stored as `'true'` / `'false'` strings, `'on'` / `'off'` | Booleans in the domain; the repository maps to wire values |
| select2 "ALL" pseudo-option (select every option) | An explicit "Select all" action in the multi-select molecule; the wire mapping is kept in the repository (the "ALL" literal is removed before sending, as legacy did) |
| Comma-separated ID textareas (customer ids) | `tag-input` or textarea + zod transform to `string[]`, with a validation message on invalid tokens |
| Mutually exclusive relation fields (Channel config) | Encoded in the schema (discriminated union) + UI disabling, with an explanation |
