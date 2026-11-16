import { Box, Button, Stack, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import type { CameraReadiness, RideStatus } from '../../../backend/shared/types';
import type { RootState } from '../store';

interface Props {
  ride: RideStatus;
  readiness: Record<string, CameraReadiness>;
  onKey: (key: string) => void;
}

export function ControlBar({ ride, readiness, onKey }: Props) {
  const cameras = useSelector((s: RootState) => s.state?.cameras ?? []);
  const blockedCameras = cameras.filter(
    (c) => c.status !== 'failed' && c.status !== 'unavailable' && !readiness[c.id]?.ready,
  );
  const canStart = ride === 'idle' && blockedCameras.length === 0;

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          color="success"
          size="large"
          disabled={!canStart}
          onClick={() => onKey('s')}
        >
          Start Ride (S)
        </Button>
        <Button
          variant="contained"
          color="error"
          size="large"
          disabled={ride !== 'recording'}
          onClick={() => onKey('e')}
        >
          End Ride (E)
        </Button>
      </Stack>
      {ride === 'idle' && blockedCameras.length > 0 && (
        <Box>
          {blockedCameras.map((c) => (
            <Typography key={c.id} variant="caption" color="warning.main" sx={{ display: 'block' }}>
              Camera {c.name} not ready: {readiness[c.id]?.reason ?? 'checking…'}
            </Typography>
          ))}
        </Box>
      )}
    </Stack>
  );
}
