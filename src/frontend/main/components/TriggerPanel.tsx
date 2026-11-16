import { Box, Chip, Typography } from '@mui/material';
import type { TriggerState } from '../../../backend/shared/types';

interface Props {
  trigger: TriggerState | null;
}

const SOURCE_LABEL: Record<string, string> = {
  keyboard: 'Keyboard',
  pcb: 'PCB Stub',
  button: 'Button',
};

export function TriggerPanel({ trigger }: Props) {
  return (
    <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="subtitle2" gutterBottom>
        Trigger
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="body2">
          Source:{' '}
          <strong>{trigger ? SOURCE_LABEL[trigger.source] ?? trigger.source : '—'}</strong>
        </Typography>
        {trigger?.lastKey && (
          <Typography variant="body2">
            Last key: <code>{trigger.lastKey}</code>
          </Typography>
        )}
        {trigger?.lastAccepted != null && (
          <Chip
            size="small"
            label={trigger.lastAccepted ? 'Accepted' : 'Rejected'}
            color={trigger.lastAccepted ? 'success' : 'error'}
          />
        )}
        {trigger?.lastReason && (
          <Typography variant="body2" color="text.secondary">
            {trigger.lastReason}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
