import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { CameraReadiness, CameraState, CameraStatus } from '../../../backend/shared/types';

const COLORS: Record<CameraStatus, 'default' | 'warning' | 'success' | 'error'> = {
  idle: 'default',
  connecting: 'warning',
  recording: 'error',
  completed: 'success',
  failed: 'error',
  unavailable: 'warning',
};

interface Props {
  camera: CameraState;
  ride?: string;
  dataUrl?: string | null;
  readiness?: CameraReadiness | null;
}

export function CameraCard({ camera, ride, dataUrl, readiness }: Props) {
  const isIdle = !ride || ride === 'idle';
  const readyColor = readiness?.ready ? 'success.main' : 'error.main';

  return (
    <Card variant="outlined" sx={{ position: 'relative' }}>
      {/* Preview thumbnail */}
      <Box sx={{ position: 'relative', bgcolor: 'grey.900', height: 180, overflow: 'hidden' }}>
        {dataUrl ? (
          <Box
            component="img"
            src={dataUrl}
            alt={camera.name}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {camera.name}
            </Typography>
          </Box>
        )}
        {/* Readiness dot overlay (only when idle) */}
        {isIdle && readiness && (
          <Box
            sx={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: readyColor,
              boxShadow: 1,
            }}
          />
        )}
      </Box>
      <CardContent sx={{ py: 1 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2">{camera.name}</Typography>
          <Chip
            size="small"
            color={COLORS[camera.status]}
            label={camera.status === 'recording' ? '● REC' : camera.status}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {camera.id}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Frames: {camera.frames}
        </Typography>
        {(camera.status === 'failed' || camera.status === 'unavailable') && camera.error && (
          <Typography variant="body2" color="error">
            {camera.error}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
