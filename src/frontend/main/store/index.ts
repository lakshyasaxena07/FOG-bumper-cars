import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AppState, CameraReadiness, Notice } from '../../../backend/shared/types';

export interface NoticeEntry {
  id: number;
  level: string;
  text: string;
  ts: number;
}

let noticeSeq = 0;

const slice = createSlice({
  name: 'app',
  initialState: {
    state: null as AppState | null,
    notice: null as Notice | null,
    previews: {} as Record<string, string>,
    readiness: {} as Record<string, CameraReadiness>,
    diskFreeGb: null as number | null,
    notices: [] as NoticeEntry[],
  },
  reducers: {
    setState(s, a: PayloadAction<AppState>) {
      s.state = a.payload;
    },
    setNotice(s, a: PayloadAction<Notice | null>) {
      s.notice = a.payload;
      if (a.payload) {
        s.notices = [
          ...s.notices.slice(-99),
          { id: ++noticeSeq, level: a.payload.level, text: a.payload.text, ts: Date.now() },
        ];
      }
    },
    setPreviewFrame(s, a: PayloadAction<{ cameraId: string; dataUrl: string }>) {
      s.previews[a.payload.cameraId] = a.payload.dataUrl;
    },
    setReadiness(s, a: PayloadAction<Record<string, CameraReadiness>>) {
      s.readiness = a.payload;
    },
    setDiskFreeGb(s, a: PayloadAction<number>) {
      s.diskFreeGb = a.payload;
    },
    clearNotices(s) {
      s.notices = [];
    },
  },
});

export const { setState, setNotice, setPreviewFrame, setReadiness, setDiskFreeGb, clearNotices } =
  slice.actions;
export const store = configureStore({ reducer: slice.reducer });
export type RootState = ReturnType<typeof store.getState>;
