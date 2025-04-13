/**
 * ocr-pdf.chain.js - Tool-centric implementation of the OCR PDF flow
 * 
 * This file demonstrates the new chainable API approach for the OCR PDF processor.
 * It implements a sophisticated OCR pipeline following the plan.md:
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
import { Tool, param, ParamType, flowRegistry } from '../../../flowlite.js';

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

// Create a tool for logging progress
const logProgressTool = new Tool({ name: 'logProgress' })
  .withExecute(async ({ message, ...state }) => {
    console.log(message);
    return state;
  });

// Create the main OCR PDF chain using the tool-centric approach
export const ocrPDFChain = setupTool
  .then(splitPDFTool)
  .then(logProgressTool.withExecute(async (state) => {
    console.log(`📄 Processing PDF with ${state.pageCount} pages`);
    return state;
  }))
  .then(initialContextTool)
  .then(pageOCRTool)
  .branch(
    // Branch based on whether OCR was successful
    (state) => state.ocrSuccess === true,
    // Success path
    pageReconciliationTool
      .then(addContextTool)
      .then(pdfaAssemblyTool)
      .then(packageMDTool)
      .then(saveOutputTool)
      .then(cleanupTool),
    // Error path
    logProgressTool.withExecute(async (state) => {
      console.error(`❌ OCR processing failed: ${state.error}`);
      return { ...state, success: false };
    })
  );

// Create a more advanced version with error handling and recovery options
export const advancedOCRPDFChain = setupTool
  .then(splitPDFTool)
  .catch(async (error, state) => {
    console.error(`❌ Error during PDF setup or splitting: ${error.message}`);
    return { ...state, error: error.message, _goto: 'cleanup' };
  })
  .then(initialContextTool)
  .catch(async (error, state) => {
    console.error(`❌ Error during initial context extraction: ${error.message}`);
    console.log(`⚠️ Continuing without context...`);
    return { ...state, contextError: error.message };
  })
  .then(pageOCRTool)
  .catch(async (error, state) => {
    console.error(`❌ Error during OCR processing: ${error.message}`);
    return { ...state, error: error.message, _goto: 'cleanup' };
  })
  .then(pageReconciliationTool)
  .then(addContextTool)
  .then(pdfaAssemblyTool)
  .then(packageMDTool)
  .then(saveOutputTool)
  .then(cleanupTool);

// Register named segments for non-linear navigation
flowRegistry.createSegment('setup', setupTool);
flowRegistry.createSegment('splitPDF', splitPDFTool);
flowRegistry.createSegment('initialContext', initialContextTool);
flowRegistry.createSegment('pageOCR', pageOCRTool);
flowRegistry.createSegment('pageReconciliation', pageReconciliationTool);
flowRegistry.createSegment('addContext', addContextTool);
flowRegistry.createSegment('pdfaAssembly', pdfaAssemblyTool);
flowRegistry.createSegment('packageMD', packageMDTool);
flowRegistry.createSegment('saveOutput', saveOutputTool);
flowRegistry.createSegment('cleanup', cleanupTool);

// Create a version that uses the flow registry for non-linear navigation
export const registryOCRPDFChain = new Tool({
  name: 'ocrPDF',
  description: 'Process a PDF with multiple OCR engines and Claude context extraction',
  input: [
    param('inputPath', ParamType.STRING, 'Path to input PDF'),
    param('outputPath', ParamType.STRING, 'Path to output PDF'),
    param('keepTemp', ParamType.BOOLEAN, 'Whether to keep temporary files', true)
  ]
})
.withExecute(async (initialState) => {
  return { _goto: 'setup', ...initialState };
});

// Export a simple function to run the OCR process
export const processOCRPDF = async (options) => {
  try {
    // You can use any of the three approaches:
    // 1. Linear chain: return await ocrPDFChain.call(options);
    // 2. Advanced chain with error handling: return await advancedOCRPDFChain.call(options);
    // 3. Registry-based non-linear flow: 
    return await flowRegistry.execute('setup', options);
  } catch (error) {
    console.error(`❌ OCR processing failed: ${error.message}`);
    throw error;
  }
};
