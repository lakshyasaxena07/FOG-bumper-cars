# Bumper Car Moments

Multi-camera ride recorder for bumper-car attractions: an operator presses a key (or a hardware button) to start and stop recording, the system captures every camera simultaneously, and future phases will auto-detect highlight moments, cut a reel, upload it, and hand the rider a QR code.

---

## Planned full workflow

```
Trigger (PCB button / keyboard / UI)
  → Recorder Service   (FFmpeg, one process per camera)
    → AI Moment Detection  [Phase 2]
      → Reel Generator       [Phase 3]
        → Cloud Upload         [Phase 4]
          → QR Code Dispenser    [Phase 5]
```

---

## Phase 1 scope

### ✅ Built in Phase 1

| Component | Details |
|---|---|
| Keyboard trigger | `S` = start, `E` = end, `Q` = stop + quit. Debounce configurable. |
| PCB trigger stub | `PcbTrigger` class skeleton — wired in Phase 2 |
| Preview manager | Persistent FFmpeg JPEG pipe per camera (~2 FPS, 320×180). Auto-reconnect. Pauses during recording to avoid duplicate connections. |
| Recorder service | One FFmpeg process per enabled camera, in parallel. Readiness guard. Auto-stop timer + hard cap. Writes `session.json` atomically. |
| Ride state machine | `IDLE → STARTING → RECORDING → STOPPING → IDLE`. Queue prevents overlap. |
| Startup service | Crash recovery (marks interrupted sessions) + disk-space check |
| Operator UI | Status banner, readiness panel, preview grid, trigger panel, event log, Camera Manager tab, Settings tab, Ride History tab |

### ❌ Not built yet

- AI moment detection
- Reel generator / video editing
- Cloud upload
- QR code printing / dispensing
- PCB serial/GPIO communication (Realm / MongoDB sync)

---

## Technology stack

| Package | Version | Role |
|---|---|---|
| `electron` | 45.3.2 | Desktop shell |
| `electron-forge` / Vite plugins | ^8.0.1 | Build + packaging |
| `typescript` | ^6.0.3 | Language |
| `react` / `react-dom` | ^19.3.1 | UI framework |
| `@mui/material` | ^9.5.0 | Component library (MUI v9) |
| `@emotion/react` / `styled` | ^11 | MUI styling engine |
| `@reduxjs/toolkit` / `react-redux` | ^2.14 / ^9.3 | State management |
| `winston` / `winston-daily-rotate-file` | ^3.19 / ^5.0 | Structured logging |
| `yaml` | ^2.9.1 | venue.yaml parsing |
| `ffmpeg-static` | ^5.3.0 | Bundled FFmpeg fallback |
| `vitest` | ^5.1.0 | Unit tests |
| `oxlint` / `oxfmt` | ^1.93 / ^0.41 | Linting / formatting |

---

## Architecture

### Process layout

```
Electron main process
├── src/main.ts              — bootstrap, single-instance lock, safe shutdown
├── src/desktop/windowManager.ts
├── src/preload.ts           — contextBridge IPC surface
└── src/backend/index.ts     — wires all services, registers IPC handlers
      ├── KeyboardTrigger    — global key listener
      ├── PcbTrigger (stub)  — Phase 2 placeholder
      ├── PreviewManager     — JPEG pipe per camera
      ├── RecorderManager    — ride state machine + FFmpeg
      └── StartupService     — crash recovery, disk check

Electron renderer process
└── src/frontend/main/       — React + MUI + Redux
```

### EventBus (`src/backend/shared/events.ts`)

Internal pub/sub bus. Services communicate **only** through events — the recorder never knows whether a trigger came from a key, the PCB, or a UI button.

| Event | Published by | Payload | Meaning |
|---|---|---|---|
| `ride.start` | Trigger (keyboard / PCB / UI) | `{ source }` | Request to begin a ride |
| `ride.end` | Trigger (keyboard / PCB / UI) | `{ source }` | Request to end a ride |
| `ride.started` | RecorderManager | `{ sessionId, startedAt }` | Ride is now recording |
| `ride.finished` | RecorderManager | `{ sessionId, status, cameras }` | Ride saved |
| `state.changed` | RecorderManager, Trigger | `AppState` | Full state snapshot for UI |
| `app.notice` | Any service | `Notice` | Toast / log message for UI |

### IPC channels (`src/backend/constants.ts`)

All UI ↔ backend communication crosses the `preload.ts` bridge.

| Channel | Direction | Signature | Description |
|---|---|---|---|
| `app:get-state` | UI → backend (invoke) | `() → AppState` | Pull full state on load |
| `trigger:key` | UI → backend (invoke) | `(key: string) → void` | On-screen button presses |
| `app:state` | backend → UI (push) | `AppState` | State changed |
| `app:notice` | backend → UI (push) | `Notice` | Toast / log entry |
| `preview:frame` | backend → UI (push) | `{ cameraId, dataUrl }` | JPEG thumbnail update |
| `camera:readiness` | backend → UI (push) | `Record<string, CameraReadiness>` | Per-camera readiness |
| `disk:status` | backend → UI (push) | `{ freeGb: number }` | Disk space update |
| `session:notes` | UI → backend (invoke) | `(notes: string) → void` | Save per-ride notes |
| `config:cameras:get` | UI → backend (invoke) | `() → CameraConfigRaw[]` | Load camera list |
| `config:cameras:save` | UI → backend (invoke) | `(cameras) → void` | Persist camera edits |
| `config:settings:get` | UI → backend (invoke) | `() → RecordingConfig & trigger` | Load settings |
| `config:settings:save` | UI → backend (invoke) | `(settings) → void` | Persist settings |
| `history:list` | UI → backend (invoke) | `() → SessionMeta[]` | Fetch session history |
| `history:delete` | UI → backend (invoke) | `(sessionId: string) → void` | Delete a session folder |
| `history:open-folder` | UI → backend (invoke) | `(sessionId: string) → void` | Open session in Explorer |

---

## Operator UI guide

The app opens to the **Main Console** tab. Two additional tabs are available in the top navigation bar.

### Main Console

| Panel | Description |
|---|---|
| **Status banner** | Current ride state: `IDLE` / `READY` / `RECORDING` / `SAVING`. Shows a countdown when `ride_duration_seconds` is set. |
| **Readiness panel** | Per-camera readiness indicator (green = fresh frame within 2 s, red = no signal). The Start button is disabled while any camera is not ready. |
| **Start / End buttons** | On-screen equivalents of the `S` and `E` keys. |
| **Live preview grid** | JPEG thumbnail from each camera (~2 FPS). Freezes to last frame while recording. |
| **Trigger panel** | Shows last trigger source (keyboard / PCB / button), last key, accepted/rejected, and reason. |
| **Notes field** | Per-ride free-text note saved into `session.json`. |
| **Event log** | Scrolling list of `app.notice` messages (info / warning / error). |

### Camera Manager tab

Add, edit, or delete cameras. Fields map directly to `venue.yaml` camera entries. Click **Save** to write `venue.yaml` and reload camera configuration live.

### Settings tab

Edit `recording.*` and `trigger.*` fields (resolution, FPS, durations, FFmpeg path, debounce). Click **Save** to persist.

### Ride History tab

Table of past sessions (session ID, start time, status, duration, cameras). Actions:

- **Open Folder** — opens the session directory in Windows Explorer
- **View JSON** — shows raw `session.json`
- **Delete** — removes the session folder after confirmation

---

## `venue.yaml` reference

Located at `config/venue.yaml` (override with the `BUMPER_CONFIG` env-var).

### `venue`

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | string | `"Demo Venue"` | Venue display name shown in the UI title |

### `recording`

| Field | Type | Default | Description |
|---|---|---|---|
| `ffmpeg_path` | string | `"ffmpeg"` | Path to FFmpeg binary; `ffmpeg` resolves from PATH or uses `ffmpeg-static` fallback |
| `width` | number | `1280` | Output video width (pixels) |
| `height` | number | `720` | Output video height (pixels) |
| `fps` | number | `25` | Output frames per second |
| `format` | string | `"mp4"` | FFmpeg output format (`mp4`, `mkv`, …) |
| `video_codec` | string | `"libx264"` | FFmpeg `-vcodec` |
| `encoder_args` | string[] | `["-preset","veryfast","-crf","23"]` | Extra FFmpeg encoder flags appended after `-vcodec` |
| `ride_duration_seconds` | number \| null | `null` | Auto-end after N seconds. **`null` = manual-only** (operator must press E) |
| `max_duration_seconds` | number | `600` | Hard safety cap — ride force-stops after this many seconds regardless |
| `open_timeout_seconds` | number | `10` | Seconds to wait for FFmpeg to open a camera source before failing |
| `disconnect_timeout_seconds` | number | `5` | Seconds of silence before a camera is considered disconnected mid-ride |

### `trigger`

| Field | Type | Default | Description |
|---|---|---|---|
| `debounce_seconds` | number | `0.5` | Minimum interval between accepted trigger events |

### `storage`

| Field | Type | Default | Description |
|---|---|---|---|
| `sessions_dir` | string | `"storage/sessions"` | Root directory for session folders (relative to app root or absolute) |
| `disk_warn_gb` | number | `5` | Warn in UI when free disk space drops below this threshold (GB) |

### `cameras[]`

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | string | — | Unique identifier; used as the base filename (`camera_1.mp4`) |
| `name` | string | — | Human-readable label shown in the UI |
| `source` | string \| number | — | DirectShow device index (`0`), device name, RTSP URL, or video file path (dev testing) |
| `enabled` | boolean | `true` | Disabled cameras are skipped entirely |
| `input_args` | string[] | `[]` | Optional extra FFmpeg input flags (e.g. `-rtsp_transport tcp`) |

---

## Directory tree

```
FOG-bumper-cars/
├── config/
│   ├── venue.yaml               # live operator configuration
│   └── venue.test.yaml          # test-mode config (uses video files, no hardware)
├── src/
│   ├── main.ts                  # Electron main: bootstrap, single-instance, shutdown
│   ├── preload.ts               # contextBridge IPC surface
│   ├── declarations.d.ts        # global type declarations
│   ├── backend/
│   │   ├── index.ts             # service wiring + IPC handlers
│   │   ├── constants.ts         # IPC channel name constants
│   │   ├── managers/
│   │   │   ├── camera.ts        # single-camera FFmpeg wrapper
│   │   │   └── recorderManager.ts  # ride state machine, coordinates cameras
│   │   ├── services/
│   │   │   ├── config.ts        # venue.yaml loader + validator
│   │   │   ├── devices.ts       # DirectShow device enumeration
│   │   │   ├── logger.ts        # Winston logger factory
│   │   │   ├── preview.ts       # persistent JPEG preview pipe per camera
│   │   │   └── startup.ts       # crash recovery + disk check
│   │   ├── shared/
│   │   │   ├── events.ts        # EventBus class + EVENTS constants
│   │   │   └── types.ts         # shared TypeScript interfaces
│   │   └── triggers/
│   │       ├── keyboardTrigger.ts  # global keyboard listener (S / E / Q)
│   │       └── pcbTrigger.ts       # Phase 2 stub — serial/GPIO placeholder
│   ├── desktop/
│   │   └── windowManager.ts     # BrowserWindow setup
│   └── frontend/
│       └── main/
│           ├── App.tsx           # top-level tab router
│           ├── main.tsx          # React root
│           ├── global.d.ts       # renderer-side type declarations
│           ├── components/       # UI panels (StatusBanner, PreviewGrid, …)
│           ├── store/            # Redux slices + selectors
│           └── theme/            # MUI theme
├── storage/
│   └── sessions/                # output: one sub-folder per ride
├── test/
│   ├── recorder.test.ts         # Vitest unit tests
│   └── videos/                  # generated test video files (make-test-videos)
├── tools/
│   ├── list-cameras.mjs         # enumerate DirectShow devices
│   └── make-test-videos.mjs     # generate short .mp4 test files
├── logs/                        # Winston daily-rotate log files
├── index.html                   # Vite HTML entry
├── forge.config.mts             # Electron Forge configuration
├── vite.main.config.mts         # Vite config for main process
├── vite.preload.config.mts      # Vite config for preload
├── vite.renderer.config.mts     # Vite config for renderer
├── tsconfig.json
└── package.json
```

---

## Setup (PowerShell)

### Prerequisites

**Node.js 20+**
```powershell
# Check version
node --version   # must be >= 20
```

**FFmpeg** — choose one:

```powershell
# Option A: install system-wide via winget (recommended)
winget install Gyan.FFmpeg

# Option B: manual install — unzip and set the path in venue.yaml:
#   recording:
#     ffmpeg_path: 'C:\ffmpeg\bin\ffmpeg.exe'

# Option C: ffmpeg-static bundled fallback (included in devDependencies,
#            slower but requires no system FFmpeg)
```

### Install

```powershell
cd "d:\FOG Tech\Projects\FOG-bumper-cars"
npm install
```

### Generate test videos (first run, once)

```powershell
npm run videos
```

---

## Run commands

| Command | Description |
|---|---|
| `npm start` | Launch with real cameras (`config/venue.yaml`) |
| `npm run start:test` | Launch with test videos — no hardware needed (Windows only) |
| `npm run videos` | Generate short `.mp4` test files in `test/videos/` |
| `npm run cameras` | List available DirectShow webcam names |

**Set a custom config file:**
```powershell
$env:BUMPER_CONFIG = "config/venue.test.yaml"
npm start
```

---

## Test commands

```powershell
# Type-check without compiling
npm run typecheck

# Run all Vitest unit tests
npm test
```

Unit tests cover: recorder lifecycle, keyboard trigger debounce, crash recovery, per-ride notes, and auto-stop scenarios.

---

## Storage layout

### Session folder

```
storage/sessions/ride_<YYYYMMDD_HHMMSS>_<hex>/
  camera_1.mp4
  camera_2.mp4
  session.json
```

One folder per ride. Camera files are named after the camera `id` from `venue.yaml`. Empty files (camera failed to open) are deleted.

### `session.json` schema

```jsonc
{
  "session_id": "20261116_143000_a1b2c3",   // unique session ID
  "status": "completed",                  // "completed" | "partial" | "failed" | "interrupted"
  "start_time": "2026-11-16T14:30:00.000Z",
  "end_time":   "2026-11-16T14:32:15.000Z",
  "duration_seconds": 135.0,
  "stop_reason": "trigger",               // "trigger" | "time_limit" | "max_duration" | "shutdown" | "interrupted"
  "notes": "",                            // operator free-text
  "cameras": [
    {
      "id": "camera_1",
      "name": "Arena Front",
      "status": "completed",             // "completed" | "failed" | "unavailable"
      "file": "camera_1.mp4",
      "frames": 3315,
      "error": null
    }
  ]
}
```

> **`status: "interrupted"`** is written by the startup crash-recovery service when it finds a session that was `"recording"` at the time of an unexpected shutdown.

---

## Manual test checklist

> These tests require real webcams or an RTSP stream — hardware behaviour cannot be verified by automated tests.

### With `npm run start:test` (no hardware)

- [ ] Press **S** (or click Start): a `ride_*` folder appears in `storage/sessions/`, two `.mp4` files and `session.json` are created
- [ ] Press **E** (or click End): `session.json` shows `"status": "completed"` and `"stopReason": "trigger"`
- [ ] A second ride creates a second, separate folder
- [ ] Pressing **S** twice in quick succession: the second press is ignored (debounce / queue)
- [ ] Pressing **E** while idle: ignored — no folder created, no error
- [ ] Pressing **Q** during a recording: ride finalises cleanly; no `ffmpeg.exe` remains in Task Manager

### With real webcams (`npm start`)

- [ ] Preview thumbnails appear for each camera before recording
- [ ] Readiness indicators turn green within 2 s of app launch
- [ ] Start button is disabled until all cameras report ready
- [ ] Unplugging a camera mid-ride: that camera's `status` becomes `"failed"`, the other cameras continue; `session.json` overall `status` is `"partial"`
- [ ] After reconnecting the camera and starting a new ride, it records normally
- [ ] `disk:status` warning appears in the event log if disk < `disk_warn_gb`

### With RTSP cameras

- [ ] Add a camera with an `rtsp://` source in `venue.yaml` (or Camera Manager tab)
- [ ] Credentials in the source URL are masked in logs (shown as `rtsp://****@…`)
- [ ] Preview thumbnail updates at ~2 FPS
- [ ] Recording produces a valid `.mp4`

---

## Limitations

| Area | Detail |
|---|---|
| **Windows only** | Webcam capture uses DirectShow (`-f dshow`). Linux (`v4l2`) is untested; macOS (`avfoundation`) is unsupported. |
| **`start:test` script** | Uses `set VAR=value&&` syntax, which works in CMD / npm scripts on Windows. Use `$env:BUMPER_CONFIG=…` in PowerShell directly. |
| **Packaging** | `npm run make` requires `config/` as an extra Forge resource and a bundled FFmpeg binary. This has not been fully configured yet. |
| **FFmpeg licensing** | The FFmpeg build linked by `ffmpeg-static` is GPL. Review GPL/LGPL obligations before shipping commercially. |
| **Real cameras required** | Preview readiness, RTSP reconnect, and camera-failure behaviour cannot be verified without physical hardware. |
| **Single machine** | No multi-machine support; all cameras must be reachable from the operator PC. |

---

## Future phases

| Phase | Feature | Key technology |
|---|---|---|
| **2** | PCB hardware trigger | Node.js `SerialPort` or TCP socket — replace `PcbTrigger` stub |
| **3** | AI moment detection | Frame extraction + ML model inference on session footage |
| **4** | Reel generator | FFmpeg concat / trim based on detected moments |
| **5** | Cloud upload | Realm SDK / MongoDB Atlas sync, presigned S3/GCS URLs |
| **6** | QR code dispensing | QR code generation → thermal printer or on-screen display |
