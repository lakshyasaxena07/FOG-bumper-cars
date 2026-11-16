import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from './backend/constants';
import type { AppState, Notice } from './backend/shared/types';

const subscribe = <T>(channel: string, cb: (data: T) => void) => {
  const handler = (_e: unknown, data: T) => cb(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('bumper', {
  getState: (): Promise<AppState> => ipcRenderer.invoke(IPC.GET_STATE),
  pressKey: (key: string): Promise<void> => ipcRenderer.invoke(IPC.TRIGGER_KEY, key),
  onState: (cb: (s: AppState) => void) => subscribe(IPC.STATE, cb),
  onNotice: (cb: (n: Notice) => void) => subscribe(IPC.NOTICE, cb),
});
