const THEME_STORAGE_KEY = 'slicr.theme';

export function applyStoredTheme(
  documentRoot: Document,
  storage: Pick<Storage, 'getItem'>,
  storageKey = THEME_STORAGE_KEY
) {
  try {
    const savedTheme = storage.getItem(storageKey);
    documentRoot.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';
  } catch {
    documentRoot.documentElement.dataset.theme = 'dark';
  }
}

export function bootstrapTheme() {
  applyStoredTheme(document, localStorage);
}
