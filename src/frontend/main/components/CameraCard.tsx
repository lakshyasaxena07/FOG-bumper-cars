import { Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { CameraState, CameraStatus } from '../../../backend/shared/types';

const COLORS: Record<CameraStatus, 'default' | 'warning' | 'success' | 'error'> = {
  idle: 'default', connecting: 'warning', recording: 'error', completed: 'success', failed: 'error', unavailable: 'warning',
};

export function CameraCard({ camera }: { camera: CameraState }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">{camera.name}</Typography>
          <Chip size="small" color={COLORS[camera.status]} label={camera.status === 'recording' ? '● REC' : camera.status} />
        </Stack>
        <Typography variant="caption" color="text.secondary">{camera.id}</Typography>
        <Typography sx={{ mt: 1 }}>Frames: {camera.frames}</Typography>
        {camera.file && <Typography variant="body2">File: {camera.file}</Typography>}
        {camera.error && <Typography variant="body2" color="error">{camera.error}</Typography>}
      </CardContent>
    </Card>
  );
}
