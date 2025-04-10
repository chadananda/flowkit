#!/usr/bin/env node
/**
 * OCR PDF CLI - Example app using Flowkit
 * 
 * Usage: node index.js ./input.pdf ./output.pdf
 */
import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import { fileURLToPath } from 'url';
import { Flow, mapReduce } from '../../flowkit.js';
import { 
  loadPDF, 
  ocrTesseract, 
  googleVisionOCR, 
  abbyyOCR, 
  mistralOCR, 
  claudeReconciler,
  generatePDFPage,
  mergePDFPages
} from './tools.js';
import { logInfo, logSuccess, logError } from './utils.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  logError('Usage: node index.js <input-pdf> <output-pdf>');
  process.exit(1);
}

const inputPath = path.resolve(args[0]);
const outputPath = path.resolve(args[1]);

/**
 * Process a single page with OCR
 */
async function processPage(page, state) {
  const pageNum = page.pageNumber;
  logInfo(`Processing page ${pageNum}`);
  
  // Create a flow for processing a single page
  return Flow.start()
    .next(async (s) => ({ ...s, page, pageNum }))
    .all([ocrTesseract, googleVisionOCR])
    .next(claudeReconciler)
    .next(generatePDFPage)
    .run(state);
}

/**
 * Collect all generated pages and merge them
 */
function collectPages(results, state) {
  const generatedPages = results
    .filter(result => result.generatedPage)
    .map(result => result.generatedPage)
    .sort((a, b) => a.pageNum - b.pageNum);
  
  return { ...state, generatedPages };
}

/**
 * Main function to run the OCR PDF process
 */
async function main() {
  try {
    // Register all tools
    const tools = [
      loadPDF, 
      ocrTesseract, 
      googleVisionOCR, 
      abbyyOCR, 
      mistralOCR, 
      claudeReconciler,
      generatePDFPage,
      mergePDFPages
    ];
    
    // Create the main flow
    const result = await Flow.start()
      .tools(tools)
      .next(async (state) => ({ ...state, inputPath, outputPath }))
      .next(loadPDF)
      .next(mapReduce(
        (state) => state.pages,
        processPage,
        collectPages,
        { concurrency: 2 } // Process 2 pages in parallel
      ))
      .next(mergePDFPages)
      .run({});
    
    if (result.mergedPDF) {
      logSuccess(`Wrote ${result.generatedPages.length} pages to ${result.outputPath}`);
    } else {
      logError('Failed to process PDF');
    }
  } catch (error) {
    logError(`Error processing PDF: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();
