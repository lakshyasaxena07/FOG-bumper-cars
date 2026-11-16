import { Alert, AppBar, Box, Chip, Container, Snackbar, Stack, Toolbar, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CameraCard } from './components/CameraCard';
import { ControlBar } from './components/ControlBar';
import { setNotice, setState, type RootState } from './store';

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function App() {
  const dispatch = useDispatch();
  const state = useSelector((s: RootState) => s.state);
  const notice = useSelector((s: RootState) => s.notice);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    void window.bumper.getState().then((s) => dispatch(setState(s)));
    const offState = window.bumper.onState((s) => dispatch(setState(s)));
    const offNotice = window.bumper.onNotice((n) => dispatch(setNotice(n)));
    // Keyboard controls: the UI only forwards keys; the Trigger service in the backend decides.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (['s', 'e', 'q'].includes(key)) void window.bumper.pressKey(key);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      offState();
      offNotice();
      window.removeEventListener('keydown', onKey);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!state?.startedAt || state.ride === 'idle') {
      setElapsed(0);
      return;
    }
    const t0 = Date.parse(state.startedAt);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [state?.startedAt, state?.ride]);

  if (!state) return <Typography sx={{ p: 4 }}>Starting...</Typography>;

  return (
    <>
      <AppBar position="static" color="default">
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Bumper Car Moments - {state.venue}</Typography>
          <Chip color={state.ride === 'recording' ? 'error' : 'default'} label={state.ride.toUpperCase()} />
          {state.ride !== 'idle' && <Typography>{fmt(elapsed)}</Typography>}
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 3 }}>
        <Stack spacing={3}>
          <ControlBar ride={state.ride} onKey={(k) => void window.bumper.pressKey(k)} />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {state.cameras.map((c) => <CameraCard key={c.id} camera={c} />)}
          </Box>
          {state.lastSession && (
            <Typography color="text.secondary">
              Last ride: {state.lastSession.id} - {state.lastSession.status} (saved in storage/sessions)
            </Typography>
          )}
        </Stack>
      </Container>
      <Snackbar open={!!notice} autoHideDuration={4000} onClose={() => dispatch(setNotice(null))}>
        {notice ? <Alert severity={notice.level} variant="filled">{notice.text}</Alert> : undefined}
      </Snackbar>
    </>
  );
}
