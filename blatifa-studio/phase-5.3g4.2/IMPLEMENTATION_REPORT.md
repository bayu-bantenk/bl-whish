# Phase 5.3g.4.2: freshness override API hardening

> **Ringkasan (ID):**
> - `credit_evidence` dan `approval_balance` tidak lagi menerima `now`/`max_age_s`.
> - Freshness kini kebijakan tetap di dalam modul: 300 s inklusif, skew 5 s inklusif, jam UTC nyata.
> - NaN, ∞ dan `read_at` yang tidak bisa dievaluasi menghasilkan UNKNOWN (fail-closed).
> - Aturan gate dan trust adapter tidak berubah.
> - Asal-usul `read_at` tetap OPEN (R-2).
> - **Verdict: CONDITIONAL PASS**, karena 43 tes browser tidak dijalankan sesuai larangan brief.

## 1. Scope and decisions

The scope follows Alternative A of the 5.3g.4.2 audit and the user's decisions of 2026-11-11:
- the historical test migration is approved;
- `read_at` provenance is deferred to R-2;
- `TypeError` / `ValueError` must fail closed.

Only `src/blatifa/production/gates.py` changed in production code.

## 2. API before and after

```python
# before (5.3g.4.1)
def credit_evidence(reading, *, now: datetime | None = None, max_age_s: int = CREDIT_EVIDENCE_MAX_AGE_S): ...
def approval_balance(value, *, adapter, now: datetime | None = None): ...
# after (5.3g.4.2)
def credit_evidence(reading) -> tuple[ReadStatus, int | None, str]: ...
def approval_balance(value, *, adapter) -> int | None: ...
def _freshness_verdict(age_s) -> str | None: ...            # private, pure
```

No new public parameter, configuration object or override was introduced (`test_no_public_function_in_gates_accepts_a_time_or_age`).

## 3. Fixed freshness policy

`credit_evidence` computes `age = (datetime.now(UTC) - parse_time(reading.read_at)).total_seconds()` and asks
`_freshness_verdict(age)`:

| Age (s) | Verdict |
|---|---|
| −5.000 | fresh (inclusive) |
| −5.001 | refused: "reading is dated in the future" |
| 0, 299.999, 300.000 | fresh (300 inclusive) |
| 300.001, 301 | refused: "reading is N s old (> 300 s): not a current balance" |
| NaN, +∞, −∞ | refused: "reading age is not finite" |
| not an int/float, or a bool | refused: "reading age is not a number" |

- The limits are literals inside `_freshness_verdict`, which reads no module-level name, clock or setting (AST test).
- `CREDIT_EVIDENCE_MAX_AGE_S` (300) and `CREDIT_EVIDENCE_MAX_CLOCK_SKEW_S` (5) remain only as documentation.
  Rebinding them changes nothing; this is proven by a test. In 5.3g.4.1, rebinding the skew constant did change
  behaviour.
- The reason texts for stale and future readings are the same as before.

## 4. Fail-closed time errors

- The validation order is unchanged:
  1. `None`, `CreditSnapshot` and non-`BalanceReading` types are rejected first.
  2. Then the status (`VERIFIED_WITHOUT_INTERACTION`) and `verified_balance` are checked. Parse validity is
     enforced by the data model at construction.
  3. Only then is the time evaluated.
- `TypeError` / `ValueError` raised while evaluating the time give `(UNKNOWN, None, "reading time cannot be
  evaluated: …")`, which becomes `CREDIT_UNKNOWN` in preflight and `None` (COST_OVER_BALANCE) in approval.
- No `except Exception`. Other errors (`RuntimeError`, as tested) still propagate.
- The data model is unchanged: a naive or malformed `read_at` is still refused when a `BalanceReading` is
  constructed. The new handling covers readings that bypass the model, such as `object.__setattr__` on the frozen
  dataclass, or a subclass.
- Extreme but valid timestamps (year 1, year 9999, ±14:00) were probed. They do not overflow and are refused as stale
  or future-dated, so no `OverflowError` handling was needed.

## 5. Historical test migration (user-approved)

- **5.3g.3:** the 5 `now=NOW` calls in 4 tests were migrated. All 6 deltas and their outcomes are preserved,
  checked deterministically on `_freshness_verdict` and end to end against the real clock (except the exact −300
  boundary).
- **5.3g.4.1:** the one signature assertion now expects `["value", "adapter"]`. The integrity test is now
  chain-aware.
- **Root pins:** the 5.3g.4 and 5.3g.4.1 tests have new `INTEGRITY_ROOTS` pins.
- The brief's path `tests/test_phase5_3g3_credit_contract.py` does not exist. The file is
  `tests/unit/test_phase5_3g3_credit_contract.py`.
- The brief mentions two G.4.1 signature assertions; there is only one (TEST_REPORT §5).

## 6. Results

| Check | Result |
|---|---|
| New tests (`test_phase5_3g4_2_freshness.py`) | 79, all passing |
| Targeted (G.4.2, G.3, G.4, G.4.1, 5.3g, g.1, g.2, f, f.1, e) | 621 passed (`evidence/pytest_targeted.log`) |
| Full offline regression (without `tests/browser`) | **970 passed, 7 skipped, 0 failed**, exit 0 (`evidence/pytest_full.log`) |
| `tests/browser` (43) | **not run**: forbidden by brief §11 (Playwright/CDP) |
| ruff | clean |
| Gate rules sha | `181d780a…`, unchanged |
| Protected hashes | 326 checked: 321 unchanged, 2 approved rows, 3 pinned roots, 0 unexplained (SAFETY_AUDIT §2) |
| Flags | `LIVE_ACTIONS_ACTIVE=False`, 18 `deny: true`, `BLATIFA_LIVE` unset |

## 7. Verdict: CONDITIONAL PASS

Implemented and tested:
- the override parameters are removed;
- the fixed policy has exact boundaries;
- NaN and ∞ are refused;
- time errors fail closed;
- no production call site can supply freshness;
- adapter trust and the gate rules are unchanged;
- the integrity chain is exact and fail-closed;
- history is untouched.

Not PASS, for one reason. The 43 `tests/browser` tests were not run, because this phase forbids browser connections.
They include `test_account_and_capture.py`, which exercises `run_preflight` → `credit_evidence` on a local fixture
page. Running them needs the user's separate approval. They start a local Chrome on fixture pages, not Flow.

## 8. Still OPEN / DEFERRED

These items are not resolved by this phase:
- **R-2:** `read_at` provenance. Re-stamping or direct construction is still judged fresh. Deferred.
- Same-process monkeypatching.
- F-4.
- `read_credits()` clicks.
- `ESTIMATED` accepted without a producer.
- No independent trust anchor.
- `MUTATION EVIDENCE NOT INDEPENDENTLY VERIFIED`.

Details: SAFETY_AUDIT §5.
