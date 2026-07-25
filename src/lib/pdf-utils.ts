import html2pdf from 'html2pdf.js';

export function generatePDF(element: HTMLElement, filename: string) {
  const opt = {
    margin: 0.2,
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
  };

  return html2pdf().set(opt).from(element).save();
}

export function generatePDFOptions(element: HTMLElement, filename: string) {
  const opt = {
    margin: 0.2,
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
  };

  return html2pdf().set(opt).from(element);
}