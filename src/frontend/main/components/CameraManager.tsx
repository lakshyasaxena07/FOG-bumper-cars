import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState, useEffect } from 'react';

type CameraConfigRaw = { id: string; name: string; source: string | number; enabled: boolean };

let uid = 0;

export function CameraManager() {
  const [cameras, setCameras] = useState<CameraConfigRaw[]>([]);
  const [toast, setToast] = useState('');
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  useEffect(() => {
    void window.bumper.getCameras().then(setCameras);
  }, []);

  const update = (i: number, patch: Partial<CameraConfigRaw>) =>
    setCameras((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const addRow = () =>
    setCameras((prev) => [
      ...prev,
      { id: `cam-${++uid}`, name: 'New Camera', source: 0, enabled: true },
    ]);

  const confirmDelete = () => {
    if (deleteIdx != null) setCameras((prev) => prev.filter((_, i) => i !== deleteIdx));
    setDeleteIdx(null);
  };

  const save = async () => {
    await window.bumper.saveCameras(cameras);
    setToast('Saved!');
  };

  return (
    <Box>
      <Alert severity="warning" sx={{ mb: 2 }}>
        Saving will rewrite venue.yaml and may remove comments. Backup first if you've hand-edited the file.
      </Alert>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Button variant="outlined" onClick={addRow}>
          + Add Camera
        </Button>
        <Button variant="contained" onClick={save}>
          Save
        </Button>
        <Button
          variant="outlined"
          onClick={() => setToast('Test connection requires running the app with real cameras.')}
        >
          Test Connection
        </Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Source</TableCell>
            <TableCell>Enabled</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {cameras.map((c, i) => (
            <TableRow key={i}>
              <TableCell>
                <TextField size="small" value={c.id} onChange={(e) => update(i, { id: e.target.value })} />
              </TableCell>
              <TableCell>
                <TextField size="small" value={c.name} onChange={(e) => update(i, { name: e.target.value })} />
              </TableCell>
              <TableCell>
                <TextField size="small" value={String(c.source)} onChange={(e) => update(i, { source: e.target.value })} />
              </TableCell>
              <TableCell>
                <FormControlLabel
                  control={<Checkbox checked={c.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />}
                  label=""
                />
              </TableCell>
              <TableCell>
                <IconButton size="small" onClick={() => setDeleteIdx(i)} title="Delete">
                  🗑️
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={deleteIdx != null} onClose={() => setDeleteIdx(null)}>
        <DialogTitle>Delete camera?</DialogTitle>
        <DialogContent>
          <DialogContentText>This cannot be undone until you save.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteIdx(null)}>Cancel</Button>
          <Button color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast('')}
        message={toast}
      />
    </Box>
  );
}
