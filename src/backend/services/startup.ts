// Startup utilities: crash recovery and disk space check.
import { readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getLogger } from './logger';

const log = getLogger('startup');

/**
 * Scan sessionsDir for ride_* subfolders whose session.json has status === 'recording'
 * and rewrite them as status 'interrupted'. Returns the number of sessions recovered.
 */
export async function recoverInterruptedSessions(sessionsDir: string): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(sessionsDir);
  } catch {
    // sessionsDir may not exist yet on first run — that's fine
    return 0;
  }

  let recovered = 0;
  for (const name of entries) {
    if (!name.startsWith('ride_')) continue;
    const sessionFile = join(sessionsDir, name, 'session.json');
    let meta: Record<string, unknown>;
    try {
      const raw = await readFile(sessionFile, 'utf8');
      meta = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue; // no session.json or corrupt — skip
    }
    if (meta.status !== 'recording') continue;

    const updated = { ...meta, status: 'interrupted', end_time: null, stop_reason: 'interrupted' };
    const tmp = `${sessionFile}.tmp`;
    await writeFile(tmp, JSON.stringify(updated, null, 2));
    await rename(tmp, sessionFile);
    log.warn(`Recovered interrupted session: ${name}`);
    recovered++;
  }
  return recovered;
}

/**
 * Check free disk space on the volume that contains sessionsDir.
 * Uses fs.statfs (Node 18.15+) when available; falls back to 0 on older runtimes.
 */
export async function checkDisk(sessionsDir: string, warnGb: number): Promise<{ freeGb: number; warn: boolean }> {
  // Ensure the directory exists so statfs can resolve it
  try {
    await stat(sessionsDir);
  } catch {
    // Directory may not exist yet — use drive root on Windows or cwd fallback
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fsPromises = await import('node:fs/promises') as any;
  if (typeof fsPromises.statfs !== 'function') {
    log.warn('fs.statfs not available on this Node version — skipping disk check');
    return { freeGb: Infinity, warn: false };
  }

  try {
    const stats = await fsPromises.statfs(sessionsDir);
    // bavail = blocks available to unprivileged user, bsize = block size in bytes
    const freeBytes: number = stats.bavail * stats.bsize;
    const freeGb = freeBytes / (1024 ** 3);
    return { freeGb, warn: freeGb < warnGb };
  } catch (err) {
    log.warn('disk check failed', err);
    return { freeGb: Infinity, warn: false };
  }
}
