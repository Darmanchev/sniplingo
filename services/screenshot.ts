export async function captureVisibleTab(windowId: number): Promise<string> {
  return browser.tabs.captureVisibleTab(windowId, { format: 'png' });
}
