import { Box, Button, Typography } from '@mui/material';
import { useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clearNotices, type RootState } from '../store';

const ICONS: Record<string, string> = { info: 'ℹ️', warning: '⚠️', error: '❌' };

export function EventLogPanel() {
  const dispatch = useDispatch();
  const notices = useSelector((s: RootState) => s.notices);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notices.length]);

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 0.5 }}>
        <Typography variant="subtitle2">Event Log</Typography>
        <Button size="small" onClick={() => dispatch(clearNotices())}>
          Clear
        </Button>
      </Box>
      <Box sx={{ maxHeight: 180, overflowY: 'auto', px: 1.5, pb: 1 }}>
        {notices.slice(-50).map((n) => (
          <Box key={n.id} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {new Date(n.ts).toLocaleTimeString()}
            </Typography>
            <Typography variant="caption">{ICONS[n.level] ?? '•'}</Typography>
            <Typography variant="caption">{n.text}</Typography>
          </Box>
        ))}
        <div ref={bottomRef} />
      </Box>
    </Box>
  );
}
