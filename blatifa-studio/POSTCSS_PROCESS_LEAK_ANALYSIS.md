# PostCSS Process Leak — Analysis

> **Ringkasan (ID):** Ratusan proses `postcss.js` berasal dari **pool worker PostCSS milik Turbopack** di dalam `next-server` (Next.js 16.1.6, `npm run dev` di `gpos-b2b-web`).
>
> Proses-proses itu **bukan yatim** (*orphan*): semua masih terhubung ke `next-server` yang hidup, dan tidak pernah dipensiunkan.
>
> **Start/stop server bersih.** Uji berulang di salinan proyek (Ctrl+C, kill parent, tutup terminal) menyisakan 0 proses. Jadi kode startup/shutdown proyek Anda (`next dev` polos) tidak bermasalah, dan **tidak ada perbaikan lifecycle yang didukung bukti**.
>
> **Kebocoran tidak bisa direproduksi** di 6 skenario terkontrol: request halaman, edit file, request paralel, browser headless, cache `.next` Anda sendiri. Pool selalu berhenti di 1–7 worker.
>
> Pemicunya masih tidak diketahui. Mitigasi yang terbukti tanpa worker: `next dev --webpack`. Saya **tidak mengubah file apa pun di proyek Anda** dan tidak menghentikan proses Anda.

Date: 2026-11-02/03. Project: `~/Developments/gpos-b2b-repo/gpos-b2b-web` (git, uncommitted changes present, so treated read-only).

## 1. What was observed (live, read-only)

| When | Parent | Workers | Details |
|---|---|---|---|
| 2026-11-02 17:05 | `next-server (v16.1.6)` pid 25199 ← `npm run dev` pid 25163, started 15:35:01 | **355** | 17 started in the 15:00 hour, **338 in the 16:00 hour**. Swap grew to 20 GiB; disk free 0.44 GiB |
| 2026-11-03 09:05 | pid 79966, started 08:45:55 | **113** | bursts: 1 @08:46, **50 @08:47, 46 @08:48**, 16 @09:00. All in state S (idle). 40/40 sampled hold an ESTABLISHED TCP link to the parent |
| 2026-11-03 09:28 | — | 0 | the user stopped the server |

Process tree: `npm run dev` → `node …/.bin/next dev` → `next-server` → N × `node …/.next/dev/build/postcss.js <port>`. No duplicate Next servers were running at either observation (one `next-server` each time).

Raw: `evidence/leak/live_observation_user_instance.txt`.

## 2. Mechanism (VERIFIED from artefacts)

- Next 16 `next dev` uses **Turbopack by default** (log banner: `Next.js 16.1.6 (Turbopack)`).
- Turbopack runs `postcss.config.js` (postcss-import, tailwindcss/nesting, tailwindcss 3.3.2, autoprefixer) in **Node.js worker processes**. The Next.js binary contains `turbopack_node::pool::NodeJsPool` and `idle_worker_count`.
- Each worker keeps a localhost TCP connection to `next-server`. Workers are **pool members, not orphans**: they die with their parent (§3).
- 8 CPUs. Both observed counts are close to multiples of 8 (113 ≈ 14×8, 355 ≈ 44×8). This is *consistent with* several pools of up to 8 workers each, but it is **not proven** (UNVERIFIED).

## 3. Lifecycle tests (reproduction harness, on a disposable copy)

Harness: `tools/devserver_leak_check.py`.
- Runs on an **APFS clone** of the project in the scratchpad, without `.env`, `.env-bak` or `.git`. The clone uses almost no disk space.
- Starts `next dev` on ports 3917/3918, sends requests, counts the process tree, and stops the server in three ways.
- It refuses any project path outside the scratchpad (tested), and only signals its own process group.

| Scenario | Peak workers | After stop | Orphans | Result |
|---|---|---|---|---|
| Turbopack, cold cache, 7 routes × 2 (SSR GET) | 3 | 0 | 0 | stable |
| Same, stopped by **Ctrl+C** (SIGINT to the group) | 3 | 0 | 0 | clean |
| Same, stopped by **SIGTERM to the parent only** (IDE stop / kill) | 0 (warm cache) | 0 | 0 | clean |
| Same, **terminal closed** (SIGHUP to the group) | 0 | 0 | 0 | clean |
| 12 file edits × 2 cycles (a new Tailwind class each time, HMR) | 2 | 0 | 0 | stable |
| Cold cache, 8 routes + 3 bursts of 24 **parallel** requests + 5 edits | 7 | 0 | 0 | bounded (< 8 CPUs) |
| **Headless Chrome** (client chunks + HMR socket) over 8 routes + 8 edits | 5 | 0 | 0 | bounded |
| Same with a **clone of the user's own `.next` cache** (1.4 GiB) | 5 | 0 | 0 | bounded |
| `next dev --webpack`, same routes | **0** | 0 | 0 | no worker processes at all |

Raw: `evidence/leak/turbopack*.jsonl`.

## 4. Findings

| # | Question from the brief | Answer | Status |
|---|---|---|---|
| 1 | Parent process and tree | `npm run dev` → `next dev` → `next-server` → `postcss.js` workers | VERIFIED |
| 2 | Startup/shutdown implementation | `"dev": "next dev"`; no custom server, wrapper, nodemon or restart script | VERIFIED |
| 3 | Why children were not terminated | They were never orphaned: the parent kept them alive as pool members. The **pool grew without shrinking**. Why it grew to 355 is **not reproduced** | PARTIALLY VERIFIED |
| 4 | Duplicate Next.js servers | None at the time of either observation | VERIFIED (2 samples) |
| 5 | Watchers / restarts creating orphans | Edits and all 3 stop modes leave 0 orphans | VERIFIED (clone) |
| 6 | Safe lifecycle fix | **Not supported by evidence**. The lifecycle is clean; the growth is inside Next/Turbopack | — |
| 7 | Regression test | Harness + unit tests (`tests/unit/test_devserver_tool.py`). Process counts measured before/after 9 start-stop cycles | VERIFIED |

Remaining differences between the user's sessions and the reproduction (UNVERIFIED triggers):
- real `.env` and backend calls: the log shows `uncaughtException: Error: aborted` and Axios 15 s timeouts;
- **API routes** (`/api/*`) compiled during the session, which I deliberately did not call (§6);
- hours-long sessions with many different files edited;
- several real browser tabs reconnecting after a restart.

## 5. Recommendations (not applied: your project, your decision)

| # | Action | Effect | Risk |
|---|---|---|---|
| R1 | Run `npx next dev --webpack` (or change the script to `"dev": "next dev --webpack"`) | 0 PostCSS worker processes (measured) | slower HMR than Turbopack; webpack mode is supported in Next 16 |
| R2 | Watch the count while developing: `pgrep -f '.next/dev/build/postcss.js' \| wc -l`. Restart the dev server when it climbs past ~20 | prevents the swap/disk spiral | manual |
| R3 | Fix the backend `uncaughtException: aborted` / timeouts (possible trigger, UNVERIFIED) | fewer recompiles/retries | code change in your project |
| R4 | Upgrade Next.js when a release mentions Turbopack Node pool / PostCSS worker fixes. No confirmed upstream fix was found: a related *Windows, orphaned-after-exit* report exists (claudeissues #67163), but it is a different symptom | — | upgrade testing |
| R5 | To find the trigger: run the harness with your real `.env` on the clone, plus a browser session using your usual flow, and log the worker count every minute | identifies the trigger | needs your OK (real backend calls) |

## 6. What I deliberately did not do

- I did not edit any file in `gpos-b2b-web`. Probe edits were made only in the scratchpad clone.
- I did not stop or signal your dev server. Only harness-owned processes were stopped.
- I did not call your API routes. Some handlers (e.g. `account/delete/request`) could reach the real backend even on GET.
- I did not copy `.env` / `.env-bak`. The `.next` clone may contain build-time values inlined by `next.config.js`'s `env` block; it stays in the session scratchpad and was not read.
