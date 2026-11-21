"""Developer launcher.

python tools/dev.py                 # build browser scripts, run the backend on 127.0.0.1:8000
python tools/dev.py --test-config   # same, with config/venue.test.yaml (video files)
python tools/dev.py --desktop       # also open the Electron window (needs `npm install`)
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def find_python() -> str:
    venv_py_win = ROOT / ".venv" / "Scripts" / "python.exe"
    venv_py_unix = ROOT / ".venv" / "bin" / "python"
    if venv_py_win.exists():
        return str(venv_py_win)
    if venv_py_unix.exists():
        return str(venv_py_unix)
    return sys.executable


def main(argv: list[str]) -> int:
    env = dict(os.environ)
    if "--test-config" in argv:
        env["BUMPER_CONFIG"] = "config/venue.test.yaml"
    py = find_python()
    env.setdefault("BUMPER_PYTHON", py)
    built = subprocess.run([py, str(ROOT / "tools" / "build_ts.py")], cwd=ROOT)
    if built.returncode != 0:
        return built.returncode
    if "--desktop" in argv:
        # Electron starts (and cleanly stops) the backend itself.
        npm = "npm.cmd" if sys.platform == "win32" else "npm"
        return subprocess.run([npm, "start"], cwd=ROOT, env=env).returncode
    return subprocess.run([py, "-m", "backend.app.main"], cwd=ROOT, env=env).returncode


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
