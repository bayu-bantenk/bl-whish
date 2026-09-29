# Target UI Foundation (binding constraint)

| Item | Value |
|---|---|
| Status | **Binding** for A4 and every later phase |
| Date | 2026-09-28 |
| Decided by | Project owner |
| Applies to | `frontend/` (Next.js 16 target) |
| Related | `VISUAL_BASELINE.md` (legacy evidence), B0 architecture baseline |

## 1. Foundation

```text
Tailwind CSS  +  shadcn/ui  +  project design tokens
```

- **Tailwind CSS is the only styling foundation.**
- **shadcn/ui components are used wherever an equivalent exists.**
- **Bootstrap must not be introduced**:
  - no Bootstrap CSS, utility classes, grid, components or JavaScript;
  - no jQuery or jQuery UI;
  - no Bootstrap-compatible abstractions.
- Legacy Bootstrap classes may appear **only as migration evidence** in `docs/`. They never appear in target code.

Verified 2026-09-28: `frontend/src` and `frontend/package.json` contain no Bootstrap, jQuery or DataTables.net references.

## 2. Atomic component architecture

**Decision: option (a).** The existing `src/components/ui/` directory **is the atoms tier**.

| Tier | Location | Contents |
|---|---|---|
| Atoms | `src/components/ui/` | shadcn/ui primitives as installed by the shadcn CLI (`components.json` → `aliases.ui = @/components/ui`). Minimal project wrappers only when strictly necessary |
| Molecules | `src/components/molecules/` | Compositions of atoms; small reusable interaction patterns |
| Organisms | `src/components/organisms/` | Larger reusable patterns: DataTable, FilterBar, PageHeader, Sidebar/Navigation, complex forms |
| Templates | `src/components/templates/` | Reusable page-level layouts |
| Features | `src/packages/<feature>/presentation/` | Business/domain-specific components. **Never** placed in the generic tiers |

**Consequences of option (a):**
- Primitives are **not moved**, and the shadcn CLI (`npx shadcn add …`) keeps writing into `components/ui/` unchanged.
- The project rules name `src/components/atoms/**`, which does not exist:
  - `frontend/.claude/rules/component-organization.md`
  - its mirrors in `.cursor/rules/` and `.github/instructions/`

  When the rules are next edited, the atoms entry must read `src/components/ui/**`. That edit is a **follow-up task** and is not part of this document.
- **Dependency direction:**
  - `ui` imports nothing from molecules, organisms, templates or packages.
  - molecules → `ui`
  - organisms → molecules / `ui`
  - templates → organisms / molecules / `ui`
  - features → any tier

## 3. Component reuse rule

Before creating any component:

1. Check whether shadcn/ui provides it.
2. If it does, use or adapt the shadcn/ui component.
3. If composition is needed, build a molecule or organism from atoms.
4. Create a new primitive only when no suitable shadcn/ui primitive exists.
5. Document why each new primitive was introduced (§6 records the known cases).

**Forbidden:** compatibility abstractions whose purpose is to reproduce the legacy implementation. For example: `LegacyButton`, `LegacyInput`, `BootstrapButton`, `BootstrapInput`, `DataTablesWrapper`.

## 4. Capability mapping (legacy evidence → target building block)

| Legacy UI capability (VISUAL_BASELINE) | Target building block | Tier | Status in `frontend/` |
|---|---|---|---|
| Buttons, inputs, textarea, labels | `button`, `input`, `textarea`, `label`, `field`, `input-group` | Atom | Present |
| Checkbox, radio, toggle switch | `checkbox`, `radio-group`, `switch` | Atom | Present |
| Select / select2 (single, multi, AJAX) | `select`, `native-select`, `combobox`; multi → `molecules/multiple-selector`; async search → `molecules/autocomplete-search` | Atom / Molecule | Present |
| Date, date range, date-time | `calendar` + `popover` → `molecules/datetime-picker`, `daterange-picker`, `datetimerange-picker` | Molecule | Present (**DatePicker is a composition, not a primitive**) |
| Tabs, accordion | `tabs`, `accordion` | Atom | Present |
| Confirmation modal | `alert-dialog` → `organisms/modal/alert-*` | Atom / Organism | Present |
| Info / form modal | `dialog`, `sheet`, `drawer` | Atom | Present |
| Action menu (kebab) | `dropdown-menu` | Atom | Present |
| Status badge | `badge` | Atom | Present |
| Toast / flash | **Sonner** (`ui/sonner`). shadcn has deprecated its Toast in favor of Sonner, so "Toast" means Sonner in this project | Atom | Present |
| Inline alert | `alert` | Atom | Present |
| Card, page sections | `card`, `separator` | Atom | Present |
| Breadcrumb | `breadcrumb` | Atom | Present |
| Sidebar navigation | `sidebar` → `organisms/navigation`, `templates/dashboard` | Atom / Organism / Template | Present |
| Tooltip | `tooltip` | Atom | Present |
| Pagination | `pagination` (+ DataTable pager) | Atom / Organism | Present |
| Empty state | `empty` | Atom | Present (not yet wired into DataTable, see §5) |
| Loading | `skeleton`, `spinner`, `organisms/data-table/data-table-skeleton`, `molecules/loading` | Atom / Organism | Present |
| Form + validation | `form` (react-hook-form + zod), `field` | Atom | Present |
| File / image upload | `molecules/dropzone/file-dropzone` (react-dropzone) | Molecule | Present |
| Tag input | `molecules/tag-input` | Molecule | Present |
| Password input | `molecules/password-input` | Molecule | Present |
| Rich text (legacy Quill) | **No shadcn or project equivalent** | — | **Gap: needs a new-primitive/dependency decision (§6)** |
| Drag reorder (legacy Group Story) | `react-easy-sort` (already a dependency) composed with atoms | Molecule | Dependency present; no molecule yet |
| Inline table toggle / sequence edit | `switch` / `input` inside DataTable cells | Feature column definitions | Composable |
| Charts (legacy dashboard) | `chart` (recharts) | Atom | Present |

## 5. DataTable

- **Legacy jQuery DataTables is an implementation detail and is not migrated.**
- The target DataTable is `src/components/organisms/data-table/`:
  - the shadcn `ui/table` presentation layer;
  - **TanStack Table** as the engine, operating under that presentation layer;
  - state handled by `src/shared/hooks/use-data-table.ts`.
- **Server-rendered HTML cells are not reproduced.** Cells are React column definitions in `packages/<feature>/presentation/table/*.table-columns.tsx`.

| Required capability | Current state (verified 2026-09-28) | Gap to close in A4 |
|---|---|---|
| Server-side pagination | Present (`pageCount`, URL `page`/`per_page`) | — |
| Server-side sorting | Present (URL `sort`) | — |
| Server-side filtering | Present (faceted / advanced filters, URL params) | — |
| Search | Present (searchable columns) | — |
| Row selection | Present | — |
| Bulk action | Present (`data-table-floating-bar`, `deleteRowsAction`) | Generalise beyond delete |
| Column visibility | Present (`data-table-view-options`) | — |
| Loading state | Present (`data-table-skeleton`) | Wire it to the data-fetching state |
| Empty state | Plain "No results." row (`data-table.tsx:245`) | Use `ui/empty` |
| **Error state** | **Absent.** The repositories/usecases swallow errors (B0), so failure looks like an empty table, which is the same defect as the legacy app (A3.2 §20) | **Required**: an error state distinct from empty |
| **Retry** | **Absent** | **Required** |
| Responsive behavior | Not verified | Verify / define |
| Accessibility | Not verified | Verify (keyboard, labels, focus, announcements) |
| URL/query-state sync | Present (`router.push` with search params) | Confirm per screen ("where appropriate") |

**Data fetching** is currently client-side in `useEffect` (B0). How data reaches the table depends on the pending BFF decision (A2 OD-1) and is **not** fixed by this document.

## 6. Primitive-library and new-primitive register

**Primitive libraries currently present** (verified by import scan):

| Library | Used by |
|---|---|
| `radix-ui` | 33 of the `ui/` primitives (the default shadcn base) |
| `@base-ui/react` | `ui/combobox.tsx` only |
| `react-aria` / `react-stately` | `molecules/datetime-picker/datetime-picker.tsx` only |
| Others (shadcn defaults) | `cmdk` (command), `vaul` (drawer), `sonner`, `react-day-picker` (calendar), `input-otp`, `embla-carousel-react`, `recharts`, `react-resizable-panels` |

**Rules:**
- New work uses the shadcn/ui primitive (Radix-based by default).
- Do not introduce additional headless libraries.
- Whether to consolidate `@base-ui` / `react-aria` is an **open A4 decision**. Nothing is removed by this document.

**New primitive / dependency decisions pending (record the reason when resolved):**

| Need | Why no shadcn equivalent | Decision |
|---|---|---|
| Rich text editor (legacy Quill fields: Banner content, Loyalty "Cara Dapat Poin") | shadcn/ui ships no editor | **Pending A4.** Requires explicit approval for any new dependency (B0 rule: no new dependencies unless requested) |

## 7. Styling and design tokens

- Tokens live in `src/shared/styles/globals.css` as CSS variables (`@theme inline`, currently shadcn neutral, base color `neutral`) and are consumed through Tailwind.
- **The legacy brand appearance is evidence, not a requirement.** That covers the orange→blue gradient, the GPOS logo, Argon colors and fonts. Whether any of it becomes project tokens is an **A4 decision**.
- No Bootstrap spacing, grid or responsive classes. Layout and responsiveness use Tailwind.

## 8. Visual migration principle

`VISUAL_BASELINE.md` documents what the legacy CMS looks like and how it behaves. It is **not** a requirement to reproduce Bootstrap markup, CSS, spacing, modals, tables or responsive implementation.

The target preserves the **intended UX and capability** (the full A1 capability inventory), implemented with Tailwind CSS, shadcn/ui and accessible modern React patterns. Legacy defects recorded in A1–A3.2 (silent errors, inverted flashes, hidden validation, native `alert()` dialogs, `href="null"` links) are **not** carried over.

## 9. Follow-ups (not done here)

1. Update `frontend/.claude/rules/component-organization.md` (and its `.cursor` / `.github` mirrors) so that the atoms tier reads `src/components/ui/**` (option (a)).
2. A4: DataTable error state + retry; empty state via `ui/empty`; responsive and accessibility verification.
3. A4: rich-text editor decision.
4. A4: design-token decision (brand vs neutral).
5. A4: headless-library consolidation decision (`@base-ui`, `react-aria`).
