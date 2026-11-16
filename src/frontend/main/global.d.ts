import type { AppState, CameraReadiness, Notice } from '../../backend/shared/types';

export type CameraConfigRaw = { id: string; name: string; source: string | number; enabled: boolean };
export type SessionMeta = {
  sessionId: string;
  status: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  cameras: unknown[];
};

declare global {
  interface Window {
    bumper: {
      getState(): Promise<AppState>;
      pressKey(key: string): Promise<void>;
      onState(cb: (s: AppState) => void): () => void;
      onNotice(cb: (n: Notice) => void): () => void;

      onPreviewFrame(cb: (data: { cameraId: string; dataUrl: string }) => void): () => void;
      onReadiness(cb: (r: Record<string, CameraReadiness>) => void): () => void;
      onDiskStatus(cb: (d: { freeGb: number }) => void): () => void;

      setNotes(notes: string): Promise<void>;

      getCameras(): Promise<CameraConfigRaw[]>;
      saveCameras(cameras: CameraConfigRaw[]): Promise<void>;
      getSettings(): Promise<unknown>;
      saveSettings(s: unknown): Promise<void>;

      listHistory(): Promise<SessionMeta[]>;
      deleteSession(id: string): Promise<void>;
      openSessionFolder(id: string): Promise<void>;
    };
  }
}
export {};
