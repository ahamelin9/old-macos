// The visitor's own desktop picture: checking the file, shrinking it, and
// keeping it in IndexedDB (localStorage holds a few MB of text at most). It
// never leaves the browser.

/** Larger files are turned away before they're read */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** The saved picture's longer side, at most */
export const MAX_SIDE = 2560;
export const JPEG_QUALITY = 0.85;

/** Why a file can't be used, or null when it can */
export const pictureProblem = (file: { type: string; size: number }): string | null => {
  if (!file.type.startsWith('image/')) return "That file isn't a picture. Choose a JPEG, PNG, GIF or WebP.";
  if (file.size > MAX_FILE_BYTES) return `That picture is ${Math.round(file.size / 1024 / 1024)} MB. Choose one under 25 MB.`;
  return null;
};

/** The size to draw a picture at so its longer side is at most `max`, keeping its shape; never enlarged */
export const fitWithin = (width: number, height: number, max = MAX_SIDE) => {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

/** Decode a picture file, shrink it with a canvas and return it as a JPEG */
export const shrinkPicture = async (file: Blob): Promise<Blob> => {
  const url = URL.createObjectURL(file);
  try {
    // An <img> decodes everything the browser can show (SVG too) and turns
    // a phone photo the right way up from its EXIF orientation
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('no size');
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    // JPEG has no see-through parts: fill them with the desktop's colour
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-desktop').trim();
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('no blob');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
};

// ---- IndexedDB: one database, one store, one record
const DB_NAME = 'macos-1999';
const STORE = 'desktop';
const RECORD = 'picture';

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    // indexedDB itself can be missing, or throw, in a private window
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB is blocked'));
  });

/** Run one request against the store, then close the database */
const withStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? request.error);
      tx.onabort = () => reject(tx.error ?? new Error('aborted'));
    });
  } finally {
    db.close();
  }
};

/** The saved picture, or null. Throws when IndexedDB can't be used here. */
export const loadPicture = async (): Promise<Blob | null> => {
  const value = await withStore<unknown>('readonly', store => store.get(RECORD));
  return value instanceof Blob ? value : null;
};

/** Throws when IndexedDB can't be used here (the picture then lasts only this visit) */
export const savePicture = (blob: Blob) => withStore('readwrite', store => store.put(blob, RECORD)).then(() => undefined);

export const deletePicture = () => withStore('readwrite', store => store.delete(RECORD)).then(() => undefined);
