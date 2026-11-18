# Phase 5.3g.4.4: R-2 Balance Reading Provenance and Single-Use Authorization (design specification)

> **Ringkasan (ID):**
> - Dokumen ini adalah spesifikasi desain R-2. Isinya keputusan AC-1 s.d. AC-8 dan U-1 s.d. U-9 yang sudah
>   disetujui.
> - Status: **Design Freeze BELUM DITETAPKAN. Implementasi NOT AUTHORIZED. Pengujian NOT AUTHORIZED.**
> - R-2 hanya membuktikan bahwa sebuah `BalanceReading` diperoleh lewat jalur akuisisi yang disetujui, di dalam
>   proses Python yang sama, dan hanya dipakai sekali untuk satu otorisasi approval.
> - R-2 **tidak** membuktikan bahwa Page berasal dari Google Flow, tidak membuktikan saldo yang sebenarnya, dan tidak
>   memberi jaminan lintas proses.
> - Hal yang belum pasti ditulis sebagai **OPEN SPECIFICATION ISSUE** (§11), bukan disembunyikan.

## 0. Status

| Item | Status |
|---|---|
| Phase ID | `5.3g.4.4` |
| Name | R-2: Balance Reading Provenance and Single-Use Authorization |
| Design reconciliation | AC-1 to AC-8 and U-1 to U-9 approved by the user |
| Documentation | this document and `SAFETY_AUDIT.md` (in progress, 2026-11-18) |
| Design freeze | **NOT YET DECLARED** |
| Implementation | **NOT AUTHORIZED** |
| Testing | **NOT AUTHORIZED** |
| Hash / manifest | **NOT UPDATED** (plan only, §9) |

Every source reference below is to the code as read (read-only) on 2026-11-18. Nothing described as "new" or
"changed" exists yet.

## 1. Problem (from 5.3g.4.2)

`credit_evidence` judges freshness from `BalanceReading.read_at`, but where `read_at` came from is not
authenticated:

- a re-stamped reading (`replace(old, read_at=now)`) or a directly constructed `BalanceReading` is judged fresh;
- 5.3g.4.2 records this as OPEN and deferred to R-2 (`docs/phase-5.3g4.2/SAFETY_AUDIT.md` §5 item 1, line 91;
  `tests/unit/test_phase5_3g4_2_freshness.py:295-302`);
- a single reading can also be used for more than one approval.

R-2 closes both gaps for the approval path only, within one process.

## 2. Trust boundary (Option C)

> `acquire_balance(page)` verifies the approved same-process acquisition path, but does not prove that the
> supplied Page belongs to Google Flow.

R-2 proves only this: the reading object was produced by `acquire_balance` in this Python process, it has not been
changed since, and it has not already authorized an approval.

R-2 does **not** prove or protect:

| Not covered | Why |
|---|---|
| that the Page is Google Flow | `acquire_balance` accepts any object with `locator("body").aria_snapshot()`. `live_probe.ReadOnlyPage` wraps whatever `page` it is given (`src/blatifa/flow/live_probe.py:75-77`). **A fake Page can still be supplied**, and the unit tests will do exactly that (§9.3) |
| that the balance is the real account balance | follows from the row above |
| deliberate manipulation inside the same Python process | monkeypatching `provenance`, writing to its private registry, `object.__setattr__` races (§7.3), or replacing `gates` functions are all outside the guarantee |
| other processes | the registry is process-local memory. Two processes can each acquire a reading of the same balance and each approve once |
| budget coordination across processes | not designed here |

**Source authenticity and cross-process budget coordination are separate prerequisites.** Live approval stays
blocked until both are handled in their own phases with their own approval (`SAFETY_AUDIT.md` §4).

## 3. Components

| Component | Status | Role |
|---|---|---|
| `src/blatifa/account/provenance.py` | new | acquisition (`acquire_balance`), the process-local registry, its lock, the single-use check and consumption |
| `src/blatifa/production/gates.py` | changed | new `Block` members (§6.2) and `authorize_approval` (§6) |
| `src/blatifa/production/runner.py` | changed | `_decide_on_quote` uses one local reading and `authorize_approval` (§8) |
| `src/blatifa/account/balance.py` | **unchanged** | `BalanceReading` and `read_from_tree` stay as they are |
| `credit_evidence`, `approval_balance`, `approval_gate`, `preflight_gate` | **unchanged** | `credit_evidence` never touches the registry |
| manual protocol (`user_reported`, `USER_REPORTED`) | **unchanged** | never VERIFIED, never registered |
| SimulatedFlow with a raw `int` | **unchanged behaviour** | separate path, no registry (U-1) |

## 4. Acquisition: `acquire_balance(page)`

1. Record `t_mono = time.monotonic()` **before** calling `page.locator("body").aria_snapshot()`, so the recorded age
   also includes the snapshot itself. A reader wall-clock time, if recorded, is diagnostic only. It is never compared
   with `read_at` and never used in a decision (AC-4).
2. Call `page.locator("body").aria_snapshot()`. **Any exception is propagated** and nothing is registered (AC-2).
3. `flow.aria.parse(text)`. **`AriaParseError` is propagated**; it is not turned into UNAVAILABLE (U-6). This
   differs on purpose from `live_probe.body_tree`, which maps `AriaParseError` to `None`
   (`src/blatifa/flow/live_probe.py:310-314`); `body_tree` is not changed.
4. `account.balance.read_from_tree(tree)` classifies the tree. It stays a pure classifier: no clock argument, no
   registry, no provenance (`src/blatifa/account/balance.py:209-249`; its source must keep passing the
   forbidden-word check in `tests/unit/test_phase5_3g3_credit_contract.py:244-253`).
5. Register the result **only if** `type(reading) is BalanceReading` and
   `reading.status is BalanceStatus.VERIFIED_WITHOUT_INTERACTION`. Every other result is returned unregistered.
6. Return the reading object.

**Registry entry** (AC-1). The entry is keyed by `id(reading)` and holds:

- `ref`: `weakref.ref(reading)`, with **no callback** (§5.3);
- `state`: AVAILABLE or CONSUMED;
- `t_mono`;
- snapshot: `status`, `verified_balance`, `read_at`, copied from the object at registration.

`BalanceReading` supports weak references: it is a plain `@dataclass(frozen=True)` with no `slots`
(`balance.py:134`).

## 5. Lifecycle and state machine

### 5.1 States

| State | Stored? | Meaning |
|---|---|---|
| UNREGISTERED | no entry | never acquired through `acquire_balance`, not VERIFIED, a copy, a subclass, or from before a restart |
| AVAILABLE | yes | acquired, not yet used for a successful final authorization |
| CONSUMED | yes | has authorized exactly one approval; never usable again |
| GONE | internal only | the entry's weakref is dead (object collected) or the process ended. Not a public block code (AC-5) |
| STALE | **never stored** | a derived assessment: the wall-clock or monotonic check fails at evaluation time |

### 5.2 Transitions

| From | To | Only when |
|---|---|---|
| UNREGISTERED | AVAILABLE | `acquire_balance` registers a VERIFIED_WITHOUT_INTERACTION reading of exact type |
| AVAILABLE | CONSUMED | a final `authorize_approval` returns allowed, inside the lock, before the result is returned |
| AVAILABLE / CONSUMED | GONE | the object is collected (weakref dead), or the process ends (registry is memory only) |
| CONSUMED | anything else | never |
| AVAILABLE | AVAILABLE | a preliminary gate, or a final authorization that is blocked, leaves it unchanged (AC-6, Q3) |

A reading is assessed STALE whenever a freshness check fails; nothing is stored for it.

### 5.3 Identity rules

- **Exact object identity.** An entry matches only if `entry.ref() is reading`. Equality is never used.
- **No `WeakKeyDictionary` or `WeakSet`.** `BalanceReading` and `BalanceParse` are dataclasses with `eq=True`, so
  they compare and hash by value. A value-keyed structure would treat an equal copy as the registered object.
- **Copies get no provenance.** `dataclasses.replace`, `copy.copy`, `copy.deepcopy`, pickle round-trips, the
  constructor, and any reconstruction produce a new object with a new `id`. It is UNREGISTERED.
- **Subclasses get no provenance.** Registration and authorization both require `type(reading) is BalanceReading`
  (AC-3). `credit_evidence` keeps its `isinstance` check (`gates.py:164`) and is not changed for this.
- **`id` reuse.** If an object dies and a new object gets the same `id`, the old entry's `ref()` returns `None`, which
  is not the new object, so the new object is UNREGISTERED. `acquire_balance` may then overwrite that dead entry.
- **Lazy cleanup.** Dead entries are removed only by registry operations that already hold the lock (acquire or
  authorize). **No weakref callback takes the registry lock.** A callback can run during garbage collection on the
  thread that already holds a non-reentrant lock, which would deadlock.

## 6. Final authorization: `gates.authorize_approval`

### 6.1 Signature

`authorize_approval(reading, quote, policy, *, adapter, user_confirmed) -> GateResult`

- No parameter name may be one of `FRESHNESS_WORDS`, and no new `gates` name may start with
  `FreshnessPolicy`/`set_`/`configure`/`override` (`tests/unit/test_phase5_3g4_2_freshness.py:136-145`).
- Like the existing gates, it takes no time, age or policy override.

### 6.2 Public block codes (AC-5)

New `Block` members, in priority order. When several findings apply, the highest-priority one is the result:

1. `BALANCE_READING_REGISTRY_ERROR`
2. `BALANCE_READING_UNREGISTERED`
3. `BALANCE_READING_MUTATED`
4. `BALANCE_READING_CONSUMED`
5. `BALANCE_READING_STALE`

GONE has no public code. A dead entry with a live argument object can only mean `id` reuse, so it is reported as
UNREGISTERED.

### 6.3 Order of evaluation

| Step | Action | Outcome |
|---|---|---|
| 0 | **SimulatedFlow path (U-1).** If `is_simulated_adapter(adapter)` and `type(reading) is int` and `reading >= 0`: return `approval_gate(quote, policy, reading, user_confirmed)`. No registry, no consumption | mirrors `approval_balance` (`gates.py:199-200`); simulation behaviour unchanged |
| 1 | `ce = credit_evidence(reading)`, **outside the lock**. Unrelated exceptions propagate (AC-7); `TypeError`/`ValueError` from the time are already turned into `(UNKNOWN, None, why)` inside it (`gates.py:168-171`) | wall-clock finding: `ce[0] is ReadStatus.VERIFIED` or not |
| 2 | Acquire the registry lock | — |
| 3 | `type(reading) is BalanceReading` and an entry exists with `entry.ref() is reading` (lazy cleanup of a dead entry here) | otherwise finding UNREGISTERED |
| 4 | `entry.state is AVAILABLE` | otherwise finding CONSUMED |
| 5 | The object's `status`, `verified_balance`, `read_at` equal the snapshot | otherwise finding MUTATED |
| 6 | Monotonic age `a = time.monotonic() - entry.t_mono`: accepted only if `0 <= a <= 300` | otherwise finding STALE |
| 7 | Combine with step 1: if `ce` is not VERIFIED, add the finding from §6.4 | — |
| 8 | **If there is any finding:** release the lock and return `GateResult([highest-priority block], [details])`. `approval_gate` is **not** run (U-3). Nothing is consumed | — |
| 9 | Otherwise `g = approval_gate(quote, policy, snapshot.verified_balance, user_confirmed)`, still inside the lock, **outside** any registry `try/except` (U-4). Exceptions propagate unchanged | — |
| 10 | If `g.allowed`: set `entry.state = CONSUMED` **before** returning | consumed exactly once |
| 11 | Release the lock and return `g`. A blocked `g` consumes nothing | — |

Notes:

- **U-2:** at steps 3 to 7, all findings that apply are collected, and the highest priority wins. When step 3 finds
  UNREGISTERED there is no entry, so steps 4 to 6 do not apply.
- Integers from a **non-simulated** adapter (or a negative int from a simulated one) skip step 0. They fail step 3,
  so the result is `BALANCE_READING_UNREGISTERED`. In the runner they normally never get this far, because the
  preliminary gate already blocks with `COST_OVER_BALANCE` (§8; existing test
  `tests/unit/test_phase5_3g4_1_adapter_trust.py:183-192`).
- The wall-clock check (step 1) is evaluated before the lock is taken. Time spent waiting for the lock is covered by
  the monotonic check (step 6), which runs inside the lock.
- The monotonic bound is read as inclusive (`<= 300`), mirroring `_freshness_verdict` (`gates.py:139`). No new
  tolerance is added. A negative monotonic age is refused.

### 6.4 Mapping of `credit_evidence` UNKNOWN results (U-3)

`credit_evidence` UNKNOWN results are never a block on their own. Each becomes a finding, and the AC-5 priority
then decides. The mapping below is derived from the source (`gates.py:160-175`):

| `credit_evidence` UNKNOWN cause (source line) | Can a registered, unmutated reading produce it? | Resulting finding |
|---|---|---|
| `None` (160-161) | no: not `BalanceReading`, so step 3 fails | UNREGISTERED |
| legacy `CreditSnapshot` (162-163) | no | UNREGISTERED |
| other type (164-165) | no | UNREGISTERED |
| status not VERIFIED / no value (166-167) | no: only VERIFIED is registered, and a changed status is MUTATED | UNREGISTERED or MUTATED |
| time cannot be evaluated (168-171) | not expected: `__post_init__` already parsed `read_at` (`balance.py:168`), and a changed `read_at` is MUTATED | MUTATED if changed. Otherwise **OPEN-1** |
| stale or future-dated (172-174) | yes | **STALE** |

**OPEN-1:** a registered, unmutated reading whose `credit_evidence` result is UNKNOWN for a reason other than
staleness has no derived code. Proposed handling is `BALANCE_READING_STALE` (fail closed, no new public code), but
it is not confirmed.

### 6.5 Exception semantics (AC-7, U-4)

- `credit_evidence` is not changed. It keeps `except (TypeError, ValueError)` and has no `except Exception`
  (`tests/unit/test_phase5_3g4_2_freshness.py:212-220`). Because step 1 runs before any registry access, a
  `RuntimeError` from the object's `read_at` still propagates. The existing test needs no change.
- `BALANCE_READING_REGISTRY_ERROR` covers only explicitly listed internal registry failures. The `try` block contains
  registry operations only, never `credit_evidence`, never reads of object attributes beyond the snapshot
  comparison, and never `approval_gate`.
- **OPEN-2:** the exact list of caught exceptions is not fixed yet. Proposed: `provenance` defines its own
  `ProvenanceRegistryError`, raised only when a registry invariant is violated (for example, an unknown state), and
  only that class is caught. `MemoryError`, `KeyboardInterrupt` and everything else propagate.
- No catch-all handler that swallows unrelated errors is allowed anywhere on this path.

## 7. Snapshot protection (AC-1, U-5)

### 7.1 What is compared

`status`, `verified_balance` and `read_at` from the object are compared with the snapshot (step 5). Any
difference is MUTATED. `object.__setattr__` can change a frozen dataclass; the existing tests already use it for
`read_at` (`tests/unit/test_phase5_3g4_2_freshness.py`, `test_type_and_status_are_checked_before_time`).

### 7.2 What the gate uses

`approval_gate` receives `snapshot.verified_balance` (step 9), never a value read again from the object. A change to
the object after step 5 cannot change the balance the gate compares against.

### 7.3 Residual (out of guarantee, Option C)

- **Wall-clock check before the snapshot comparison.** Step 1 reads the object's `read_at`; step 5 compares it later.
  Code in the same process could set a forged `read_at` before step 1 and restore it before step 5. The wall-clock
  check would then be bypassed. The monotonic check (step 6, from `t_mono` in the registry) still bounds the age.
  Deliberate same-process manipulation is outside R-2.
- Fields outside the snapshot (`observed_text`, `parse`, `refresh_text`, `detail`, `source`) are not compared. The
  gate does not use them.
- Direct writes to the registry, or monkeypatching `provenance` or `gates`, are not defended.

## 8. Runner (AC-6)

Planned `SceneRunner._decide_on_quote` (current: `src/blatifa/production/runner.py:191-205`, which calls
`self.balance()` twice through `_gate_balance`):

1. `reading = self.balance()`, **once**, as a **local variable**. It is never stored on the runner and never cached.
2. **Preliminary gate (non-consuming):**
   `approval_gate(quote, self.policy, approval_balance(reading, adapter=self.adapter), user_confirmed=False)`.
   It does not touch the registry.
3. Only if the only block is `NOT_CONFIRMED_BY_USER` and `self.confirm(quote)` is true:
   `gate = authorize_approval(reading, quote, self.policy, adapter=self.adapter, user_confirmed=True)`.
4. If `not gate.allowed`: `adapter.reject()`, ledger `REJECTED`, `_manual(a, gate.blocks[0], …)`. The current
   handling stays (`runner.py:197-201`). A blocked final authorization consumed nothing.
5. If allowed, the reading is **already CONSUMED**, before the ledger write-ahead `APPROVING` (`runner.py:202`) and
   `adapter.approve()` (`runner.py:203`). If approve fails, raises, times out or ends in an unknown state, the
   reading stays CONSUMED and is never returned to AVAILABLE.
6. The next decision calls `self.balance()` again and gets a new reading.

The time the user takes to confirm counts toward both freshness checks. A slow confirmation ends in
`BALANCE_READING_STALE`, which is fail-closed.

**OPEN-3:** the new block codes are not in `PAUSE_BLOCKS` (`gates.py:51`), so `_manual` sends them to manual
intervention. Whether any of them (for example `STALE`) should pause instead has not been decided. Default if not
decided: unchanged `PAUSE_BLOCKS`.

**Simulation** stays as it is: `cli.cmd_episode` simulate passes `SimulatedFlow` and `balance=lambda: 10_000`
(`src/blatifa/cli.py:363-364`, pinned by `tests/unit/test_phase5_3g4_1_adapter_trust.py:276-280`), and step 0 of
§6.3 handles it.

## 9. Test and integrity plan (not executed, nothing changed)

### 9.1 Planned manifest `docs/phase-5.3g4.4/evidence/approved_changes.txt` (4 rows)

| Path | Why |
|---|---|
| `src/blatifa/production/gates.py` | `Block` members, `authorize_approval` |
| `src/blatifa/production/runner.py` | `_decide_on_quote`, `_gate_balance` |
| `tests/unit/simflow.py` | `fresh_balance` must return a **registered** reading, via `acquire_balance` on a fake Page. Without this, every `FakeFlow` approve path in the 13 test files that import `simflow` would get `BALANCE_READING_UNREGISTERED` (`simflow.py:188-204`) |
| `tests/unit/test_phase5_3g3_credit_contract.py` | contract tests touched by the new blocks (exact edits defined at implementation) |

Each row is `path old_digest new_digest`. Digests are measured only during an authorized implementation. **None are
computed now.**

### 9.2 Integrity roots (exact pins, never manifest rows)

| Root | Required change at implementation | Pinned by |
|---|---|---|
| `tests/unit/protected_hashes.py` | `MANIFESTS` gets the 4.4 manifest. It can never approve itself: `_never_approvable` refuses `SELF`, every manifest, `*approved_changes.txt` and any `*hashes*` file (`protected_hashes.py:41-42`) | freshness, credit_paths, adapter_trust |
| `tests/unit/test_phase5_3g4_credit_paths.py` | call graph (`:261-280`), `INTEGRITY_ROOTS` (`:293`) + 4.4 manifest | freshness, adapter_trust |
| `tests/unit/test_phase5_3g4_1_adapter_trust.py` | call graph (`:263-273`), `_spy_gate` (`:175-179`, U-7), `fresh_balance` source pin (`:170-172`), `INTEGRITY_ROOTS` (`:306`) + 4.4 manifest | freshness |
| `tests/unit/test_phase5_3g4_2_freshness.py` | make the integrity test chain-aware (`:334-352`, D-2), call list (`:157-159`, D-8), `_gate_balance` string (`:286`), `INTEGRITY_ROOTS` (`:306`) | **nobody today (D-9)**. To be pinned by the new R-2 test |
| `tests/unit/test_phase5_3g4_4_r2_provenance.py` | new file; recorded in `new_files_hashes.txt` | — |

Update order at implementation: credit_paths, then adapter_trust, then freshness, then the new test, because each
root pins the ones before it.

`approval_gate` and `preflight_gate` must stay byte-identical: their source digest is pinned
(`tests/unit/test_phase5_3g4_1_adapter_trust.py:283-285`).

### 9.3 D-1 to D-11

| # | Constraint | Plan |
|---|---|---|
| D-1 | call graph pins in credit_paths, adapter_trust, freshness | update. New callers: `approval_gate` and `is_simulated_adapter` from `gates.authorize_approval`; one `self.balance()` in `_decide_on_quote` |
| D-2 | freshness integrity test is not chain-aware | make it chain-aware (precedent: adapter_trust in 5.3g.4.2) |
| D-3 | `credit_evidence` exception semantics | unchanged (§6.5) |
| D-4 | forbidden words in `credit_evidence` / `read_from_tree` | both unchanged |
| D-5 | `approval_gate` + `preflight_gate` digest | unchanged |
| D-6 | public `gates` parameter names | `authorize_approval` complies. The new test applies the same rule to `provenance` |
| D-7 | `credit_evidence(reading)`, `approval_balance(value, *, adapter)` signatures | unchanged |
| D-8 | callers of `credit_evidence`/`approval_balance` | add `gates.authorize_approval → credit_evidence` (no keywords). `_freshness_verdict` keeps its single call site in `credit_evidence` |
| D-9 | `freshness.py` unpinned | exact pin in the new R-2 test |
| D-10 | `account/__init__.py` baselined | not changed; import `blatifa.account.provenance` directly |
| D-11 | import cycles | §10 |

### 9.4 Acceptance tests to write (none run)

Each test is described here only; none has been written or run.

- **U-8:** `authorize_approval(replace(r, read_at=now), …)` → `BALANCE_READING_UNREGISTERED`. The existing
  `test_read_at_provenance_is_still_open_r2` keeps passing, because `credit_evidence` is unchanged. It gains a
  pointer to the new test; it is not inverted.
- **Copies:** constructor, `copy`, `deepcopy` and pickle copies → UNREGISTERED. A subclass instance →
  UNREGISTERED.
- **Single use:** a second `authorize_approval` on the same reading → CONSUMED.
- **Blocked final:** a blocked final authorization leaves the reading AVAILABLE.
- **Mutation:** `object.__setattr__` on `status`, `verified_balance` or `read_at` → MUTATED. The gate receives the
  snapshot value.
- **Freshness:** monotonic age 301 → STALE; wall-clock stale → STALE. Clocks are faked by monkeypatching in tests
  only; no production parameter.
- **Priority:** combinations resolve per AC-5.
- **Gate not run:** `approval_gate` is not called when provenance fails.
- **Acquisition errors:** `aria_snapshot` raising and `AriaParseError` both propagate, and nothing is registered.
- **Registration filter:** only VERIFIED_WITHOUT_INTERACTION is registered; OBSERVED, UNAVAILABLE and
  USER_REPORTED are not.
- **SimulatedFlow:** a raw int is allowed through step 0; a raw int with `FakeFlow` → blocked.
- **Runner:** one `self.balance()` per decision; the reading is consumed before `approve()`; it stays consumed when
  `approve()` raises.
- **Exceptions:** `approval_gate` exceptions are not reported as `REGISTRY_ERROR`.
- **Weakref:** no weakref callback; `id` reuse is rejected.
- **Imports:** AST check of `provenance` imports.
- **Integrity:** exact pin of `freshness.py`.

## 10. Import boundary

- `provenance.py` imports only `blatifa.account.balance` (`BalanceReading`, `BalanceStatus`, `read_from_tree`),
  `blatifa.flow.aria` (`parse`), and the standard library (`threading`, `time`, `weakref`).
- It must **not** import `blatifa.production.gates` or `blatifa.flow.live_probe`: `live_probe` imports `gates`
  (`live_probe.py:34`), and `gates` will import `provenance`.
- The resulting graph is acyclic:
  - `gates` → `provenance` → `balance` → `aria`;
  - `balance.py:27` imports only `flow.aria`;
  - `aria.py` imports only `re`, `yaml` and the standard library.
- `account/__init__.py` is not changed and exports nothing new.
- **OPEN-4:** `approval_gate` must run inside the provenance lock (step 9), but `provenance` cannot import `gates`.
  One option is for `provenance` to expose an internal check-and-consume function that takes the decision as a
  callable, runs it under the lock outside the registry `try`, and consumes only when the result is allowed. The
  exact interface is not fixed.

## 11. Open specification issues and unproven items

| # | Item | State |
|---|---|---|
| OPEN-1 | `credit_evidence` UNKNOWN for a non-stale reason on a registered, unmutated reading (§6.4) | proposed STALE, not confirmed |
| OPEN-2 | exact list of internal registry exceptions (§6.5) | proposed `ProvenanceRegistryError` only |
| OPEN-3 | whether any new block belongs in `PAUSE_BLOCKS` (§8) | default: no change |
| OPEN-4 | interface between `gates.authorize_approval` and the provenance lock (§10) | not fixed |
| OPEN-5 | macOS `time.monotonic()` behaviour across sleep/wake | **UNVERIFIED.** It is expected not to advance during sleep, in which case only the wall-clock check catches the time asleep. No evidence on this host |
| OPEN-6 | residual same-process races (§7.3) | outside the guarantee, documented |
| OPEN-7 | source authenticity (Page is Google Flow) | not addressed by R-2; live prerequisite |
| OPEN-8 | cross-process budget coordination | not addressed by R-2; live prerequisite |
| OPEN-9 | hashes and manifest | not computed, not updated |
| OPEN-10 | implementation and tests | not done, not authorized |
| OPEN-11 | design freeze | not declared; needs OPEN-1 to OPEN-4 decided |
