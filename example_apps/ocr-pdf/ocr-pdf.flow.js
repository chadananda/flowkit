/**
 * ocr-pdf.flow.js - Advanced OCR processing flow for PDF documents
 * 
 * This flow implements a sophisticated OCR pipeline following the plan.md:
 * 1. setup - Create temporary directories
 * 2. splitPDF - Split PDF into individual pages
 * 3. initialContext - Extract context from first 20 pages
 * 4. pageOCR - Process pages with multiple OCR engines in parallel
 * 5. pageReconciliation - Reconcile OCR results
 * 6. addContext - Add semantic context tags
 * 7. pdfaAssembly - Assemble PDF/A with embedded text
 * 8. packageMD - Create markdown version
 * 9. saveOutput - Save to final location
 * 10. cleanup - Remove temporary files
 */
import { Flow, param, ParamType } from '../../../flowlite.js';

// Import the tools we've already implemented
import { setupTool } from './tools/01-setup.tool.js';
import { splitPDFTool } from './tools/02-split-pdf.tool.js';
import { initialContextTool } from './tools/03-initial-context.tool.js';
import { pageOCRTool } from './tools/04-page-ocr.tool.js';
import { pageReconciliationTool } from './tools/05-page-reconciliation.tool.js';
import { addContextTool } from './tools/06-add-context.tool.js';
import { pdfaAssemblyTool } from './tools/07-pdfa-assembly.tool.js';
import { packageMDTool } from './tools/08-package-md.tool.js';
import { saveOutputTool } from './tools/09-save-output.tool.js';
import { cleanupTool } from './tools/10-cleanup.tool.js';

// Main OCR PDF flow
export const ocrPDFFlow = Flow.create({
  name: 'ocrPDF',
  description: 'Process a PDF with multiple OCR engines and Claude context extraction',
  input: [
    param('inputPath', ParamType.STRING, 'Path to input PDF'),
    param('outputPath', ParamType.STRING, 'Path to output PDF'),
    param('keepTemp', ParamType.BOOLEAN, 'Whether to keep temporary files', true)
  ]
})
.next(setupTool)
.next(splitPDFTool)
.next(initialContextTool)
.next(pageOCRTool)
.next(pageReconciliationTool)
.next(addContextTool)
.next(pdfaAssemblyTool)
.next(packageMDTool)
.next(saveOutputTool)
.next(cleanupTool);

// Export only the flow object
export { ocrPDFFlow };
