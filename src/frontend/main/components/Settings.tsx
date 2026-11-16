import {
  Box,
  Button,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, useEffect } from 'react';

interface SettingsForm {
  width: number;
  height: number;
  fps: number;
  rideDurationSeconds: number | null;
  maxDurationSeconds: number;
  storagePath: string;
  diskWarnGb: number;
  triggerDebounceSeconds: number;
}

function validate(f: SettingsForm): string | null {
  if (f.width <= 0 || f.height <= 0) return 'Resolution must be > 0';
  if (f.fps < 1 || f.fps > 120) return 'FPS must be 1–120';
  if (f.maxDurationSeconds <= 0) return 'Max duration must be > 0';
  if (f.diskWarnGb <= 0) return 'Disk warn GB must be > 0';
  if (f.triggerDebounceSeconds < 0 || f.triggerDebounceSeconds > 10) return 'Debounce must be 0–10';
  return null;
}

const DEFAULT: SettingsForm = {
  width: 1920, height: 1080, fps: 30,
  rideDurationSeconds: null, maxDurationSeconds: 300,
  storagePath: 'storage/sessions', diskWarnGb: 5,
  triggerDebounceSeconds: 0.5,
};

export function Settings() {
  const [form, setForm] = useState<SettingsForm>(DEFAULT);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    void window.bumper.getSettings().then((s: unknown) => {
      if (s && typeof s === 'object') setForm((prev) => ({ ...prev, ...(s as Partial<SettingsForm>) }));
    });
  }, []);

  const set = (patch: Partial<SettingsForm>) => setForm((prev) => ({ ...prev, ...patch }));
  const num = (v: string) => Number(v);

  const save = async () => {
    const err = validate(form);
    if (err) { setError(err); return; }
    setError('');
    await window.bumper.saveSettings(form);
    setToast('Settings saved!');
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 500 }}>
      <Typography variant="h6">Settings</Typography>
      <Stack direction="row" spacing={1}>
        <TextField label="Width" type="number" value={form.width} size="small"
          onChange={(e) => set({ width: num(e.target.value) })} />
        <TextField label="Height" type="number" value={form.height} size="small"
          onChange={(e) => set({ height: num(e.target.value) })} />
      </Stack>
      <TextField label="FPS (1–120)" type="number" value={form.fps} size="small"
        onChange={(e) => set({ fps: num(e.target.value) })} />
      <TextField label="Ride duration seconds (0 = disabled)" type="number"
        value={form.rideDurationSeconds ?? 0} size="small"
        onChange={(e) => { const v = num(e.target.value); set({ rideDurationSeconds: v === 0 ? null : v }); }} />
      <TextField label="Max duration seconds" type="number" value={form.maxDurationSeconds} size="small"
        onChange={(e) => set({ maxDurationSeconds: num(e.target.value) })} />
      <TextField label="Storage path" value={form.storagePath} size="small"
        onChange={(e) => set({ storagePath: e.target.value })} />
      <TextField label="Disk warn GB" type="number" value={form.diskWarnGb} size="small"
        onChange={(e) => set({ diskWarnGb: num(e.target.value) })} />
      <TextField label="Trigger debounce seconds (0–10)" type="number" value={form.triggerDebounceSeconds} size="small"
        onChange={(e) => set({ triggerDebounceSeconds: num(e.target.value) })} />
      {error && <Typography color="error">{error}</Typography>}
      <Box><Button variant="contained" onClick={save}>Save Settings</Button></Box>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </Stack>
  );
}
