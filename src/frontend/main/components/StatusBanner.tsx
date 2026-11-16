import { Box, Chip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { RideStatus } from '../../../backend/shared/types';

interface Props {
  ride: RideStatus;
  sessionId: string | null;
  startedAt: string | null;
  rideEndsAt: number | null;
  lastSession: { id: string; status: string } | null;
}

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const CHIP_PROPS: Record<RideStatus, { label: string; color: 'default' | 'success' | 'error' | 'warning' }> = {
  idle: { label: 'IDLE', color: 'default' },
  starting: { label: 'STARTING', color: 'warning' },
  recording: { label: '● RECORDING', color: 'error' },
  stopping: { label: 'SAVING', color: 'warning' },
};

export function StatusBanner({ ride, sessionId, startedAt, rideEndsAt, lastSession }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt || ride === 'idle') {
      setElapsed(0);
      setRemaining(null);
      return;
    }
    const t0 = Date.parse(startedAt);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - t0) / 1000));
      if (rideEndsAt != null) setRemaining(Math.max(0, Math.floor((rideEndsAt - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(id);
  }, [startedAt, ride, rideEndsAt]);

  const chip = CHIP_PROPS[ride];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Chip
        label={chip.label}
        color={chip.color}
        sx={ride === 'recording' ? { animation: 'pulse 1s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } } } : {}}
      />
      {sessionId && (
        <Typography variant="body2" color="text.secondary">
          Session: <strong>{sessionId}</strong>
        </Typography>
      )}
      {ride !== 'idle' && (
        <Typography variant="body2">Elapsed: {fmt(elapsed)}</Typography>
      )}
      {remaining != null && (
        <Typography variant="body2" color="warning.main">
          Remaining: {fmt(remaining)}
        </Typography>
      )}
      {ride === 'idle' && lastSession && (
        <Typography variant="body2" color="text.secondary">
          Last: {lastSession.id} — {lastSession.status}
        </Typography>
      )}
    </Box>
  );
}
