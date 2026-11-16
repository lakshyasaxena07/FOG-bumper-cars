export const IPC = {
  GET_STATE: 'app:get-state',
  TRIGGER_KEY: 'trigger:key',
  STATE: 'app:state',
  NOTICE: 'app:notice',
  PREVIEW_FRAME: 'preview:frame',         // backend→UI push: { cameraId, dataUrl }
  READINESS: 'camera:readiness',          // backend→UI push: Record<string, CameraReadiness>
  SESSION_NOTES: 'session:notes',         // UI→backend invoke: (notes: string) => void
  DISK_STATUS: 'disk:status',             // backend→UI push: { freeGb: number }
  CONFIG_CAMERAS_GET: 'config:cameras:get',   // UI→backend invoke: () => CameraConfigRaw[]
  CONFIG_CAMERAS_SAVE: 'config:cameras:save', // UI→backend invoke: (cameras) => void
  CONFIG_SETTINGS_GET: 'config:settings:get', // UI→backend invoke: () => RecordingConfig & trigger
  CONFIG_SETTINGS_SAVE: 'config:settings:save', // UI→backend invoke: (settings) => void
  HISTORY_LIST: 'history:list',           // UI→backend invoke: () => SessionMeta[]
  HISTORY_DELETE: 'history:delete',       // UI→backend invoke: (sessionId: string) => void
  HISTORY_OPEN_FOLDER: 'history:open-folder', // UI→backend invoke: (sessionId: string) => void
} as const;
