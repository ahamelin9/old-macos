// Finder's Back and Forward: the folders opened in this window, in order.
// Pure, so the tests can walk it (finderHistory.test.ts).

export interface History {
  /** Folder ids, oldest first */
  stack: string[];
  /** Which one is showing */
  at: number;
}

export const startHistory = (folderId: string): History => ({ stack: [folderId], at: 0 });

export const current = (h: History) => h.stack[h.at];
export const canGoBack = (h: History) => h.at > 0;
export const canGoForward = (h: History) => h.at < h.stack.length - 1;

/** Open a folder: it drops anything Forward would have gone to. The folder already showing changes nothing. */
export const visit = (h: History, folderId: string): History =>
  current(h) === folderId ? h : { stack: [...h.stack.slice(0, h.at + 1), folderId], at: h.at + 1 };

export const back = (h: History): History => (canGoBack(h) ? { ...h, at: h.at - 1 } : h);
export const forward = (h: History): History => (canGoForward(h) ? { ...h, at: h.at + 1 } : h);
