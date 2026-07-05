// Piège le focus Tab/Shift+Tab à l'intérieur d'une liste d'éléments focusables
// (dialog modale : lightbox, menu mobile de filtre).
export function trapTabFocus(focusable: HTMLElement[], e: KeyboardEvent): void {
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
}
