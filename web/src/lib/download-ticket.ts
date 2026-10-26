import { toBlob } from 'html-to-image';

async function waitForQr(ticket: HTMLElement): Promise<void> {
  if (ticket.querySelector('.tx-ticket__qr svg')) return;
  await new Promise<void>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!ticket.querySelector('.tx-ticket__qr svg')) return;
      observer.disconnect();
      window.clearTimeout(timeout);
      resolve();
    });
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error('Ticket QR is not ready.'));
    }, 10000);
    observer.observe(ticket, { childList: true, subtree: true });
  });
}

export async function downloadTicketPng(ticket: HTMLElement, ticketNumber: string): Promise<void> {
  await Promise.all([
    document.fonts.ready,
    waitForQr(ticket),
    ...Array.from(ticket.querySelectorAll('img')).map((image) => image.decode()),
  ]);
  // Capture the complete branded card, with readable text and a sharp QR.
  const blob = await toBlob(ticket, { pixelRatio: 3, backgroundColor: '#ffffff' });
  if (!blob) throw new Error('Ticket image could not be created.');
  const url = URL.createObjectURL(blob);
  const download = document.createElement('a');
  download.href = url;
  download.download = `${ticketNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}.png`;
  document.body.appendChild(download);
  download.click();
  download.remove();
  // Allow the browser to start reading the image before releasing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
