"""Stage B isolation verification (driver runs OUTSIDE the sandbox). Usage: verify.py <isolation.sb> <python> <out.json>

Starts two loopback echo servers (A allowed, B on a port added to a harness-only deny rule), then runs probe.py
under sandbox-exec for every case, plus two controls outside the sandbox. No browser, no pytest."""
import json, socket, subprocess, sys, threading, time
from datetime import UTC, datetime
from pathlib import Path
profile, py, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
probe = str(Path(__file__).with_name("probe.py"))

def echo_server():
    srv = socket.socket(); srv.bind(("127.0.0.1", 0)); srv.listen(8)
    def loop():
        while True:
            c, _ = srv.accept()
            if c.recv(16).strip() == b"ping": c.sendall(b"pong\n")
            c.close()
    threading.Thread(target=loop, daemon=True).start()
    return srv.getsockname()[1]
A, B = echo_server(), echo_server()
harness = profile.with_name("isolation_harness.sb")
harness.write_text(profile.read_text() + f';; harness only: prove that a per-port loopback deny works, on our own listener\n(deny network-outbound (remote ip "localhost:{B}"))\n')

def sandboxed(prof, *args):
    p = subprocess.run(["sandbox-exec", "-f", str(prof), py, "-B", probe, *map(str, args)], capture_output=True, text=True, timeout=60)
    return {"exit": p.returncode, **(json.loads(p.stdout) if p.stdout.strip() else {"stderr": p.stderr[-300:]})}
def outside(*args):
    p = subprocess.run([py, "-B", probe, *map(str, args)], capture_output=True, text=True, timeout=60)
    return {"exit": p.returncode, **json.loads(p.stdout)}

cases = [
 ("4.1 loopback echo (allowed new port A)", "in", profile, ("tcp", "127.0.0.1", A), "CONNECTED+pong"),
 ("4.1 loopback, port already listening -> denied (harness rule, own listener B)", "in", harness, ("tcp", "127.0.0.1", B), "EPERM"),
 ("control: same listener B outside the sandbox", "out", None, ("tcp", "127.0.0.1", B), "CONNECTED+pong"),
 ("4.2 TCP IPv4 TEST-NET 192.0.2.1:80", "in", profile, ("tcp", "192.0.2.1", 80), "EPERM"),
 ("control: TCP TEST-NET 192.0.2.1:80 outside the sandbox (no host there)", "out", None, ("tcp", "192.0.2.1", 80), "not EPERM (timeout/unreachable)"),
 ("4.2 TCP IPv4 public 1.1.1.1:443", "in", profile, ("tcp", "1.1.1.1", 443), "EPERM"),
 ("4.2 TCP IPv6 public [2606:4700:4700::1111]:443", "in", profile, ("tcp6", "2606:4700:4700::1111", 443), "EPERM"),
 ("4.2 TCP LAN resolver 192.168.1.2:53", "in", profile, ("tcp", "192.168.1.2", 53), "EPERM"),
 ("4.2 UDP public 1.1.1.1:53", "in", profile, ("udp", "1.1.1.1", 53), "EPERM"),
 ("4.2 UDP LAN resolver 192.168.1.2:53", "in", profile, ("udp", "192.168.1.2", 53), "EPERM"),
 ("4.2 UDP loopback 127.0.0.1:53", "in", profile, ("udp", "127.0.0.1", 53), "EPERM"),
 ("4.2 DNS getaddrinfo('example.com') (system resolver via mDNSResponder)", "in", profile, ("dns", "example.com"), "fails"),
 ("4.2 TCP loopback 127.0.0.1:50568 is NOT probed (Blatifa Chrome CDP; covered by the per-port rule proven above)", None, None, None, "skipped on purpose"),
 ("4.3 inheritance: child process of the sandboxed Python, TCP 1.1.1.1:443", "in", profile, ("spawn", "1.1.1.1", 443), "child EPERM"),
 ("4.3 inheritance: child process, loopback echo port A", "in", profile, ("spawn", "127.0.0.1", A), "child CONNECTED+pong"),
]
started = datetime.now(UTC).isoformat(timespec="seconds")
results = []
for name, where, prof, args, expect in cases:
    r = None if where is None else (sandboxed(prof, *args) if where == "in" else outside(*args))
    results.append({"case": name, "where": where, "args": args, "expect": expect, "result": r})
    print(f"{name:95} -> {json.dumps(r)}")
out.write_text(json.dumps({"started": started, "ports": {"A": A, "B": B}, "python": py, "results": results}, indent=1))
