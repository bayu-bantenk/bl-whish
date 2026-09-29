Constraint noted. It will govern A4 and all later phases. Checked against the current `frontend/`, it mostly fits. Two points need a decision, and a few gaps should be tracked.

**Fits already**
- **No Bootstrap or jQuery:** `frontend/` has none in `src/` or `package.json`.
- **shadcn/ui is in place:** 52 primitives live in `src/components/ui/`, covering everything in your list: Button, Input, Textarea, Label, Checkbox, RadioGroup, Switch, Select, Combobox, Popover, Dialog, AlertDialog, DropdownMenu, Tabs, Accordion, Tooltip, Badge, Card, Table, Pagination, Calendar and Form. It also has Field, Empty, Skeleton, Spinner, Sheet, Sidebar and Sonner.
- **The tiers exist:** `molecules/`, `organisms/` (including `data-table`) and `templates/` are there.
- **The DataTable already has a base:** `organisms/data-table` plus `shared/hooks/use-data-table.ts` run on TanStack Table under the shadcn `Table`. That already gives server-side pagination, sort, search and filters, row selection, a floating bulk-action bar, column visibility, a skeleton, and URL/query-state sync.

**Needs your decision**
1. **Where the atoms layer lives.** Your structure and the project rules name `components/atoms/`, but it doesn't exist; the shadcn primitives sit in `components/ui/`, which the shadcn CLI writes to (the `aliases.ui` setting in `components.json`). Options:
   - **(a) Treat `components/ui/` as the atoms tier.** No file moves, and the CLI keeps working. Only the rule text needs updating.
   - **(b) Move the primitives to `components/atoms/` and repoint `aliases.ui`.** That touches every import.

   I recommend (a).
2. **Toast and DatePicker.** shadcn has deprecated its Toast in favor of Sonner, and the project already uses Sonner, so "Toast" should mean Sonner. DatePicker has no single shadcn primitive; it's Calendar plus Popover. That makes it a molecule, and `datetime-picker` / `daterange-picker` already exist there.

**Gaps against your DataTable requirements** (nothing to do now; they go into A4)
- There is no **error state or retry**. B0 found the repositories swallow errors, so the table can't tell "failed" from "empty", which is the same silent-failure defect A3.2 captured in the legacy app.
- The **empty state** needs checking against `ui/empty`.
- **Responsive behavior and accessibility** haven't been verified.
- **Data fetching** is client-side in `useEffect` (B0). This depends on the BFF decision (OD-1).

**Legacy capabilities with no shadcn equivalent** (A4 has to justify each one as a new primitive or dependency)

| Legacy capability | Status |
|---|---|
| Rich text (Quill in Banner, Loyalty) | No shadcn or project equivalent. Needs a dependency decision. |
| Drag-reorder (Group Story banners) | `react-easy-sort` is already a dependency. |
| File upload | `react-dropzone` molecule already exists. |
| Inline table toggle / sequence edit | Can be composed from Switch and Input. |

**Design tokens.** `globals.css` holds the shadcn neutral theme. Whether the legacy brand look (orange→blue gradient, GPOS logo) becomes project tokens is an A4 decision. The legacy look is evidence only, not something to reproduce.

**Housekeeping.** B0 found three overlapping primitive libraries installed (`radix-ui`, `@base-ui`, `react-aria`). A4 should say which one backs new work.

I wrote `gpos-b2b-cms/docs/migration/TARGET_UI_FOUNDATION.md` and marked it binding for A4 onward, with option (a) recorded: `src/components/ui/` is the atoms tier. No code or rule files were changed.

It covers:
- **Foundation:** Tailwind + shadcn/ui + project design tokens. No Bootstrap, jQuery or compatibility wrappers. I confirmed `frontend/` contains none today.
- **Tiers:** where each tier lives and which way imports may point, with feature components kept in `packages/<feature>/presentation/`.
- **Reuse rule:** the 5-step check before creating any component, and the forbidden legacy-style wrappers.
- **Capability mapping:** each legacy UI capability mapped to the shadcn atom or existing molecule/organism that covers it. Toast means Sonner, and DatePicker is a molecule (Calendar + Popover), not a primitive.
- **DataTable:** the target is the existing `organisms/data-table` (TanStack Table under shadcn `Table`). What's missing is an error state separate from "empty" (today a failure looks empty, the same defect as the legacy app), retry, the `ui/empty` state, and checks for responsiveness and accessibility.
- **Libraries:** most primitives use `radix-ui`; `@base-ui` is used only by `combobox` and `react-aria` only by `datetime-picker`. Rich text has no shadcn equivalent, so any editor dependency needs your approval in A4.
- **Design tokens:** the legacy look is evidence only; whether any brand colours become tokens is an A4 decision.

One follow-up the doc lists but doesn't do: `frontend/.claude/rules/component-organization.md` (and its `.cursor` and `.github` copies) still names `src/components/atoms/**`. It needs to say `src/components/ui/**` to match option (a). I can make that edit as its own change when you want it.