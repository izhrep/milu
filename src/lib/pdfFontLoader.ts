import jsPDF from 'jspdf';
import robotoFontUrl from '@/assets/fonts/Roboto-Variable.ttf';

let fontLoaded = false;
let fontBase64: string | null = null;

/**
 * Loads Roboto font with Cyrillic support and registers it with jsPDF.
 * Font is cached after first load.
 */
export async function loadCyrillicFont(doc: jsPDF): Promise<void> {
  if (!fontBase64) {
    const response = await fetch(robotoFontUrl);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    fontBase64 = btoa(binary);
  }

  doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto');
}
