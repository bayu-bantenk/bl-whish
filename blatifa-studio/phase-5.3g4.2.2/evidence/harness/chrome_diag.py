"""Diagnostic for the Stage B Chrome crash: start + attach + about:blank + loopback only (no external target).
Keeps the Chrome log. Usage: chrome_diag.py <workdir>"""
import json, sys, threading, traceback
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from blatifa.browser.engine import BrowserEngine
from blatifa.config import Settings
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write(b"loopback-ok")
    def log_message(self, *a): pass
srv = HTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
work = Path(sys.argv[1]); work.mkdir(parents=True, exist_ok=True)
eng = BrowserEngine(Settings(workspace=work), "test", headless=True); out = {"steps": []}
try:
    rec = eng.start(start_url="about:blank"); out["steps"].append(f"start ok pid={rec.pid} port={rec.port} {rec.chrome_version}")
    page = eng.attach(); out["steps"].append(f"attach ok url={page.url}")
    page.goto("about:blank"); out["steps"].append("goto about:blank ok")
    page.goto(f"http://127.0.0.1:{srv.server_port}/", timeout=15000); out["steps"].append(f"loopback ok body={page.inner_text('body')}")
except Exception as e:
    out["error"] = f"{type(e).__name__}: {str(e).splitlines()[0][:200]}"
finally:
    try: eng.stop()
    except Exception as e: out["stop_error"] = str(e)[:120]
log = work / "logs" / "chrome-test.log"
out["chrome_log_tail"] = log.read_text(errors="replace").splitlines()[-25:] if log.exists() else []
print(json.dumps(out, indent=1))
