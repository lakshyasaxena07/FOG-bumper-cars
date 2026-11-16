import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState, useEffect, useCallback } from 'react';

type SessionMeta = {
  sessionId: string; status: string; startTime: string;
  endTime: string | null; duration: number | null; cameras: unknown[];
};

const STATUS_COLOR: Record<string, 'default' | 'success' | 'error' | 'warning'> = {
  completed: 'success', interrupted: 'error', recording: 'warning',
};

export function RideHistory() {
  const [rows, setRows] = useState<SessionMeta[]>([]);
  const [viewJson, setViewJson] = useState<SessionMeta | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(() => {
    void window.bumper.listHistory().then(setRows);
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmDelete = async () => {
    if (!delId) return;
    await window.bumper.deleteSession(delId);
    setDelId(null);
    setToast('Session deleted.');
    load();
  };

  const fmtDur = (s: number | null) =>
    s == null ? '—' : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Button variant="outlined" size="small" onClick={load}>🔄 Refresh</Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Session ID</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Start</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Cameras</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.sessionId}>
              <TableCell><Typography variant="caption">{r.sessionId}</Typography></TableCell>
              <TableCell><Chip size="small" label={r.status} color={STATUS_COLOR[r.status] ?? 'default'} /></TableCell>
              <TableCell><Typography variant="caption">{new Date(r.startTime).toLocaleString()}</Typography></TableCell>
              <TableCell>{fmtDur(r.duration)}</TableCell>
              <TableCell>{Array.isArray(r.cameras) ? r.cameras.length : '?'}</TableCell>
              <TableCell>
                <IconButton size="small" title="Open folder" onClick={() => void window.bumper.openSessionFolder(r.sessionId)}>
                  📁
                </IconButton>
                <Button size="small" onClick={() => setViewJson(r)}>JSON</Button>
                <IconButton size="small" color="error" title="Delete" onClick={() => setDelId(r.sessionId)}>
                  🗑️
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={6}><Typography color="text.secondary">No sessions found.</Typography></TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={!!viewJson} onClose={() => setViewJson(null)} maxWidth="md" fullWidth>
        <DialogTitle>Session JSON</DialogTitle>
        <DialogContent>
          <Box component="pre" sx={{ fontSize: 12, overflowX: 'auto' }}>
            {JSON.stringify(viewJson, null, 2)}
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setViewJson(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={!!delId} onClose={() => setDelId(null)}>
        <DialogTitle>Delete session?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDelId(null)}>Cancel</Button>
          <Button color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}
