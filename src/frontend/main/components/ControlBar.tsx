import { Button, Stack } from '@mui/material';
import type { RideStatus } from '../../../backend/shared/types';

export function ControlBar({ ride, onKey }: { ride: RideStatus; onKey: (key: string) => void }) {
  return (
    <Stack direction="row" spacing={2}>
      <Button variant="contained" color="success" size="large" disabled={ride !== 'idle'} onClick={() => onKey('s')}>
        Start ride (S)
      </Button>
      <Button variant="contained" color="error" size="large" disabled={ride !== 'recording'} onClick={() => onKey('e')}>
        End ride (E)
      </Button>
      <Button variant="outlined" size="large" onClick={() => onKey('q')}>
        Quit (Q)
      </Button>
    </Stack>
  );
}
