import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AppState, Notice } from '../../../backend/shared/types';

const slice = createSlice({
  name: 'app',
  initialState: { state: null as AppState | null, notice: null as Notice | null },
  reducers: {
    setState(s, a: PayloadAction<AppState>) {
      s.state = a.payload;
    },
    setNotice(s, a: PayloadAction<Notice | null>) {
      s.notice = a.payload;
    },
  },
});

export const { setState, setNotice } = slice.actions;
export const store = configureStore({ reducer: slice.reducer });
export type RootState = ReturnType<typeof store.getState>;
