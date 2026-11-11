# Phase 5.3g.4.3.1: implementation recommendation (NOT implemented)

> **Ringkasan (ID):**
> - Peringkat:
>   1. **Pemutusan jaringan fisik oleh pengguna**, plus verifikasi read-only dan monitor. Tanpa instalasi, tanpa
>      disk/RAM tambahan. Opsi tambahan: **akun macOS khusus tes** untuk menjauhkan Crashpad dari direktori
>      personal.
>   2. **PF bawaan** atau firewall aplikasi. PF tidak perlu instalasi tetapi mengubah firewall sistem; LuLu atau
>      Little Snitch perlu instalasi dan punya celah DNS.
>   3. **VM** (desain G.4.3) hanya kalau 1 dan 2 gagal dibuktikan.
> - Tidak ada yang dijalankan di fase ini.

## 1. Preferred, no installation: verified physical disconnection

| Aspect | Content |
|---|---|
| Procedure (future) | the **user** turns Wi-Fi off and unplugs every adapter, iPhone and Thunderbolt peer. Claude runs only read-only checks N1–N11 and the N9 monitor, then the authorized batches (Groups A + B first, 28 tests), then stops. The user reconnects |
| Security properties | no route from any process, including Chrome Helpers and system daemons; Chrome's sandbox untouched; loopback for CDP and fixtures |
| RAM | none extra beyond one headless test Chrome (≈ 300–600 MB, UNVERIFIED) |
| Disk | none extra (tmp profiles of some MB; logs) |
| Operational complexity | low; one manual step for the user; the run is short (G.4.1: the whole suite of 941 took 456 s; the browser part is a fraction) |
| Limitations | whole Mac offline, including the Blatifa Chrome, Bitdefender and iCloud; no per-packet counters (attribution through "no route" plus fast `ENETUNREACH`); depends on the user keeping it off |
| Remaining risks | H4 (reconnection, mitigated by N9), **H8 (Crashpad)**, H12 (Bitdefender UNKNOWN) |
| Required authorization | (a) running the read-only verification; (b) the user disconnecting; (c) test execution per group; (d) the H8 decision |

**1b: complement for H8, no installation: a test-only macOS user account**

| Aspect | Content |
|---|---|
| Idea | run the browser batches as a separate standard user. Chrome's default paths, including Crashpad, then lie in that user's home. File permissions keep the test Chrome out of the personal home |
| RAM / disk | a new home (tens of MB) plus a copy of the project into a location that user can read, e.g. `/Users/Shared/…`: `src`, `tests`, the one mp4 and a venv (≈ 180 MB) |
| Complexity | medium: needs admin, a new user, a copy, and running as that user |
| Limitations | a system change (new account); the copy must be checked for no `p53g.db` and no personal data; the copy's tests must be identical to the original (hash compare) |
| Required authorization | creating the account, copying, and later deleting the account |

## 2. Alternative with minimal change or installation

| | PF anchor (built in, no install) | LuLu (install) | Little Snitch (install, paid) |
|---|---|---|---|
| Security | system-wide egress block except `lo0`, DNS included, counters | per app; **DNS gap via `mDNSResponder`**; helper coverage UNKNOWN | same gaps; strong rule export |
| RAM / disk | ≈ 0 | small app + system extension | small app + system extension |
| Complexity | medium: `sudo pfctl`, anchor, token, release, verify | medium: install, approve the extension, rules | medium + licence |
| Limitations | a **system firewall change**; the whole Mac is offline anyway (same effect as 1, with counters) | does not by itself prove isolation of Chrome | same |
| Remaining risks | rule left loaded (mitigated by the token and `-s References`); interaction with Apple anchors and Bitdefender UNKNOWN | second Network Extension next to Bitdefender | same |
| Required authorization | root, firewall change and revert | installation + extension approval | installation + purchase |

- **Ranking inside 2:** PF before LuLu and Little Snitch, because it needs no installation, covers DNS and helpers,
  and gives counters.
- PF is useful mainly as an **attribution layer on top of 1**: disconnection plus PF counters. It is not needed if
  the N-checks are accepted as proof.

## 3. VM fallback

- **When:** only if 1 and 2 cannot be proven (e.g. N5 shows timeouts, an interface cannot be turned off, or the
  user rejects any whole-Mac offline period).
- **What:** the G.4.3 design:
  - Linux guest without NIC;
  - ≥ 20 GiB free disk;
  - 3 GiB guest RAM;
  - the Q-1 decision for the hard-coded Chrome path.

## 4. Q7 / Q8 answers

- **Q7: a meaningful subset without a VM or installation?** Yes, by design. With option 1:
  - Groups A + B (28 tests) cover engine recovery, account and preflight reading, validators, the control UI and
    video properties;
  - Group C (15) could follow under a separate approval.
  
  UNVERIFIED until N1–N11 pass.
- **Q8: lowest risk for 8 GiB RAM and limited disk:**
  - **option 1**, because it adds no disk, no RAM and no software;
  - with **1b** if the user does not accept H8. 1b costs ≈ 200 MB of disk and an admin action.
