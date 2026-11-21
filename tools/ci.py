"""Local runner for all CI checks.

Runs in order:
1. ruff check .
2. ruff format --check backend tests tools
3. python -m pytest
4. python tools/build_ts.py --check
5. npm run typecheck
6. npm test
"""

from __future__ import annotations

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


def run_checks() -> int:
    py = find_python()
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    checks: list[tuple[str, list[str]]] = [
        ("Ruff Lint", [py, "-m", "ruff", "check", "."]),
        ("Ruff Format", [py, "-m", "ruff", "format", "--check", "backend", "tests", "tools"]),
        ("Pytest Suite", [py, "-m", "pytest"]),
        ("TypeScript Codegen Check", [py, "tools/build_ts.py", "--check"]),
        ("TypeScript Typecheck", [npm, "run", "typecheck"]),
        ("Electron Tests", [npm, "test"]),
    ]
    failed = []
    for name, cmd in checks:
        print(f"\n{'=' * 20} Running: {name} {'=' * 20}")
        print(f"Command: {' '.join(cmd)}")
        res = subprocess.run(cmd, cwd=str(ROOT))
        if res.returncode != 0:
            print(f"FAILED: {name} (exit code {res.returncode})")
            failed.append(name)
        else:
            print(f"PASSED: {name}")

    print("\n" + "=" * 50)
    if failed:
        print(f"CI checks FAILED ({len(failed)} failures): {', '.join(failed)}")
        return 1
    print("All CI checks PASSED cleanly!")
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
