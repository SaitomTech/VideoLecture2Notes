export function isTauriEnvironment() {
  return '__TAURI_INTERNALS__' in window
}
