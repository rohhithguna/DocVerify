import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use a locally bundled worker to avoid runtime CDN/network failures
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function convertPdfToImageFile(pdfFile: File): Promise<File> {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  // We only extract the first page for QR verification
  const page = await pdf.getPage(1);
  
  const viewport = page.getViewport({ scale: 2.0 }); // higher scale for better QR resolution
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error("Failed to create canvas context");
  }
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };
  
  await page.render(renderContext).promise;
  
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) {
        reject(new Error("Failed to convert canvas to blob"));
        return;
      }
      resolve(b);
    }, 'image/png', 1.0);
  });

  // Return a new File object with a .png extension
  const imageName = pdfFile.name.replace(/\.pdf$/i, '.png');
  return new File([blob], imageName, { type: 'image/png' });
}
