export type AndroidPrintBridge = {
  print?: (content: unknown) => void;
};

export function ensureReceiptHtml(html: string): string {
  const safeHtml = html?.trim();
  if (safeHtml) {
    return safeHtml;
  }
  return '<p>Receipt details are unavailable.</p>';
}

export function printReceipt(html: string): boolean {
  const printableHtml = ensureReceiptHtml(html);
  const printWindow = window.open('', '_blank', 'width=600,height=800');

  if (!printWindow) {
    return false;
  }

  printWindow.document.open();
  printWindow.document.write(`
          <html>
              <head><title>Receipt</title></head>
              <body>${printableHtml}</body>
          </html>
      `);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return true;
}

export function triggerUnifiedPrint(
  receiptData: unknown,
  receiptHtml: string,
  notifyPopupBlocked?: () => void,
): void {
  const androidPrintManager = (window as unknown as { AndroidPrintManager?: AndroidPrintBridge }).AndroidPrintManager;
  const isAndroid = /Android/i.test(navigator.userAgent) && androidPrintManager;
  const printableHtml = ensureReceiptHtml(receiptHtml);

  if (isAndroid) {
    if (typeof androidPrintManager?.print === 'function') {
      androidPrintManager.print(receiptData ?? printableHtml);
      return;
    }
    notifyPopupBlocked?.();
    return;
  }

  const opened = printReceipt(printableHtml);
  if (!opened) {
    notifyPopupBlocked?.();
  }
}
