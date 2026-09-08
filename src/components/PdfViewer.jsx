import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Ensure the worker is set up
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export function PdfViewer({ file }) {
  const [numPages, setNumPages] = useState(null);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingBottom: '4rem' }}>
      <Document 
        file={file} 
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div style={{ padding: '2rem' }}>Loading PDF...</div>}
      >
        {Array.from(new Array(numPages), (el, index) => (
          <div key={`page_${index + 1}`} style={{ marginBottom: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <Page 
              pageNumber={index + 1} 
              renderTextLayer={false}
              renderAnnotationLayer={false}
              width={window.innerWidth > 800 ? 800 : window.innerWidth - 40}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
