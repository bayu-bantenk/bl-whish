**A5.5 status: GO-WITH-RISKS.** The DataTable foundation works end to end in a real browser, and the first legacy endpoint (the Content list) is now bridged into the new architecture from evidence rather than guesses. It isn't GO because the real backend was never reached: there's no test gateway and the network blocks it, so no real-backend cURL exists. Nothing is committed yet.

**Tests:** typecheck, `npm run quality`, `next build` and the bundle check all pass. Lint has 0 errors and 28 warnings (the one new warning is TanStack's own React Compiler notice). Vitest is 388 passed, 0 failed, 0 skipped (was 318). In the A5.1–A5.4 re-check (login, refresh, 5 concurrent navigations → 1 refresh, forged cookie, logout, shell, mobile menu, 404s, authorization) nothing regressed.

**Evidence and what it proves**
- I ran the unmodified legacy app locally against a small capture server standing in for the gateway, and recorded exactly what legacy sends: `GET /api/v1/cms/contents?sort_by&asc_desc&page&take&keyword` with a Bearer token and no API key.
  - `keyword` is always sent, even empty.
  - The sort direction is lower case.
  - Legacy also sends the same values as a JSON body on the GET.
- The response shape comes from legacy code, not from a real backend: `{code:200, data:{rows, total_rows}}`.
- The capture also confirmed legacy's silent failures. 401, 403, 422 and 500 all come back as an empty table, and a malformed response renders rows of "undefined". The new code shows each of these as its own state instead.
- Every fact is labelled (verified at runtime / from legacy code / inferred / unknown) in `docs/architecture/contracts/legacy-api/content-list.md`. The sanitized fixtures are in `test/fixtures/api/legacy-content-list/`, and a test checks them for tokens, keys and cookies.
- Cleanup: the 3 legacy session files the run created were deleted, and the legacy repo is unchanged.

**What was built**
- **Table contracts** (`src/shared/table/`): `TableQuery`, `Page<T>`, `TableSpec` and a URL codec. They use A4's names, so the brief's "PageResult" is A4's `Page<T>`.
  - The URL format is `?page&per_page&sort=field.asc&q`.
  - Unknown keys or invalid values fall back to defaults, so a hand-edited URL never breaks the page.
- **Content list reference** (`test/fixtures/content-list/`, a test fixture, not a production route):
  - the legacy wire names live only in the repository's DTO file;
  - the use case checks `content.read`, then validates the query, then calls the repository;
  - the page follows the A5.3 pattern.
- **Shared envelope helper:** I moved the `{code, message, data}` parsing out of the auth repository into `src/shared/infrastructure/http/` so both repositories use it. Auth behaviour is unchanged.
- **Server-driven DataTable** (new files in `src/components/organisms/data-table/`):
  - TanStack Table runs in manual mode under the shadcn Table, so there's no client-side sorting, filtering or fetching.
  - Every interaction changes the URL and the server renders fresh data.
  - The table has separate states for loading, data, no data, no results, page out of range, and error with retry. 403 shows "Akses ditolak".
  - Labels are Indonesian, sortable headers carry `aria-sort`, and a live region announces results.
  - Architecture rules keep TanStack out of domain, use case and repository code, and every rule was checked by planting a violation.
- **Bugs found and fixed along the way:**
  - A test caught search re-firing a stale value after pressing Enter.
  - Lint flagged state being set inside an effect.
  - A script mistake corrupted the architecture test file mid-edit; I repaired it and re-verified.

**Browser run** (headless Chrome, 18 checks, all pass): one gateway call per navigation, pagination, sort with page reset, debounced search, reload and Back keep state, page size, out-of-range and no-results states, 500 with working retry, malformed → error without retry, 403, rows kept while loading, no page overflow at 320/375 px, keyboard sorting with focus kept. The temporary route I used for this has been removed.

**Risks**
- **RK-A55-01 (High):** real response types and error bodies are unverified.
- **RK-A55-02 (Medium):** the new code sends list parameters in the query string only. If the backend reads only the GET body (which legacy also sends), lists will break.
- **RK-A55-03 (Medium):** the strict mapper will show a Contract error if real field types differ from the evidence (for example, `total_rows` as a string).
- **Low:**
  - the date column shows `content_date` but sorts by `created_at`, as in legacy;
  - the old B0 DataTable components (unused, client-side, depend on zod) now sit next to the new one;
  - the fixture's service loader is test-only and must not be copied into features;
  - the column picker is hidden on narrow screens;
  - the browser harness lives outside CI.

**Questions for you / the backend team**
1. Should the Content date column sort by the date it shows (`content_date`) or keep legacy's `created_at`?
2. Does the gateway honour list parameters in the query string?
3. For invalid list parameters, does the backend return 400 or 422, and in what shape?
4. Is `total_rows` counted after the search filter?
5. What's the maximum page size? Legacy's "All" option isn't carried over.
6. Is `asc_desc` case-sensitive?

**Deferred**
- **Content feature phase:** move the fixture into `src/packages/content/`, wire it into `composeFeatures()`, add a `content.read` grant, and activate the route.
- **A5.6:** forms, upload and bulk actions.
- **A5.7:** E2E tests in CI with axe.
- **Cleanup:** consolidate the old B0 table components.
- **Backend:** verify this contract on a real gateway.

Report: `docs/architecture/reviews/A5.5_DATATABLE_API_CONTRACT_FOUNDATION.md`
