# Phase 5.3g.4.3.1: Chrome sandbox compatibility (macOS alternatives)

> **Ringkasan (ID):**
> - Empat hal ini berbeda dan tidak boleh dicampur:
>   - sandbox internal Chrome;
>   - sandbox proses macOS;
>   - isolasi jaringan;
>   - isolasi fixture tes.
> - `sandbox-exec` gagal karena ia **sandbox proses**, bukan isolasi jaringan murni, dan bertabrakan dengan sandbox
>   Chrome.
> - Pemutusan fisik dan PF bekerja di **lapisan jaringan**, jadi tidak menyentuh sandbox Chrome.
> - Q2 (Chrome dengan sandbox native saat offline): sangat mungkin bisa, tetapi **UNVERIFIED**.

## 1. Four distinct boundaries

| Boundary | What it is | Mechanism here | Status |
|---|---|---|---|
| **Chrome's internal security sandbox** | Chrome confines its renderer, GPU and network-service helpers with Seatbelt profiles it applies itself | default launch: `chrome.build_args` has no `--no-sandbox` | STATICALLY_CONFIRMED (no disabling flag, `chrome.py:79-94`); that it is engaged is **UNVERIFIED** (never checked via `chrome://sandbox`) |
| **macOS process sandboxing** | a Seatbelt profile imposed from outside on a process tree (`sandbox-exec`, App Sandbox) | G.4.2.2 used `sandbox-exec` | VERIFIED incompatible with Chrome: `sandbox initialization failed: Operation not permitted` (G.4.2.2 `chrome_diag_inside.json`) |
| **Network isolation** | no packet can leave the host | candidates: physical disconnection, PF; a VM (G.4.3) | not established on the host (UNVERIFIED) |
| **Test fixture isolation** | tests load only local pages, use tmp profiles and tmp paths | `file://` fixtures, tmp workspace, `assert_profile_allowed` | STATICALLY_CONFIRMED (BROWSER_TEST_CLASSIFICATION F1, F3, F6). **Exception:** Crashpad (F4) |

The G.4.2.2 failure was a collision of rows 1 and 2. Rows 3 and 4 need not involve row 2 at all.

## 2. Q2: can Chrome keep its native sandbox while the network is unavailable?

- **Mechanism:**
  - physical disconnection and PF act on routes or packets;
  - neither applies a Seatbelt profile, so Chrome initialises its sandbox exactly as in a normal launch;
  - Chrome is routinely used offline.
  
  Label: STATICALLY reasoned, UNVERIFIED.
- **Existing evidence:**
  - the default launch of the fixture Chrome works on this host and all 43 tests passed (G.4.1, 5.2.1; VERIFIED,
    but with the network on);
  - the outside-sandbox control of G.4.2.2 (start → `about:blank` → loopback page) worked (VERIFIED).
- **Not yet shown:**
  - Chrome start-up while fully offline (UNVERIFIED);
  - the sandbox being engaged (UNVERIFIED in any run).

**Checks required in a future phase**, with the unchanged fixture launch:
1. The browser-process command line (`ps -o command= -p <pid>`) equals `build_args` and has no sandbox-disabling
   flag.
2. Helper processes run as separate processes (`ps`: `Google Chrome Helper (Renderer)`, `… (GPU)`, network
   service).
3. `chrome://sandbox` is opened in the test Chrome over CDP. It is a local page, and it reports the renderer
   sandbox as active. If the page is not available on macOS: UNKNOWN, and record it as such.
4. The first page loads with no `Target crashed`.

## 3. Other native macOS mechanisms (section D)

| Mechanism | Keeps Chrome sandbox? | Restricts network? | Install / admin | Assessment |
|---|---|---|---|---|
| `sandbox-exec` (existing) | **no** (VERIFIED crash) | yes (VERIFIED for ordinary processes) | none | rejected |
| `sandbox-exec` around Python only, Chrome outside | — | Chrome is a child of Python (`subprocess.Popen`, `chrome.py:114-120`), so it inherits the profile | — | impossible without a code change |
| A profile that "allows nested sandbox" | — | — | — | no documented mechanism; would be an **undocumented bypass**: rejected |
| Physical disconnection | yes (UNVERIFIED) | yes, all processes | none; user action | **preferred** (IMPLEMENTATION_RECOMMENDATION) |
| PF anchor (`block out` except `lo0`) | yes (UNVERIFIED) | yes, system-wide, with counters | root; system firewall change | viable, needs explicit authorization |
| Application Firewall | yes | **no** (incoming only) | — | unusable |
| Network Extension content filter (own) | yes | yes | signing entitlement + install | out of scope (development + install) |
| Network Link Conditioner (100 % loss) | yes | partly (dummynet profile) | separate Xcode tool download | not preferred: install + semantics UNVERIFIED |
| Chrome enterprise policies (managed preferences) | yes | **no**: URL blocklists do not stop background services | admin; managed prefs apply to **every** Chrome of that bundle, including the personal one | rejected (it touches personal Chrome behaviour) |
| Screen Time / content filtering | yes | URL-based only | settings change | insufficient |
| **Separate macOS user account for tests** | yes | **no** (not a network control) | admin; creates a user | **useful as a complement:** a different home directory puts Crashpad and any Chrome default paths under the test user. The OS blocks access to the personal home by file permissions. Solves F4 without code change (UNVERIFIED) |

## 4. Crashpad (F4) on the host

- **VERIFIED:** a crashing test Chrome writes to the personal Crashpad database.
- **UNKNOWN:** whether a *normal* start or stop touches it (e.g. `settings.dat`). Checking that would mean
  inspecting the personal Crashpad metadata, which is not allowed.
- **Options:**
  - **(a)** the user accepts the risk explicitly for the run;
  - **(b)** run as a separate macOS user (§3);
  - **(c)** a code change (test-only crash directory), in a separate phase.
  
  Disconnection and PF do not address F4.
