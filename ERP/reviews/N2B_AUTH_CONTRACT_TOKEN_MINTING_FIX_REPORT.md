# N-2B S2.2 Workstream B — Auth Contract Token-Minting Fix

**Date:** 2026-10-14
**Inputs:** `N2B_S2_1_PLATFORM_AUTHORIZATION_HARDENING_REPORT.md` §4.A (defect pinned, not fixed).
**Verdict (Workstream B):** **GO** (§7).

---

## 1. The Defect (from S2.1)

`CoreAuthServiceImpl.authenticate` and `.refresh_token` (`app/contracts/auth/impl.py`) called `create_access_token(subject=…)` / `create_refresh_token(subject=…)`. They raised `TypeError` before any token existed.

Renaming the argument would not have been enough. The code also diverged from HTTP login/refresh in five ways:

1. `refresh_token` minted from the presented token **without re-checking the account** (unknown, inactive or deleted users would have refreshed). This is the N7 class.
2. It dropped `tid`, minting tenant-less tokens.
3. `authenticate` used `sub = user.id` (UUID), while HTTP uses `sub = username`.
4. It produced `roles=[]` and `permissions=[]` (`User` has no `roles` attribute) and never derived a principal scope.
5. It looked users up on a plain `DatabaseFactory.get_session()`. Under FORCE RLS on `auth.users` that finds **no tenant user at all**: the Phase 3.0J login-lockout class.

---

## 2. Fix: One Shared Implementation

**New module, `app/core/auth/issuance.py`**, extracted **unchanged** from `app/api/v1/auth.py`:
- `load_active_user(session, username)`: lookup by the globally unique username; `is_active`, `NOT is_deleted`; roles → permissions eagerly loaded.
- `load_role_names_and_permissions(user)`: real grants (superuser → `*.*.*`), codes `module.resource.action`.
- `principal_scope(user)`: platform **only** for a superuser with no tenant; derived from the current DB row.

**Callers:**
- **HTTP `login` / `refresh`** (`app/api/v1/auth.py`) now call `load_active_user`. `_load_role_names_and_permissions` and `_principal_scope` remain as aliases.
  - **Behaviour unchanged:** same query, same claims, same responses.
  - Refresh still does **not** rotate the refresh token.
- **Contract adapter** (`app/contracts/auth/impl.py`):
  - **`authenticate(username, password, tenant_id=None)`:**
    - runs on `cross_tenant_admin_session()` (as login does), so it can see users under RLS, with the soft-delete filter kept;
    - calls `load_active_user`, then `verify_password`; unknown, inactive or deleted users, a missing hash or a wrong password all raise `TokenError("Invalid credentials")`;
    - `tenant_id` **only narrows**: a user of another tenant, or a tenant-less user, is rejected like a wrong password. It never selects or switches a tenant;
    - mints through `_mint_access(user)` with **exactly** HTTP login's arguments (`user_id=username`, `tid` from the row, real roles and permissions, `principal_scope(user)`), plus a refresh token like HTTP login's.
  - **`refresh_token(token)`:**
    - `verify_refresh_token` (signature, expiry and `type=refresh`, unchanged);
    - requires `sub`;
    - re-reads the account with `load_active_user` (missing, inactive or deleted → `TokenError("User no longer active.")`);
    - re-derives **everything** from the current row, copying nothing from the presented token;
    - returns the same refresh token, as `/auth/refresh` does.
- **Not introduced:** a new secret, a new claim, issuer/audience, tenant selection or impersonation. `extra_claims` is never passed by any issuer, and S2's minting guard still refuses `scp` inside it.

---

## 3. Static Pins Moved With the Code

| Pin | Before | After |
|---|---|---|
| `test_n2b_s2_platform_principal.py::test_platform_scope_is_minted_in_exactly_one_function` | `app/api/v1/auth.py::_principal_scope` | `app/core/auth/issuance.py::principal_scope`. The invariant is unchanged: exactly one minting function. |
| `test_n2b_s2_1_platform_authorization.py` call-site guard | 4 contract sites pinned as not binding | **0** non-binding sites; the contract's `_mint_access` and `authenticate` sites now listed as binding |
| S2.1 "contract refresh fails closed" pin (`TypeError`) | expected the crash | replaced: the crash is gone and bad input is still refused; real behaviour is in the integration tests below |
| S2.1 login-code source check | `app/api/v1/auth.py` | `app/core/auth/issuance.py` |

---

## 4. Tests

**`tests/integration/test_n2b_auth_contract_token_minting.py`** (8 tests). Real adapter methods and real users; every token checked through the **normal pipeline** (`GET /auth/me` → `get_current_user`).

| Test | Verifies |
|---|---|
| unknown / wrong password / inactive / deleted | `authenticate` raises `TokenError` for each |
| claims equal HTTP login | contract access **and** refresh claims equal those from `POST /auth/token` for the same user (minus `exp`/`iat`/`jti`); `/auth/me` shows tenant, tenant scope and the real permissions |
| platform scope only for a tenant-less superuser | tenant-less superuser → `platform`, no tenant; superuser with a tenant → `tenant` (keeps `*.*.*`) |
| `tenant_id` narrows only | match → token for that tenant; mismatch → rejected; a tenant-less user + `tenant_id` → rejected (never placed into a tenant) |
| refresh re-derives current state | not rotated; promotion to a tenant-less superuser shows as `platform` on the next refresh; deactivated → "no longer active"; soft-deleted → rejected |
| refresh never trusts presented claims | a validly signed refresh token carrying `scp=platform`, a foreign `tid`, `superadmin` and `*.*.*` yields a **tenant** token for the user's real tenant, with no roles or permissions |
| token-type and signature checks kept | an access token used as refresh, garbage, a wrong-key signature and an unknown subject are all rejected |
| interchangeable with HTTP | an HTTP-login refresh token works on the contract; a contract refresh token works on `POST /auth/refresh` |

**`tests/integration/workflow_postgres/test_n2b_auth_contract_postgres.py`** (1 test; real PostgreSQL with FORCE RLS on `auth.users`):
- the contract authenticates and refreshes a **tenant-owned** user;
- the result is verified through `get_current_user`;
- after deactivation, both refresh and authenticate are rejected.

**Mutation check (4/4 detected):**

| # | Mutation | Failing tests |
|---|---|---|
| B-M1 | `is_active` filter removed from `load_active_user` | 2 |
| B-M2 | contract ignores the `tenant_id` narrowing | 1 |
| B-M3 | contract refresh mints for a missing or inactive account from the token's claims | 2 |
| B-M4 | every superuser minted platform | 2, across contract and S2 tests |

**Results:**
- New tests: 8 + 1 passed.
- Real HTTP login/refresh paths: `test_n2b_s2_login_principal_scope.py` (3), `test_n2b_s2_1_platform_routes_login.py` (3) and `test_api_health.py` (7) pass inside the **21 passed** top-level integration run.
- The full unit run is **3,881 passed**, and the PostgreSQL runs are as listed in the Workstream A report §6.
- **Not run:** see the Workstream A report §6.

---

## 5. Compatibility

- HTTP issuance is byte-for-byte the same in claims; the integration test compares them directly.
- The contract still has **no in-repo caller**: `test_no_in_repo_caller_reaches_the_contract_mint_paths` still passes. Its behaviour is now correct for any future consumer.

## 6. Unresolved

None for this workstream. Pre-existing and noted only: `CoreAuthServiceImpl.check_permission` builds empty role and permission lists, so it always returns False; it was not in scope.

## 7. Verdict: **GO**

- Both contract methods now use the same trusted lookup, account checks and claim derivation as HTTP login/refresh.
- They are proven against real users, including under real PostgreSQL RLS, through the normal validation pipeline, and the guards are mutation-tested.

**Files:**
- New: `app/core/auth/issuance.py`.
- Changed: `app/api/v1/auth.py`, `app/contracts/auth/impl.py`.
- New tests: `tests/integration/test_n2b_auth_contract_token_minting.py`, `tests/integration/workflow_postgres/test_n2b_auth_contract_postgres.py`.
- Updated tests: `tests/unit/test_n2b_s2_platform_principal.py`, `tests/unit/test_n2b_s2_1_platform_authorization.py`.

**No commit and no push.**
