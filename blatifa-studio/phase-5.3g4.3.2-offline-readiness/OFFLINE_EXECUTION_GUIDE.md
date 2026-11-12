# Phase 5.3g.4.3.2: offline execution guide

> **Ringkasan (ID):** Panduan untuk Anda (pengguna). Langkah A dilakukan sekarang, selagi masih online. Langkah B
> dan C baru dilakukan setelah Anda memberi persetujuan eksplisit untuk 5.3G.4.3.2. Claude tidak mematikan
> jaringan; Anda yang melakukannya sendiri.

Script: `docs/phase-5.3g4.3.2-offline-readiness/script/n_isolation_check.py`

Expected SHA-256: `d6ec5c215d0d101ab5bde857e049e075def0bdd4f33e3e2fab17924e31245eff`

## A. Preparation (online, no network change)

**A1. Verify the script in your personal account.**

```sh
cd "$HOME/Developments/My Project/blatifa-studio/docs/phase-5.3g4.3.2-offline-readiness/script"
shasum -a 256 n_isolation_check.py
```

The hash must equal the expected value above. If it does not, stop.

**A2. Put a copy where the test account can read it.**

```sh
mkdir -p /Users/Shared/blatifa-offline
cp n_isolation_check.py /Users/Shared/blatifa-offline/
chmod 755 /Users/Shared/blatifa-offline
chmod 644 /Users/Shared/blatifa-offline/n_isolation_check.py
shasum -a 256 /Users/Shared/blatifa-offline/n_isolation_check.py
```

The copy's hash must also match.

**A3. Identify the test account and check its Python.** Log in to the dedicated test account (fast user switching
is fine), open Terminal there, and run:

```sh
id -un
/usr/bin/python3 -I -c 'import sys; print(sys.version)'
```

- `id -un` prints the account's **short name**. Write it down; it is `<TEST_USER>` below. Do not use the full
  display name. Do not use your personal account.
- The Python line must print a version (3.9.x expected) **without** an install or licence dialog. If a dialog
  appears, cancel it and stop: the run would be BLOCKED, and installing anything is outside scope.
- Do not open Chrome or Blatifa in the test account.

**A4 (optional, needs your approval).** `--selftest` checks the parsers against built-in samples. It creates no
socket, runs no command and writes no file (the code replaces `socket.socket` and `subprocess` with a hard error):

```sh
/usr/bin/python3 -I /Users/Shared/blatifa-offline/n_isolation_check.py --selftest
```

Expected last line: `SELFTEST: OK (31 cases)`. It is recommended before the offline run, so that a parser bug does
not waste your offline window.

## B. Offline run (only after explicit approval of 5.3G.4.3.2)

**B1. Disconnect the whole Mac yourself:**

- Wi-Fi **off** (menu bar → Wi-Fi → off). Off, not merely "not connected";
- unplug every Ethernet adapter or dock (`en3`/`en4`);
- unplug any iPhone or iPad, and do not use Personal Hotspot or Bluetooth tethering;
- nothing on the Thunderbolt ports that offers networking;
- do not start a VPN.

The running Blatifa Chrome in your personal account simply goes offline. Do not touch it.

**B2. Run, in the test account's Terminal:**

```sh
OUT=/Users/Shared/blatifa-offline/evidence-$(date -u +%Y%m%dT%H%M%SZ)
/usr/bin/python3 -I /Users/Shared/blatifa-offline/n_isolation_check.py --expected-user <TEST_USER> --out "$OUT"
echo "exit=$?"
```

- It takes about 70–80 s: the checks, then a 60-second monitor.
- **Do not reconnect anything until it prints `VERDICT:`**.
- If it stops early, that is intended. Do **not** re-run it to "try again" without reporting first.

**B3. Reconnect** only after the `VERDICT:` line has appeared: Wi-Fi on, cables back.

## C. Interpreting the result

| Verdict | Exit | Meaning | What to do |
|---|---|---|---|
| PASS | 0 | every mandatory check had positive evidence of no external path, for the 60 s window | report it; it still authorizes nothing |
| CONDITIONAL PASS | 1 | everything passed, but IPv6 relied on the H3 provision (interface-scoped `utun` defaults shown unusable) | report; you decide D-1 |
| BLOCKED | 2 | something could not be proven: wrong account, Wi-Fi power On, an unknown output, a slow or odd probe result, a timeout, a monitor change | report; do not retry on your own |
| FAIL | 3 | evidence of an external path (an address, a route, a reachable resolver, a probe that did not fail) | report; the Mac was **not** isolated |

## D. Evidence and submission

The evidence directory (`$OUT`) contains:

| File | Content |
|---|---|
| `run.log` | the terminal output, with UTC timestamps |
| `checks.json` | every check: id, original ids, status, summary, details |
| `monitor.jsonl` | one line per monitor sample (kept even after an abort) |
| `raw/*.txt` | each command's output (MACs and non-documentation addresses masked) |
| `meta.json` | script hash, Python, user, start and finish times, verdict |
| `verdict.txt` | the verdict |
| `SHA256SUMS` | hashes of every evidence file |
| `traceback.txt` | only after an unexpected error |

After reconnecting, back in your personal account, tell Claude the evidence directory path and the exit code. Do
not edit or move the files. Claude will check `SHA256SUMS`, `meta.json` (script hash must be the one above) and each
check, read-only.
