import type { AppState, Notice } from '../../backend/shared/types';

declare global {
  interface Window {
    bumper: {
      getState(): Promise<AppState>;
      pressKey(key: string): Promise<void>;
      onState(cb: (s: AppState) => void): () => void;
      onNotice(cb: (n: Notice) => void): () => void;
    };
  }
}
export {};
