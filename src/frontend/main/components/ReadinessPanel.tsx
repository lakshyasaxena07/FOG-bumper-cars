import { Box, Chip, Stack, Typography } from '@mui/material';
import type { CameraReadiness } from '../../../backend/shared/types';

interface Props {
  cameras: Array<{ id: string; name: string }>;
  readiness: Record<string, CameraReadiness>;
}

export function ReadinessPanel({ cameras, readiness }: Props) {
  const notReady = cameras.filter((c) => !readiness[c.id]?.ready);
  const allReady = notReady.length === 0;

  return (
    <Box sx={{ p: 1.5, border: '1px solid', borderColor: allReady ? 'success.main' : 'warning.main', borderRadius: 1 }}>
      <Chip
        label={allReady ? '✅ ALL CAMERAS READY' : `⚠ ${notReady.length} camera(s) not ready`}
        color={allReady ? 'success' : 'warning'}
        sx={{ mb: 1 }}
      />
      <Stack spacing={0.5}>
        {cameras.map((cam) => {
          const r = readiness[cam.id];
          const ready = r?.ready ?? false;
          return (
            <Box key={cam.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" component="span" sx={{ fontSize: '1rem', lineHeight: 1 }}>
                {ready ? '✅' : r ? '❌' : '⏳'}
              </Typography>
              <Typography variant="body2">
                <strong>{cam.name}</strong>
                {r?.reason ? ` — ${r.reason}` : ' — checking…'}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
