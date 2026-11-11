# Phase 5.3g.4.3.1: threat model (host-based alternatives)

> **Ringkasan (ID):** Ancaman untuk menjalankan tes browser langsung di macOS tanpa VM.
> - Ancaman jaringan bisa ditutup dengan pemutusan fisik (atau PF) yang dibuktikan dan diawasi.
> - Ancaman ke direktori Chrome personal (Crashpad) **tidak** tertutup oleh isolasi jaringan.
> - Chrome Blatifa yang sedang berjalan ikut offline.

| # | Threat | Control (recommended path) | Label | Residual |
|---|---|---|---|---|
| H1 | Chrome background traffic (updates, Safe Browsing, variations) | no route (disconnection) or PF egress block | UNVERIFIED | none if N1–N11 pass |
| H2 | DNS leak via `mDNSResponder` | no reachable interface → no resolver; PF blocks port 53 off-host | UNVERIFIED | per-app firewalls do **not** close it (MACOS_NETWORK_ISOLATION_OPTIONS §3) |
| H3 | IPv6 bypass | N1/N2: no IPv6 state and no global default route | UNVERIFIED | `utun` IPv6 default routes exist today; must be shown unusable (N4/N5) |
| H4 | Silent reconnection during the run (auto-join, a cable, an iPhone) | N9 monitor aborts the run | UNVERIFIED | the abort happens after detection; at most ≈ 1 s of exposure |
| H5 | Test reaches Google Flow | static: no path (F6); runtime: no route | STATICALLY_CONFIRMED + UNVERIFIED | if a test changed, the static argument would no longer hold |
| H6 | Live action / credits | `LIVE_ACTIONS_ACTIVE=False`, 18 `deny: true`, `BLATIFA_LIVE` unset; no Google session in the tmp profile | STATICALLY_CONFIRMED | none |
| H7 | Personal Chrome **profile** access | tmp profile + `assert_profile_allowed` | STATICALLY_CONFIRMED | — |
| H8 | Writes to the personal Chrome **directory** (Crashpad) | separate macOS user, **or** explicit user acceptance | VERIFIED threat (on crash) | open until decided |
| H9 | Effect on the running Blatifa Chrome | it is not touched (no attach, no stop); it simply goes offline | STATICALLY_CONFIRMED (tests use tmp workspaces only; G.4.2.1) | its Flow tab may show network errors; no action is replayed |
| H10 | Chrome sandbox disabled to "make it work" | forbidden; command-line check | — | — |
| H11 | System change not reverted (PF anchor left loaded, Wi-Fi left off) | PF: token-based enable and release, verified by `pfctl -s References`; disconnection: the user restores it | UNVERIFIED | the user must reconnect |
| H12 | The existing Bitdefender Network Extension interferes, or logs test traffic | offline: nothing leaves; the logging is unknown | UNKNOWN | not inspected |
| H13 | Installing LuLu or Little Snitch adds a second filter next to Bitdefender | avoided by the recommendation | — | — |
| H14 | Disk / RAM pressure (8 GiB RAM, ≈ 9–10 GiB free disk) | host run needs no extra disk; one headless Chrome | VERIFIED (resource facts) | project rule: ≥ 10 GiB for a full regression; a browser-only run is small, but the rule needs a user decision |
| H15 | False confidence from past host runs (G.4.1) | those runs were **not isolated**; they prove functionality, not network safety | VERIFIED | — |

**Acceptance criteria before any execution approval:**
1. N1–N11 PASS.
2. Chrome command-line and helper checks PASS (CHROME_SANDBOX_COMPATIBILITY §2).
3. The H8 decision is recorded.
4. Protected hashes and `p53g.db` are recorded before and after.
5. Group C is authorized separately.
6. A separate explicit user authorization is given.
