"""Servidor local do Obra 3D.

Uso:  py server.py [porta]      (padrão 8080)  ->  http://localhost:8080
Serve os arquivos desta pasta e guarda os registros em data/state.json
(com cópia de segurança diária em data/backup/).
"""
import datetime
import http.server
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
BACKUP = os.path.join(DATA, "backup")
STATE = os.path.join(DATA, "state.json")
os.makedirs(BACKUP, exist_ok=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def _json(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/state":
            if os.path.exists(STATE):
                with open(STATE, "rb") as f:
                    return self._json(200, f.read())
            return self._json(200, b'{"version":1,"logs":[]}')
        if self.path.startswith("/data/"):
            return self.send_error(403)
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/state":
            return self.send_error(404)
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n)
        try:
            obj = json.loads(raw)
            assert isinstance(obj.get("logs"), list)
        except Exception:
            return self._json(400, b'{"error":"json invalido"}')
        if os.path.exists(STATE):
            day = os.path.join(BACKUP, f"state-{datetime.date.today()}.json")
            if not os.path.exists(day):
                shutil.copy2(STATE, day)
        tmp = STATE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)
        os.replace(tmp, STATE)
        return self._json(200, b'{"ok":true}')

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"Obra 3D rodando em http://localhost:{port}  (Ctrl+C para parar)")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
