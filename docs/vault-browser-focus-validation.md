# Browser focus and vault locking

Chrome password-save prompts, download controls and the address bar can blur the window while the document remains visible. Previously this destroyed the Worker and cleared recovery material before users could download or verify it; the UI looked like it had refreshed.

Window blur alone no longer locks the vault. Actual document hiding, page leave, idle timeout, manual lock and authentication invalidation retain their existing cleanup. Switching applications while the document remains visible is no longer a lock guarantee; users can explicitly lock before leaving a visible screen. Browser password-manager settings are unchanged.

Validation:
- Production build passed (TypeScript and Vite).
- Chromium production-page suite passed, including visible-document blur before recovery download and after verification, download/verification/publish, hidden-document locking, CRUD, stale responses and idle timers.
- Chromium fixed crypto vectors, real Worker/session integration and prototype suite passed.
- Native acceptance scripts now check document visibility rather than assuming blur means hidden. Native password-save popup interaction was not automated in this run; the regression test dispatches its window-blur event.
