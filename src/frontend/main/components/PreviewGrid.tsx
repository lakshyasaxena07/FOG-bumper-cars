import { Box } from '@mui/material';
import { CameraCard } from './CameraCard';
import type { CameraState, CameraReadiness } from '../../../backend/shared/types';

interface Props {
  cameras: CameraState[];
  ride: string;
  previews: Record<string, string>;
  readiness: Record<string, CameraReadiness>;
}

export function PreviewGrid({ cameras, ride, previews, readiness }: Props) {
  const enabled = cameras.filter((c) => c.status !== 'unavailable' || previews[c.id]);
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      }}
    >
      {enabled.map((c) => (
        <CameraCard
          key={c.id}
          camera={c}
          ride={ride}
          dataUrl={previews[c.id] ?? null}
          readiness={readiness[c.id] ?? null}
        />
      ))}
    </Box>
  );
}
