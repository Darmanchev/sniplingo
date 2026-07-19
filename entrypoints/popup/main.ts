import './style.css';
import {
  START_SELECTION_MESSAGE,
  type StartSelectionMessage,
} from '@/types/selection';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main>
    <h1>SnipLingo</h1>
    <p>Select visible text on the current page.</p>
    <button id="start-selection" type="button">Select area</button>
    <p id="status" role="status" aria-live="polite"></p>
  </main>
`;

const startButton = document.querySelector<HTMLButtonElement>('#start-selection')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  status.textContent = 'Opening selection…';

  try {
    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (activeTab?.id === undefined) {
      throw new Error('Active tab was not found.');
    }

    const message: StartSelectionMessage = {
      type: START_SELECTION_MESSAGE,
    };

    await browser.tabs.sendMessage(activeTab.id, message);
    window.close();
  } catch (error) {
    console.error('SnipLingo could not start selection:', error);
    status.textContent = 'Selection is unavailable on this page.';
    startButton.disabled = false;
  }
});
