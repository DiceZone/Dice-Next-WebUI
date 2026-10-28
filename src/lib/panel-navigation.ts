/** Shared by controls outside the router component. Do not assign location.hash:
 * native hash entries have no router index and cannot be reliably rolled back
 * after a user cancels an asynchronous unsaved-draft confirmation. */
export function navigatePanel(destination: string) {
  if (!destination.startsWith('/') || destination.startsWith('//')) return;
  window.dispatchEvent(new CustomEvent('panel:navigate', { detail: destination }));
}
