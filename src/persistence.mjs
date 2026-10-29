export class StorageConflictError extends Error {
  constructor() {
    super(
      "As roletas foram alteradas em outra aba. Exporte um backup das alterações atuais e recarregue a página.",
    );
    this.name = "StorageConflictError";
  }
}

// Do not silently overwrite data last changed by a different tab.
export function writeSnapshot(storage, key, expected, next) {
  if (storage.getItem(key) !== expected) throw new StorageConflictError();
  storage.setItem(key, next);
  return next;
}
