// Both programmatic navigation and history traversal must await the same
// confirmation. A second attempt while a dialog is open stays blocked.
export function createNavigationBlocker(confirm: () => Promise<boolean>) {
  let confirming = false;
  return async () => {
    if (confirming) return true;
    confirming = true;
    try {
      return !(await confirm());
    } catch {
      return true;
    } finally {
      confirming = false;
    }
  };
}
