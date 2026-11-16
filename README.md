# Bumper Car Moments

Automated video capture for bumper-car rides: cameras record each ride, AI finds the best moments,
a short highlight reel is cut and uploaded, and the rider scans a QR code to get it.

## Technology stack
Electron + Electron Forge (Vite), TypeScript, React + Material UI, Redux Toolkit, Winston (daily rotation),
FFmpeg (recording), Vitest. Planned: Realm DB / MongoDB (sync), SerialPort/TCP (PCB).

## Planned workflow
Trigger (PCB / keyboard) -> Recorder -> Moment Detection (AI) -> Reel Generator -> Cloud Upload -> QR Code

## Phase 1 (implemented)
Keyboard Trigger -> Trigger Service -> Recorder Service -> Camera Recording -> Session Storage.
Not yet built: AI, reels, cloud upload, QR codes, PCB communication, Realm/MongoDB sync.

## Architecture
Backend nodes talk only through an event bus (`src/backend/shared/events.ts`):

| Event | Published by | Meaning |
|---|---|---|
| `ride.start` / `ride.end` | Trigger | request to start / end a ride |
| `ride.started` / `ride.finished` | Recorder | ride began / ended (with final status) |
| `state.changed` / `app.notice` | Recorder, Trigger | feed for the UI |

The Recorder never knows where a start/end event came from; a future PCB trigger publishes the same two events.
The React UI talks to the backend over IPC (`src/preload.ts`, `src/backend/constants.ts`).

- **Trigger** (`triggers/keyboardTrigger.ts`): `S` start (only when idle), `E` end (ignored when idle),
  `Q` stop any ride and quit. Repeated presses within `trigger.debounce_seconds` are ignored.
  Keys work in the app window or via the on-screen buttons.
- **Recorder** (`managers/`): one FFmpeg process per enabled camera, started in parallel, each writing its own
  file. One camera failing never stops another. Fragmented MP4 stays playable after a crash. Empty files are deleted.
  Session status: `completed`, `partial` or `failed`. RTSP credentials are masked.

## Codebase structure
```
src/
  main.ts                    Electron main process (single instance, safe shutdown)
  preload.ts                 IPC bridge
  backend/
    index.ts                 wiring + IPC handlers
    constants.ts             IPC channel names
    managers/                camera.ts, recorderManager.ts
    services/                config.ts, logger.ts, devices.ts
    shared/                  events.ts, types.ts
    triggers/                keyboardTrigger.ts   (pcbTrigger.ts later)
  desktop/windowManager.ts
  frontend/main/             App.tsx, main.tsx, components/, store/, theme/
config/                      venue.yaml, venue.test.yaml
test/recorder.test.ts        automated tests
tools/                       list-cameras.mjs, make-test-videos.mjs
storage/sessions/            output, one folder per ride
logs/                        daily log files
```

## Setup (Windows)
1. Install Node.js 20+ and FFmpeg (`winget install Gyan.FFmpeg`, or unzip it and set `recording.ffmpeg_path`
   in `config/venue.yaml`, or the `FFMPEG_PATH` environment variable).
2. `npm install`

## Camera configuration (`config/venue.yaml`)
Each camera: `id` (unique, used as file name), `name`, `source` (webcam index or name, RTSP URL, or video file), `enabled`.
Add a camera by adding a block; no code change. `recording:` holds width, height, fps, format, codec,
`ride_duration_seconds` (null = manual end), `max_duration_seconds` and timeouts. `npm run cameras` lists webcam names.

## Run
```
npm start               real cameras (config/venue.yaml)
npm run videos          once: create sample videos (needs ffmpeg)
npm run start:test      test videos, no hardware (Windows)
```
PowerShell: set FFMPEG_PATH with `$env:FFMPEG_PATH="C:\ffmpeg\bin\ffmpeg.exe"`; CMD: `set FFMPEG_PATH=...`.

## Test
```
npm run typecheck
npm test
```
Manual checklist (`npm run start:test`): S then E creates a folder with 2 mp4 files and session.json; a second ride
creates a second folder; S twice is ignored; E while idle is ignored; unplugging a camera mid-ride marks it failed
while the other keeps recording; Q during a ride finalizes it and leaves no ffmpeg in Task Manager.

## Output
```
storage/sessions/ride_<YYYYMMDD_HHMMSS>_<id>/
  camera_1.mp4  camera_2.mp4  session.json
```
When packaged, `storage/` and `logs/` live in the user data directory.

## Limitations / roadmap
- Webcam capture uses DirectShow (Windows) / v4l2 (Linux, untested); `start:test` script is Windows-only.
- Packaging (`npm run make`) still needs `config/` as an extra resource and an FFmpeg build bundled.
- FFmpeg build licensing (GPL/LGPL) must be reviewed before shipping commercially.
- Next phases: AI moment detection, reels, cloud upload + Realm/MongoDB sync, QR, PCB trigger (SerialPort/TCP).
