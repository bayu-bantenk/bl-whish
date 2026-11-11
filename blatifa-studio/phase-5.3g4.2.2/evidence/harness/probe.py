"""Runs INSIDE the sandbox. One network action; prints one JSON line: outcome, errno, error, elapsed."""
import json, socket, subprocess, sys, time
def run(kind, a, b=None):
    t0 = time.monotonic()
    try:
        if kind in ("tcp", "tcp6"):
            fam = socket.AF_INET6 if kind == "tcp6" else socket.AF_INET
            s = socket.socket(fam, socket.SOCK_STREAM); s.settimeout(4)
            s.connect((a, int(b)))
            if b and a in ("127.0.0.1", "::1"):
                s.sendall(b"ping\n"); data = s.recv(16).decode().strip()
                s.close(); return {"outcome": "CONNECTED", "reply": data}
            s.close(); return {"outcome": "CONNECTED"}
        if kind == "udp":
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(2)
            s.sendto(b"\x00", (a, int(b))); s.close(); return {"outcome": "SENT"}
        if kind == "dns":
            r = socket.getaddrinfo(a, 80, proto=socket.IPPROTO_TCP); return {"outcome": "RESOLVED", "n": len(r)}
        if kind == "unix":      # connect only; nothing is sent
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM); s.settimeout(2); s.connect(a); s.close()
            return {"outcome": "CONNECTED"}
        if kind == "spawn":     # a child process (grandchild of sandbox-exec) does the TCP probe
            out = subprocess.run([sys.executable, __file__, "tcp", a, b], capture_output=True, text=True, timeout=20).stdout
            return {"outcome": "CHILD", "child": json.loads(out)}
    except OSError as e:
        return {"outcome": "ERROR", "errno": e.errno, "error": f"{type(e).__name__}: {e}"}
    finally:
        pass
T0 = time.monotonic(); r = run(*sys.argv[1:4]); r["elapsed_ms"] = round((time.monotonic() - T0) * 1000)
print(json.dumps(r))
