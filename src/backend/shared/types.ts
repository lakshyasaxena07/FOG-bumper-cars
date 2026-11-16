export type CameraStatus = 'idle' | 'connecting' | 'recording' | 'completed' | 'failed' | 'unavailable';
export type RideStatus = 'idle' | 'starting' | 'recording' | 'stopping';

export interface CameraState {
  id: string;
  name: string;
  status: CameraStatus;
  frames: number;
  file: string | null; // relative to the session folder
  error: string | null;
}

export interface AppState {
  venue: string;
  ride: RideStatus;
  sessionId: string | null;
  startedAt: string | null;
  cameras: CameraState[];
  lastSession: { id: string; status: string } | null;
}

export interface Notice {
  level: 'info' | 'warning' | 'error';
  text: string;
}
