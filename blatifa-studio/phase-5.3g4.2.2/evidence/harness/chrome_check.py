"""Stage B §4.3: launch Chrome exactly like tests/browser/conftest.py (temporary workspace/profile, headless), attach
over CDP, and check what the page can reach. Run INSIDE sandbox-exec. Targets: a loopback HTTP server started here,
the TEST-NET address 192.0.2.1 (no real host) and a reserved .test name. No Flow, no pytest."""
import json, subprocess, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from blatifa.browser.engine import BrowserEngine
from blatifa.config import Settings

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers(); self.wfile.write(b"loopback-ok")
    def log_message(self, *a): pass
srv = HTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
out = {}
with tempfile.TemporaryDirectory(prefix="g4222-chrome-") as tmp:
    eng = BrowserEngine(Settings(workspace=Path(tmp)), "test", headless=True)
    rec = eng.start(start_url="about:blank")
    page = eng.attach()
    out["chrome"] = {"pid": rec.pid, "cdp_port": rec.port, "version": rec.chrome_version,
                     "profile_dir_is_temporary": str(eng.profile_dir).startswith(tmp), "profile_dir": str(eng.profile_dir)}
    ps = subprocess.run(["ps", "-axo", "pid,ppid,command"], capture_output=True, text=True).stdout.splitlines()
    procs = [l for l in ps if str(eng.profile_dir) in l]
    out["chrome"]["processes_with_this_profile"] = len(procs)
    out["chrome"]["helper_types"] = sorted({p.split("--type=")[1].split()[0] for p in procs if "--type=" in p})
    for name, url in [("loopback", f"http://127.0.0.1:{srv.server_port}/"), ("testnet_ip", "http://192.0.2.1/"),
                      ("reserved_name", "http://flow.example.test/"), ("about_blank", "about:blank")]:
        try:
            page.goto(url, timeout=15000)
            out[name] = {"ok": True, "body": page.inner_text("body")[:40]}
        except Exception as e:
            out[name] = {"ok": False, "error": str(e).splitlines()[0][:160]}
    eng.stop()
print(json.dumps(out, indent=1))
