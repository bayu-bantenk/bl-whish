# Phase 5.3g.4.4: R-2 Balance Reading Provenance and Single-Use Authorization (design specification)

> **Ringkasan (ID):**
> - Dokumen ini adalah spesifikasi desain R-2. Isinya keputusan AC-1 s.d. AC-8 dan U-1 s.d. U-9 yang sudah
>   disetujui.
> - Status: **Design Freeze BELUM DITETAPKAN. Implementasi NOT AUTHORIZED. Pengujian NOT AUTHORIZED.**
> - R-2 hanya membuktikan bahwa sebuah `BalanceReading` diperoleh lewat jalur akuisisi yang disetujui, di dalam
>   proses Python yang sama, dan hanya dipakai sekali untuk satu otorisasi approval.
> - R-2 **tidak** membuktikan bahwa Page berasal dari Google Flow, tidak membuktikan saldo yang sebenarnya, dan tidak
>   memberi jaminan lintas proses.
> - Empat keputusan terbuka (OPEN-1 s.d. OPEN-4) sudah **RESOLVED** atas persetujuan user (2026-11-18). Hal yang
>   belum terbukti tetap dicatat di §11, bukan disembunyikan.
> - Latch FAULTED dan AMB-1 s.d. AMB-4 sudah **RESOLVED** (2026-11-18): setelah `ProvenanceRegistryError`,
>   registry menjadi FAULTED secara permanen sampai proses berakhir (§5.4). Setelah itu tidak ada otorisasi maupun
>   registrasi yang bisa berhasil. Rollback tidak dijamin, jadi entri parsial mungkin tetap ada, tetapi tidak pernah
>   dipakai. Latch ini hanya berlaku di proses itu dan tidak berkoordinasi dengan proses lain. Tes FAULTED nanti
>   diisolasi dengan proses terpisah, tanpa API reset.

## 0. Status

| Item | Status |
|---|---|
| Phase ID | `5.3g.4.4` |
| Name | R-2: Balance Reading Provenance and Single-Use Authorization |
| Design reconciliation | AC-1 to AC-8 and U-1 to U-9 approved by the user |
| Open decisions OPEN-1 to OPEN-4 | **RESOLVED** by user approval, 2026-11-18 (§6.4, §6.5, §8, §6.6) |
| Decisions 1 to 3 (internal findings and callback result, `ProvenanceRegistryError` translation, failure while marking CONSUMED) | **APPROVED** by the user, 2026-11-18 (§6.6, §6.7, §6.8) |
| FAULTED latch | **APPROVED** by the user, 2026-11-18 (§5.4, §6.8) |
| AMB-1 to AMB-4 (acquisition while FAULTED, partial registration, FAULTED check and locking, FAULTED test isolation) | **RESOLVED** by user approval, 2026-11-18 (§4, §5.4, §9.4, §11) |
| Documentation | this document and `SAFETY_AUDIT.md` (updated 2026-11-18) |
| Design freeze | **NOT YET DECLARED** |
| Implementation | **NOT AUTHORIZED** |
| Testing | **NOT AUTHORIZED** |
| Live Google Flow interaction | **NOT AUTHORIZED** |
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
| `src/blatifa/account/provenance.py` | new | acquisition (`acquire_balance`) and the **sole owner** of the registry state, the registry lock, identity, snapshot and monotonic validation, internal finding codes, the internal authorization result, atomic consumption (`authorize`, §6.6) and `ProvenanceRegistryError` |
| `src/blatifa/production/gates.py` | changed | new `Block` members (§6.2) and `authorize_approval` (§6): `credit_evidence` before the registry, the `approval_gate` callback, and the mapping of internal findings to public blocks. It never accesses or holds the registry lock |
| `src/blatifa/production/runner.py` | changed | `_decide_on_quote` uses one local reading and `authorize_approval` (§8) |
| `src/blatifa/account/balance.py` | **unchanged** | `BalanceReading` and `read_from_tree` stay as they are |
| `credit_evidence`, `approval_balance`, `approval_gate`, `preflight_gate` | **unchanged** | `credit_evidence` never touches the registry |
| manual protocol (`user_reported`, `USER_REPORTED`) | **unchanged** | never VERIFIED, never registered |
| SimulatedFlow with a raw `int` | **unchanged behaviour** | separate path, no registry (U-1) |

## 4. Acquisition: `acquire_balance(page)`

0. **FAULTED pre-check (AMB-1 Case A).** If the registry is FAULTED (§5.4), raise `ProvenanceRegistryError` at
   once. `aria_snapshot()` is **not** called, nothing is parsed and nothing is registered. This check **may** read
   the latch without the registry lock (AMB-3). It is an early exit only, not the deciding check: the deciding
   check is the one in step 5, inside the lock.
1. Record `t_mono = time.monotonic()` **before** calling `page.locator("body").aria_snapshot()`, so the recorded age
   also includes the snapshot itself. A reader wall-clock time, if recorded, is diagnostic only. It is never compared
   with `read_at` and never used in a decision (AC-4).
2. Call `page.locator("body").aria_snapshot()`. **Any exception is propagated unchanged** and nothing is registered
   (AC-2). It does **not** set FAULTED.
3. `flow.aria.parse(text)`. **`AriaParseError` is propagated unchanged**; it is not turned into UNAVAILABLE (U-6) and
   it does **not** set FAULTED. This differs on purpose from `live_probe.body_tree`, which maps `AriaParseError` to
   `None` (`src/blatifa/flow/live_probe.py:310-314`); `body_tree` is not changed.
4. `account.balance.read_from_tree(tree)` classifies the tree. It stays a pure classifier: no clock argument, no
   registry, no provenance (`src/blatifa/account/balance.py:209-249`; its source must keep passing the
   forbidden-word check in `tests/unit/test_phase5_3g3_credit_contract.py:244-253`).
5. **Registration, inside the registry lock.** The lock is taken for **every** result, including results that will
   not be registered, so that the deciding FAULTED check always runs.
   - **FAULTED re-check (AMB-1 Case B, AMB-3).** This in-lock check is the **deciding** one. If the registry became
     FAULTED while steps 1 to 4 ran (for example through a concurrent `authorize`), raise
     `ProvenanceRegistryError`. The reading is not registered and is **not** returned. This applies to **every**
     reading status, including `OBSERVED` and `UNAVAILABLE`, which would not have been registered anyway.
   - Otherwise register the result **only if** `type(reading) is BalanceReading` and
     `reading.status is BalanceStatus.VERIFIED_WITHOUT_INTERACTION`. Every other result is returned unregistered,
     as before.
   - **Registration failure (AMB-1 Case C, AMB-2).** If a registry operation in this step (lazy cleanup, overwriting
     a dead entry, or storing the new entry) raises `ProvenanceRegistryError`, the FAULTED latch is set **first**,
     then the same exception propagates to the caller. The reading is not returned. **No rollback is guaranteed:**
     an entry may have been partly written, and it does not have to be removed. It is never used, because every
     later `authorize` stops at §6.3 step 2 before any entry is examined, and every later registration stops at the
     deciding check above.
6. Return the reading object (only reached in state NORMAL).

Only a recognized registry-internal `ProvenanceRegistryError` sets the latch. Page and parsing failures (steps 2
and 3), and any other exception, never do, and they are never converted into `ProvenanceRegistryError`.
`acquire_balance` does not catch and translate `ProvenanceRegistryError`; it only latches and propagates it. It
has no finding codes, because acquisition is not authorization.

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
| UNREGISTERED | AVAILABLE | `acquire_balance` registers a VERIFIED_WITHOUT_INTERACTION reading of exact type, with the registry NORMAL at the deciding in-lock check (§4 step 5) |
| AVAILABLE | CONSUMED | a final `authorize_approval` returns allowed, inside the lock, before the result is returned |
| AVAILABLE / CONSUMED | GONE | the object is collected (weakref dead), or the process ends (registry is memory only) |
| CONSUMED | anything else | never |
| AVAILABLE | AVAILABLE | a preliminary gate, or a final authorization that is blocked, leaves it unchanged (AC-6, Q3) |

A reading is assessed STALE whenever a freshness check fails; nothing is stored for it.

Separately from the per-reading states, the registry as a whole can become **FAULTED** after an internal
`ProvenanceRegistryError` (§5.4, §6.8). This is a process-wide latch, not a reading state. While it is set, no
reading can be authorized and nothing is registered.

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

### 5.4 Registry state: NORMAL and FAULTED (latch approved; AMB-1 to AMB-4: RESOLVED)

The registry as a whole has two states. They are separate from the per-reading states in §5.1.

**Safety guarantee: no authorization or registration can succeed after the registry enters FAULTED.** This is
the guarantee R-2 gives. It is **not** a claim that no partial entry can remain in the registry (AMB-2).

| Registry state | Acquisition (`acquire_balance`) | Authorization (`provenance.authorize`) |
|---|---|---|
| **NORMAL** | permitted (§4) | permitted, subject to every R-2 check (§6.3) |
| **FAULTED** | raises `ProvenanceRegistryError` for every reading status; nothing is registered or returned. If FAULTED at the start, `aria_snapshot()` is not called | returns the internal `REGISTRY_ERROR` at once (§6.3 step 2), before any entry is examined; the callback is never invoked |

| Transition | Trigger |
|---|---|
| NORMAL → FAULTED | a recognized registry-internal `ProvenanceRegistryError` in any registry operation, during authorization (§6.3, §6.8) or acquisition (§4 step 5, Case C). The latch is set **before** the error is converted (authorize) or propagated (acquire) |
| FAULTED → NORMAL | **never** inside the process. There is no automatic recovery, no retry, no reset and no latch-clearing API, public or private |
| FAULTED → new process | the old Python process terminates. A new process starts with a new, empty registry in state NORMAL |

Rules:

- **Trigger.** Only a recognized `ProvenanceRegistryError` raised by a registry operation sets the latch.
  `aria_snapshot()` exceptions, `AriaParseError`, `credit_evidence` exceptions, callback exceptions, a malformed
  callback result (§6.7), a non-bool `wall_clock_verified`, `KeyboardInterrupt`, `SystemExit` and every other
  exception do **not** set it.
- **Permanent.** The latch is a single assignment and is never cleared while the process runs. Production code has
  no reset, clear or recovery API for it, and none is added to make testing easier (AMB-4).
- **Checks and locking (AMB-3).** A FAULTED check at the start of an operation may be made without the lock, as an
  early exit only (§4 step 0). A re-check inside the registry lock is **mandatory** before any registry operation
  continues, and that in-lock check is the deciding one (§4 step 5, §6.3 step 2). Authorization and consumption stay
  atomic under the lock as in §6.3 steps 2 to 11. The lock is never exposed to `gates.py` or any other module.
- **No rollback and no consumption claim (AMB-2).** Entering FAULTED does not mean that a failed registry mutation
  was undone, and does not mean that a reading was successfully consumed. A partly written entry may remain and does
  not have to be removed. The state of any affected entry is undefined and is never examined or used again.
- **Test isolation (AMB-4).** FAULTED tests in the future implementation phase are isolated by running each FAULTED
  case in a **separate Python process**, which starts with an empty registry. A test must not clear the latch inside
  a process.
- **Old readings after a restart.** `BalanceReading` objects from the old process cannot reach the new process
  through the registry. Any equal-looking object in the new process has no entry, so it is UNREGISTERED (§5.1); it is
  not trusted or reusable.
- **Process-local only.** The latch lives in the memory of one Python process. It does **not** coordinate with
  other processes: a FAULTED registry in one process does not stop another process from acquiring or authorizing.
- **A restart proves nothing more.** Starting a new process, in production or in a test, does **not** establish
  source authenticity and does **not** provide cross-process budget safety. Both remain live blockers (§2,
  `SAFETY_AUDIT.md` §4).

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

Steps 0, 1 and 12 run in `gates.authorize_approval`. Steps 2 to 11 run inside `provenance.authorize` (§6.6), which
alone holds the registry lock.

| Step | Where | Action | Outcome |
|---|---|---|---|
| 0 | gates | **SimulatedFlow path (U-1).** If `is_simulated_adapter(adapter)` and `type(reading) is int` and `reading >= 0`: return `approval_gate(quote, policy, reading, user_confirmed)`. No registry, no consumption | mirrors `approval_balance` (`gates.py:199-200`); simulation behaviour unchanged |
| 1 | gates | `ce = credit_evidence(reading)`, **before the registry lock**. Its exceptions propagate (AC-7); `TypeError`/`ValueError` from the time are already turned into `(UNKNOWN, None, why)` inside it (`gates.py:168-171`). Then call `provenance.authorize(reading, wall_clock_verified=(ce[0] is ReadStatus.VERIFIED), evaluate_gate=…)` | — |
| 2 | provenance | Acquire the private registry lock. If the registry is FAULTED (§5.4, §6.8), stop with finding REGISTRY_ERROR before any entry is examined; the callback is not invoked. This in-lock check is the deciding one (AMB-3) | otherwise continue |
| 3 | provenance | `type(reading) is BalanceReading` and an entry exists with `entry.ref() is reading` (lazy cleanup of a dead entry here) | otherwise finding UNREGISTERED |
| 4 | provenance | `entry.state is AVAILABLE` | otherwise finding CONSUMED |
| 5 | provenance | The object's `status`, `verified_balance`, `read_at` equal the snapshot | otherwise finding MUTATED |
| 6 | provenance | Monotonic age `a = time.monotonic() - entry.t_mono`: accepted only if `0 <= a <= 300` | otherwise finding STALE |
| 7 | provenance | If `wall_clock_verified` is false, add finding STALE (§6.4) | — |
| 8 | provenance | **If there is any finding:** release the lock and return the highest-priority finding (AC-5). The callback is **not** invoked, so `approval_gate` is **not** run (U-3). Nothing is consumed | — |
| 9 | provenance | Otherwise invoke `evaluate_gate(snapshot.verified_balance)`, still inside the lock and **outside** any `ProvenanceRegistryError` handler (U-4). The callback runs `approval_gate`. If it raises, the original exception propagates and the lock is released (§6.6). Then read the result's `.allowed` **once** and validate it (§6.7) | — |
| 10 | provenance | If `.allowed is True`: set `entry.state = CONSUMED` **before** returning. If this raises `ProvenanceRegistryError`, the result is the internal `REGISTRY_ERROR` and the callback's result is discarded (§6.8) | consumed exactly once |
| 11 | provenance | Release the lock and return the internal authorization result: the callback's result (consumed if allowed), or a finding. If `.allowed is False`, nothing is consumed | — |
| 12 | gates | Map the internal result to a `GateResult`: an internal finding becomes `GateResult([Block.BALANCE_READING_<finding>], [details])` (details keep the `credit_evidence` reason, §6.4). A callback result is returned as it is | — |

Notes:

- **U-2:** at steps 3 to 7, all findings that apply are collected, and the highest priority wins. When step 3 finds
  UNREGISTERED there is no entry, so steps 4 to 6 do not apply.
- Integers from a **non-simulated** adapter (or a negative int from a simulated one) skip step 0. They fail step 3,
  so the result is `BALANCE_READING_UNREGISTERED`. In the runner they normally never get this far, because the
  preliminary gate already blocks with `COST_OVER_BALANCE` (§8; existing test
  `tests/unit/test_phase5_3g4_1_adapter_trust.py:183-192`).
- `provenance` cannot import `gates` (§10), so it cannot name `Block` or `GateResult`. It reports its findings
  with its own internal codes (§6.6), which `gates` maps one-to-one to the five public codes (step 12). It
  recognizes an allowed callback result only through a validated boolean `.allowed` (§6.7). This is approved
  (Decision 1) and adds no public code.
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
| time cannot be evaluated (168-171) | not expected: `__post_init__` already parsed `read_at` (`balance.py:168`), and a changed `read_at` is MUTATED | MUTATED if changed. Otherwise STALE (OPEN-1, below) |
| stale or future-dated (172-174) | yes | **STALE** |

**OPEN-1: RESOLVED.** When `credit_evidence` returns UNKNOWN and no more specific finding applies, the result is
`BALANCE_READING_STALE`:

- the internal reason is kept as UNKNOWN, and the `credit_evidence` reason text goes into the `GateResult` details;
- the code does **not** claim that the reading has literally expired. It means "the wall-clock evidence did not
  verify";
- no new public block code is introduced;
- AC-5 priority is unchanged: a higher-priority finding (REGISTRY_ERROR, UNREGISTERED, MUTATED, CONSUMED) still
  wins.

### 6.5 Exception semantics (AC-7, U-4)

- `credit_evidence` is not changed. It keeps `except (TypeError, ValueError)` and has no `except Exception`
  (`tests/unit/test_phase5_3g4_2_freshness.py:212-220`). Because step 1 runs before any registry access, a
  `RuntimeError` from the object's `read_at` still propagates. The existing test needs no change.

**OPEN-2: RESOLVED.** There is one dedicated exception, `ProvenanceRegistryError`:

- it is defined and owned by `provenance.py`;
- it represents recognized internal registry invariant or operation failures only, for example an entry in an
  unknown state. No list of generic Python exceptions is treated as a registry failure;
- **only** this exception is translated, in two stages (Decision 2):
  - `provenance.authorize` catches it, and only within its narrowly scoped registry operations. It converts it to
    the internal finding `REGISTRY_ERROR`, the highest priority (step 8). `provenance` does not know or import the
    public block codes;
  - `gates` maps the internal `REGISTRY_ERROR` to `BALANCE_READING_REGISTRY_ERROR` (step 12);
- a `ProvenanceRegistryError` raised while marking CONSUMED (step 10) also becomes the internal `REGISTRY_ERROR`. The
  callback's allowed result is then **not** returned (§6.8);
- in both cases the FAULTED latch is set before the conversion (§5.4);
- `acquire_balance` does **not** translate it. A `ProvenanceRegistryError` raised during registration sets the
  latch and then propagates to the caller; in a FAULTED registry `acquire_balance` raises it itself (§4 steps 0 and
  5). Page (`aria_snapshot`) and `AriaParseError` exceptions propagate unchanged and are never converted into it;
- the handler never encloses `credit_evidence` (step 1, which is outside `provenance`) or the callback
  (`approval_gate`, step 9). Their exceptions propagate unchanged;
- `KeyboardInterrupt`, `SystemExit` and every unrelated exception propagate and are never turned into a registry
  error;
- there is no broad `except Exception` around the authorization flow, and no catch-all handler anywhere on this
  path.

### 6.6 Lock ownership and callback boundary (OPEN-4: RESOLVED)

**Responsibility boundary**

| `provenance.py` owns | `gates.py` owns |
|---|---|
| the registry and its private lock | `credit_evidence()` evaluation, before registry authorization |
| exact object identity validation | the public block codes and the mapping from internal findings to them |
| snapshot validation | construction of the `approval_gate()` callback |
| monotonic freshness validation | translation of the internal authorization result into a public `GateResult` |
| the internal finding codes | |
| atomic consumption | |
| `ProvenanceRegistryError` | |
| the internal authorization result | |

**Forbidden dependencies**

- `provenance.py` must not import `gates.py` or `live_probe.py`.
- `gates.py` must not access the registry lock.
- The lock is never exposed to any caller.
- No circular import.
- `account/__init__.py` is not changed.

**Internal finding codes** (owned by `provenance`, Decision 1)

| Internal finding | Public block (mapped by `gates`) |
|---|---|
| `REGISTRY_ERROR` | `BALANCE_READING_REGISTRY_ERROR` |
| `UNREGISTERED` | `BALANCE_READING_UNREGISTERED` |
| `MUTATED` | `BALANCE_READING_MUTATED` |
| `CONSUMED` | `BALANCE_READING_CONSUMED` |
| `STALE` | `BALANCE_READING_STALE` |

The internal codes do not depend on, import or name the public `Block` codes. The mapping is one-to-one and total.
No other public block code is introduced. The AC-5 priority is applied to the internal codes in the same order.

**Internal authorization result.** It is one of:

- a finding: one internal code plus details;
- the callback's result, with `.allowed is True`, and the entry has been CONSUMED;
- the callback's result, with `.allowed is False`, and nothing has been consumed.

Conceptual interface. This is a contract only; it is not implemented and does not authorize implementation:

```python
provenance.authorize(
    reading,
    wall_clock_verified=...,                       # result of credit_evidence(reading), computed before the lock
    evaluate_gate=lambda verified_balance: approval_gate(
        quote, policy, verified_balance, user_confirmed,
    ),
)
```

Callback contract:

1. `credit_evidence()` runs in `gates` **before** `provenance.authorize` is called, so before the registry lock is
   taken.
2. `provenance.authorize()` acquires its private lock.
3. It validates exact identity, state, snapshot and monotonic freshness, and combines them with
   `wall_clock_verified` (§6.3 steps 3 to 7).
4. If provenance fails, the callback is **not** invoked.
5. If provenance passes, the callback runs inside the critical section with `verified_balance` taken from the
   validated registry snapshot (AC-1, U-5).
6. The callback's result must expose a valid boolean `.allowed` (§6.7).
7. If `.allowed is True`, the entry is marked CONSUMED **before** authorization is returned.
8. If consumption fails with `ProvenanceRegistryError`, the internal `REGISTRY_ERROR` is returned. The callback's
   earlier allowed result is **never** returned (§6.8).
9. If the callback raises, its **original** exception propagates, and the lock is released safely (a `with` block
   or `try/finally`). It is never converted into `ProvenanceRegistryError` or `REGISTRY_ERROR`, and nothing is
   consumed.
10. `gates.py` maps the internal result to the public block codes (§6.3 step 12).

Two further rules apply. No lock object is exposed to `gates.py`. No circular import is introduced: `provenance`
does not import `gates`, and the callback is a plain callable supplied by `gates` (§10).

Parameter names `reading`, `wall_clock_verified` and `evaluate_gate` are not in `FRESHNESS_WORDS`. The new R-2
test applies the D-6 rule to `provenance` as well.

### 6.7 Callback result validation (Decision 1)

- The result's `.allowed` attribute is read **exactly once**. The value read is the one used, so a property that
  returns different values on different reads cannot matter.
- It is accepted only if `type(value) is bool`. A truthy or falsy non-bool (`1`, `"yes"`, `None`, a list) is not
  accepted.
- **Malformed result:** `.allowed` is missing, reading it raises, or it is not a `bool`. This is a contract violation
  by the caller-supplied callback, not a registry failure:
  - nothing is consumed and the entry stays as it was (AVAILABLE);
  - no result is returned as authorization;
  - an exception propagates to the caller, and the lock is released safely. A missing attribute or a raising
    property propagates its **original** exception. A non-bool value raises `TypeError`;
  - it is **never** converted to `ProvenanceRegistryError` or `REGISTRY_ERROR`. It is never caught by the registry
    handler, so AC-7 is not weakened.
- In the production flow the callback returns a `GateResult`, whose `allowed` is a property computing
  `not self.blocks` (`gates.py:59-61`), so it is always a `bool`. Validation exists for the contract, not because
  `GateResult` is known to misbehave.
- `wall_clock_verified` is likewise accepted only as an exact `bool`. A non-bool raises `TypeError` before the lock
  is taken. This is a contract check on the `gates` side of the boundary, not a registry error.

### 6.8 Failure while marking CONSUMED (Decision 3)

If the operation that marks the entry CONSUMED (step 10) raises `ProvenanceRegistryError`:

- authorization fails closed. The internal result is `REGISTRY_ERROR`, which `gates` maps to
  `BALANCE_READING_REGISTRY_ERROR`;
- the callback's earlier `.allowed is True` result is discarded. It is never returned and never escapes in any other
  form, so no approval action can proceed from this call. In the runner, the result is the existing blocked path:
  `adapter.reject()`, ledger `REJECTED`, `_manual` (`runner.py:197-201`);
- **no atomic rollback is claimed.** After a failed consumption, the entry's stored state is **undefined** and is
  never trusted again;
- **a later attempt cannot bypass the failure.** Before `ProvenanceRegistryError` is converted, the registry latches
  the process-wide **FAULTED** state (§5.4, FAULTED latch decision). While FAULTED:
  - every later `provenance.authorize` returns `REGISTRY_ERROR` at once (priority 1) and never invokes a callback;
  - `acquire_balance` raises `ProvenanceRegistryError` and registers nothing (§4 steps 0 and 5, AMB-1: RESOLVED).

  The latch is a single assignment, set before the internal result is returned. There is no automatic recovery,
  retry, reset or clearing API. It persists until the Python process terminates; a new process starts with a new,
  empty registry, in which every earlier reading is UNREGISTERED;
- the same latch applies to a `ProvenanceRegistryError` raised by any other registry operation, in `authorize` or in
  `acquire_balance`. Once the registry has reported an internal failure, it authorizes and registers nothing more in
  that process.

This latch is how the approved requirement "a later attempt must not be able to bypass the failed consumption" is
met without claiming rollback. It is process-local and does not coordinate with other processes (§5.4).

## 7. Snapshot protection (AC-1, U-5)

### 7.1 What is compared

`status`, `verified_balance` and `read_at` from the object are compared with the snapshot (step 5). Any
difference is MUTATED. `object.__setattr__` can change a frozen dataclass; the existing tests already use it for
`read_at` (`tests/unit/test_phase5_3g4_2_freshness.py`, `test_type_and_status_are_checked_before_time`).

### 7.2 What the gate uses

The callback, and so `approval_gate`, receives `snapshot.verified_balance` (step 9), never a value read again from
the object. A change to the object after step 5 cannot change the balance the gate compares against.

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

**OPEN-3: RESOLVED. `PAUSE_BLOCKS` stays unchanged** (`gates.py:51`: `CREDIT_UNKNOWN`, `INSUFFICIENT_CREDIT`,
`DISK_LOW`). No R-2 provenance block is added to it. The five R-2 blocks keep the existing fail-closed path:
`adapter.reject()`, ledger `REJECTED`, and `_manual` to manual intervention (`runner.py:197-201`). Reasons:

- provenance failures are not safe conditions for an automatic retry;
- STALE needs a new acquisition, not a wait;
- UNREGISTERED, MUTATED, CONSUMED and REGISTRY_ERROR must never trigger an automatic retry;
- changing `PAUSE_BLOCKS` would change runner state transitions outside the scope of R-2.

**Simulation** stays as it is: `cli.cmd_episode` simulate passes `SimulatedFlow` and `balance=lambda: 10_000`
(`src/blatifa/cli.py:363-364`, pinned by `tests/unit/test_phase5_3g4_1_adapter_trust.py:276-280`), and step 0 of
§6.3 handles it.

## 9. Test and integrity plan (not executed, nothing changed)

### 9.1 Planned manifest `docs/phase-5.3g4.4/evidence/approved_changes.txt` (4 rows)

| Path | Why |
|---|---|
| `src/blatifa/production/gates.py` | `Block` members, `authorize_approval`. `PAUSE_BLOCKS` unchanged |
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
| D-11 | import cycles | §10. The callback boundary (§6.6) keeps `provenance` free of any `gates` import |

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
- **Acquisition errors:** `aria_snapshot` raising and `AriaParseError` both propagate unchanged, nothing is
  registered, and the registry stays NORMAL (a following valid acquisition and authorization still succeed).
- **Acquisition while FAULTED:** Case A, `acquire_balance` on a FAULTED registry raises `ProvenanceRegistryError` and
  the fake Page's `aria_snapshot` is never called. Case B, FAULTED set during acquisition → `ProvenanceRegistryError`,
  nothing registered, no reading returned, for VERIFIED, `OBSERVED` and `UNAVAILABLE` results alike. Case C, a
  `ProvenanceRegistryError` during registration → FAULTED is set, the same exception propagates, and a following
  `authorize_approval` → `BALANCE_READING_REGISTRY_ERROR` without invoking the callback or examining any entry
  (a partial entry, if any, is never used).
- **FAULTED isolation (AMB-4):** every FAULTED test runs in its own separate Python process, so each starts with an
  empty registry. No test clears the latch in-process.
- **No clearing API:** an AST/attribute check that `provenance` exposes no reset, clear or recover function for the
  latch.
- **Registration filter:** only VERIFIED_WITHOUT_INTERACTION is registered; OBSERVED, UNAVAILABLE and
  USER_REPORTED are not.
- **SimulatedFlow:** a raw int is allowed through step 0; a raw int with `FakeFlow` → blocked.
- **Runner:** one `self.balance()` per decision; the reading is consumed before `approve()`; it stays consumed when
  `approve()` raises.
- **Exceptions:** `approval_gate` exceptions are not reported as `REGISTRY_ERROR`. A raising callback propagates
  its original exception, releases the lock (a following call does not block), and consumes nothing.
  `KeyboardInterrupt` and `SystemExit` are not converted. Only `ProvenanceRegistryError` becomes
  `BALANCE_READING_REGISTRY_ERROR`, including when it is raised during consumption.
- **Wall-clock UNKNOWN:** `wall_clock_verified=False` on an otherwise valid reading → `BALANCE_READING_STALE`,
  with the `credit_evidence` reason in the details (OPEN-1).
- **Callback result:** `.allowed` of `1`, `"yes"` or `None` (truthy or falsy non-bool), a missing `.allowed`, or a
  raising `.allowed` property: an exception propagates, nothing is consumed, the lock is released, and the result is
  not REGISTRY_ERROR. `.allowed` is read exactly once.
- **Consumption failure:** a `ProvenanceRegistryError` while marking CONSUMED → `BALANCE_READING_REGISTRY_ERROR`.
  The callback's allowed result is not returned, and `approve()` is not called. Afterwards, a second
  `authorize_approval` on the same reading or on any other `BalanceReading` → `BALANCE_READING_REGISTRY_ERROR`, and
  a new `acquire_balance` → `ProvenanceRegistryError` (FAULTED latch).
- **Internal codes:** `provenance` has no import of `gates`, and the internal-to-public mapping is total and
  one-to-one.
- **Lock ownership:** an AST check that `gates.py` does not reference the registry lock or registry internals.
- **PAUSE_BLOCKS:** an assertion that it still equals `{CREDIT_UNKNOWN, INSUFFICIENT_CREDIT, DISK_LOW}`.
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
- `approval_gate` runs inside the provenance lock through the `evaluate_gate` callback supplied by `gates`
  (§6.6, OPEN-4 RESOLVED). `provenance` therefore never needs to import `gates`.

## 11. Open specification issues and unproven items

| # | Item | State |
|---|---|---|
| OPEN-1 | `credit_evidence` UNKNOWN with no more specific finding (§6.4) | **RESOLVED:** `BALANCE_READING_STALE`; internal reason UNKNOWN; no new code |
| OPEN-2 | internal registry exception (§6.5) | **RESOLVED:** `ProvenanceRegistryError` only |
| OPEN-3 | `PAUSE_BLOCKS` membership (§8) | **RESOLVED:** unchanged; no R-2 block added |
| OPEN-4 | lock ownership and API (§6.6) | **RESOLVED:** `provenance` owns the lock; callback boundary `provenance.authorize(…)` |
| OPEN-5 | macOS `time.monotonic()` behaviour across sleep/wake | **UNVERIFIED.** It is expected not to advance during sleep, in which case only the wall-clock check catches the time asleep. No evidence on this host |
| OPEN-6 | residual same-process races (§7.3) | outside the guarantee, documented |
| OPEN-7 | source authenticity (Page is Google Flow) | not addressed by R-2; live prerequisite |
| OPEN-8 | cross-process budget coordination | not addressed by R-2; live prerequisite |
| OPEN-9 | hashes and manifest | not computed, not updated |
| OPEN-10 | implementation and tests | not done, not authorized |
| OPEN-11 | design freeze | **not declared.** OPEN-1 to OPEN-4 are resolved, Decisions 1 to 3 and the FAULTED latch are approved, and AMB-1 to AMB-4 are resolved; a freeze still needs an explicit user decision |
| FAULTED latch | process-wide latch after `ProvenanceRegistryError` (§5.4, §6.8) | **APPROVED** (user, 2026-11-18): permanent until the process terminates; no recovery, retry, reset or clearing API; process-local only, with no cross-process coordination. (In the first update of 2026-11-18 this was labelled "AMB-2"; that label now means partial registration, below) |
| AMB-1 | acquisition while FAULTED (§4 steps 0 and 5, §5.4) | **RESOLVED** (user, 2026-11-18): `ProvenanceRegistryError` when FAULTED before the start (Case A, `aria_snapshot()` not called) or during acquisition or registration (Cases B and C). Applies to every reading status, including `OBSERVED` and `UNAVAILABLE`. No reading is returned as acquired. `aria_snapshot()` exceptions and `AriaParseError` propagate unchanged and do not set FAULTED |
| AMB-2 | partial registration (§4 step 5, §5.4) | **RESOLVED** (user, 2026-11-18): no rollback guarantee; a partial entry need not be removed and may remain; it is never used. Guarantee: no authorization or registration can succeed after the registry enters FAULTED |
| AMB-3 | FAULTED check and locking (§4 steps 0 and 5, §5.4, §6.3 step 2) | **RESOLVED** (user, 2026-11-18): an early check may be lock-free; an in-lock re-check is mandatory and deciding; authorization and consumption stay atomic; the lock is not exposed |
| AMB-4 | FAULTED test isolation (§5.4, §9.4) | **RESOLVED** (user, 2026-11-18): separate Python process per FAULTED case; no production reset API; a restart proves neither source authenticity nor cross-process budget safety |
