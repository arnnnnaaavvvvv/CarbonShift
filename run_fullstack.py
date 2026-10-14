#!/usr/bin/env python3
"""CarbonShift Unified Full-Stack Runner.

Launches both the Python FastAPI engine and serves the optimized
React SPA dashboard from a single process on http://127.0.0.1:8000.

Usage:
    python run_fullstack.py
    python run_fullstack.py --port 8000 --host 0.0.0.0 --dev
"""

import os
import sys
import argparse
import subprocess
import webbrowser
import time
import threading

# Force UTF-8 encoding on Windows to prevent charmap UnicodeEncodeErrors
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def banner(host: str, port: int, dev_mode: bool):
    print("\n" + "=" * 70)
    print("  [*] CARBONSHIFT: AUTONOMOUS CARBON-AWARE CLOUD SCHEDULER")
    print("      Unified Full-Stack Enterprise Platform (v1.0.0)")
    print("=" * 70)
    print(f"  - Frontend Dashboard:     http://{host}:{port}/")
    print(f"  - Interactive OpenAPI:    http://{host}:{port}/docs")
    print(f"  - Prometheus Metrics:     http://{host}:{port}/metrics")
    print(f"  - WebSocket Live Stream:  ws://{host}:{port}/ws/telemetry")
    print(f"  - Healthcheck Probe:      http://{host}:{port}/health")
    if dev_mode:
        print(f"  - Vite HMR Dev Server:    http://localhost:3000/ (Proxied to :{port})")
    print("=" * 70)
    print("  Press CTRL+C to gracefully stop the full-stack server.\n")

def check_and_build_frontend():
    dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "dist")
    if not os.path.exists(dist_dir) or not os.path.exists(os.path.join(dist_dir, "index.html")):
        print("[*] web/dist not found. Building React production bundle with Vite...")
        web_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
        subprocess.run(["npm", "run", "build"], cwd=web_dir, check=True, shell=True)
        print("[+] Frontend successfully built into web/dist/\n")

def main():
    parser = argparse.ArgumentParser(description="CarbonShift Full-Stack Application Launcher")
    parser.add_argument("--host", default="127.0.0.1", help="Binding host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port to run on (default: 8000)")
    parser.add_argument("--dev", action="store_true", help="Launch Vite dev server concurrently")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically launch web browser")
    args = parser.parse_args()

    check_and_build_frontend()
    banner(args.host, args.port, args.dev)

    vite_proc = None
    if args.dev:
        web_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
        print("[*] Starting Vite HMR dev server on http://localhost:3000...")
        vite_proc = subprocess.Popen(["npm", "run", "dev"], cwd=web_dir, shell=True)

    if not args.no_browser:
        def open_browser():
            time.sleep(1.2)
            url = "http://localhost:3000/" if args.dev else f"http://{args.host}:{args.port}/"
            print(f"[+] Opening {url} in default browser...")
            webbrowser.open(url)
        threading.Thread(target=open_browser, daemon=True).start()

    try:
        import uvicorn
        uvicorn.run("carbonshift.api.app:app", host=args.host, port=args.port, log_level="info")
    finally:
        if vite_proc:
            print("\n[-] Stopping Vite dev server...")
            try:
                vite_proc.terminate()
            except Exception:
                pass

if __name__ == "__main__":
    main()
