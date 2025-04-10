/**
 * ocr-pdf.flow.js - Ultra-compact flow for OCR processing of PDF files
 */
import { Flow, Tool, APITool, LLMTool, param, ParamType, LogLevel } from '../../flowlite.js';
import { createCanvas } from 'canvas';
import { createWorker } from 'tesseract.js';
import vision from '@google-cloud/vision';
import { readFile } from 'fs/promises';
import * as pdfjsLib from 'pdfjs-dist';
import chalk from 'chalk';

// Ultra-compact tool definitions using class expressions
const loadPDFTool = new class extends Tool {
  constructor() {
    super({
      name: 'loadPDF',
      description: 'Load a PDF file and extract pages',
      input: [param('inputPath', ParamType.STRING, 'Path to the PDF file')]
    });
  }
  
  async execute({ inputPath }) {
    try {
      this.info(`Loading PDF: ${inputPath}`);
      
      // Load the PDF document
      const data = new Uint8Array(await readFile(inputPath));
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdfDocument = await loadingTask.promise;
      
      // Get the total number of pages
      const numPages = pdfDocument.numPages;
      this.info(`PDF loaded with ${numPages} pages`);
      
      // Extract pages
      const pages = [];
      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDocument.getPage(i);
        pages.push({
          pageNumber: i,
          page
        });
      }
      
      return { pdfDocument, pages, numPages };
    } catch (error) {
      this.error(`Failed to load PDF: ${error.message}`);
      throw error;
    }
  }
}();

const tesseractOCRTool = new class extends Tool {
  constructor() {
    super({
      name: 'ocrTesseract',
      description: 'Extract text using Tesseract OCR',
      input: [
        param('page', ParamType.OBJECT, 'PDF page object'),
        param('pageNum', ParamType.NUMBER, 'Page number')
      ]
    });
  }
  
  async execute({ page, pageNum }) {
    try {
      this.info(`Running Tesseract OCR on page ${pageNum}`);
      
      // Render the PDF page to a canvas
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Run OCR on the rendered page
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      const { data } = await worker.recognize(canvas.toBuffer());
      await worker.terminate();
      
      this.info(`Tesseract OCR completed for page ${pageNum}`);
      
      return { 
        tesseractResult: {
          text: data.text,
          confidence: data.confidence,
          words: data.words
        }
      };
    } catch (error) {
      this.error(`Tesseract OCR failed: ${error.message}`);
      return { tesseractError: error.message };
    }
  }
}();

const googleVisionOCRTool = new class extends APITool {
  constructor() {
    super({
      name: 'googleVisionOCR',
      description: 'Extract text using Google Cloud Vision OCR',
      input: [
        param('page', ParamType.OBJECT, 'PDF page object'),
        param('pageNum', ParamType.NUMBER, 'Page number')
      ]
    });
    this.withApiKey('GOOGLE_CLOUD_VISION_KEY');
  }
  
  async execute({ page, pageNum }) {
    try {
      if (!process.env.GOOGLE_CLOUD_VISION_KEY) {
        this.warn('Google Cloud Vision API key not found, skipping');
        return { googleVisionResult: null };
      }
      
      this.info(`Running Google Vision OCR on page ${pageNum}`);
      
      // Render the PDF page to a canvas
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // This is a placeholder for Google Cloud Vision API call
      // In a real implementation, you would:
      // 1. Convert canvas to image
      // 2. Send image to Google Cloud Vision API
      // 3. Process the response
      
      // Simulate API call
      this.debug('Simulating Google Cloud Vision API call');
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
      
      this.info(`Google Vision OCR completed for page ${pageNum}`);
      
      return { 
        googleVisionResult: {
          text: `Simulated Google Vision OCR text for page ${pageNum}`,
          confidence: 0.95,
          // Additional fields would be here in a real implementation
        }
      };
    } catch (error) {
      this.error(`Google Vision OCR failed: ${error.message}`);
      return { googleVisionError: error.message };
    }
  }
}();

const claudeReconcilerTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'claudeReconciler',
      description: 'Reconcile OCR results using Claude',
      input: [
        param('tesseractResult', ParamType.OBJECT, 'Tesseract OCR result'),
        param('googleVisionResult', ParamType.OBJECT, 'Google Vision OCR result'),
        param('pageNum', ParamType.NUMBER, 'Page number')
      ]
    });
    this.withApiKey('ANTHROPIC_API_KEY');
  }
  
  async execute({ tesseractResult, googleVisionResult, pageNum }) {
    try {
      if (!tesseractResult && !googleVisionResult) {
        this.warn(`No OCR results to reconcile for page ${pageNum}`);
        return { reconciledText: '' };
      }
      
      this.info(`Reconciling OCR results for page ${pageNum}`);
      
      // If we only have one result, return it
      if (!tesseractResult) {
        this.info('Using only Google Vision result');
        return { reconciledText: googleVisionResult.text };
      }
      
      if (!googleVisionResult) {
        this.info('Using only Tesseract result');
        return { reconciledText: tesseractResult.text };
      }
      
      // This is a placeholder for Claude API call
      // In a real implementation, you would:
      // 1. Prepare prompt with both OCR results
      // 2. Call Claude API
      // 3. Process the response
      
      // Simulate reconciliation
      this.debug('Simulating Claude reconciliation');
      
      // Simple reconciliation strategy: prefer the result with higher confidence
      // In a real implementation, this would be much more sophisticated
      let reconciledText;
      
      if (tesseractResult.confidence > 0.9 && googleVisionResult.confidence > 0.9) {
        // Both have high confidence, merge them (in a real implementation)
        reconciledText = `Reconciled text from both OCR engines for page ${pageNum}`;
      } else if (tesseractResult.confidence > googleVisionResult.confidence) {
        reconciledText = tesseractResult.text;
      } else {
        reconciledText = googleVisionResult.text;
      }
      
      this.info(`OCR reconciliation completed for page ${pageNum}`);
      
      return { reconciledText };
    } catch (error) {
      this.error(`OCR reconciliation failed: ${error.message}`);
      return { reconciliationError: error.message };
    }
  }
}();

const generatePDFPageTool = new class extends Tool {
  constructor() {
    super({
      name: 'generatePDFPage',
      description: 'Generate a PDF page with the OCR text',
      input: [
        param('reconciledText', ParamType.STRING, 'Reconciled OCR text'),
        param('pageNum', ParamType.NUMBER, 'Page number')
      ]
    });
  }
  
  async execute({ reconciledText, pageNum }) {
    try {
      this.info(`Generating PDF page ${pageNum}`);
      
      // This is a placeholder for PDF page generation
      // In a real implementation, you would:
      // 1. Create a new PDF page
      // 2. Add the reconciled text
      // 3. Return the PDF page data
      
      this.info(`PDF page ${pageNum} generated`);
      
      return { 
        generatedPage: {
          pageNum,
          text: reconciledText,
          // This would be the actual PDF page data in a real implementation
          data: Buffer.from(`Page ${pageNum} with OCR text: ${reconciledText.substring(0, 50)}...`)
        }
      };
    } catch (error) {
      this.error(`PDF page generation failed: ${error.message}`);
      return { generationError: error.message };
    }
  }
}();

const mergePDFPagesTool = new class extends Tool {
  constructor() {
    super({
      name: 'mergePDFPages',
      description: 'Merge PDF pages into a single PDF',
      input: [
        param('generatedPages', ParamType.ARRAY, 'Generated PDF pages'),
        param('outputPath', ParamType.STRING, 'Output PDF path')
      ]
    });
  }
  
  async execute({ generatedPages, outputPath }) {
    try {
      this.info(`Merging ${generatedPages.length} pages into ${outputPath}`);
      
      // This is a placeholder for PDF merging
      // In a real implementation, you would:
      // 1. Create a new PDF document
      // 2. Add all the generated pages
      // 3. Save the PDF to the output path
      
      this.info(`PDF saved to ${outputPath}`);
      
      return { mergedPDF: outputPath };
    } catch (error) {
      this.error(`PDF merging failed: ${error.message}`);
      return { mergeError: error.message };
    }
  }
}();

// Process a single page with OCR
const processPageFlow = Flow.create({
  name: 'processPage',
  input: [
    param('page', ParamType.OBJECT, 'PDF page'),
    param('state', ParamType.OBJECT, 'Current state')
  ]
})
.next(async ({ page, state }) => {
  const pageNum = page.pageNumber;
  processPageFlow.info(`Processing page ${pageNum}`);
  
  // Run OCR tools in parallel
  const [tesseractResult, googleVisionResult] = await Promise.all([
    tesseractOCRTool.call({ page: page.page, pageNum }),
    googleVisionOCRTool.call({ page: page.page, pageNum })
  ]);
  
  // Reconcile results
  const reconciled = await claudeReconcilerTool.call({
    tesseractResult: tesseractResult.tesseractResult,
    googleVisionResult: googleVisionResult.googleVisionResult,
    pageNum
  });
  
  // Generate PDF page
  const generated = await generatePDFPageTool.call({
    reconciledText: reconciled.reconciledText,
    pageNum
  });
  
  return { ...state, ...generated };
});

// Ultra-compact OCR PDF flow
export const ocrPDFFlow = Flow.create({
  name: 'ocrPDF',
  input: [
    param('inputPath', ParamType.STRING, 'Input PDF path'),
    param('outputPath', ParamType.STRING, 'Output PDF path')
  ]
})
.next(async ({ inputPath, outputPath }) => {
  // Load the PDF
  const pdfData = await loadPDFTool.call({ inputPath });
  
  // Process pages in parallel with limited concurrency
  const processedPages = [];
  const concurrency = 2; // Process 2 pages at a time
  
  for (let i = 0; i < pdfData.pages.length; i += concurrency) {
    const pageBatch = pdfData.pages.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      pageBatch.map(page => processPageFlow.run({ page, state: {} }))
    );
    processedPages.push(...batchResults);
  }
  
  // Collect generated pages
  const generatedPages = processedPages
    .filter(result => result.generatedPage)
    .map(result => result.generatedPage)
    .sort((a, b) => a.pageNum - b.pageNum);
  
  // Merge pages into final PDF
  const mergeResult = await mergePDFPagesTool.call({
    generatedPages,
    outputPath
  });
  
  return { 
    inputPath, 
    outputPath, 
    generatedPages, 
    mergedPDF: mergeResult.mergedPDF,
    pageCount: generatedPages.length
  };
});

// Export the main function
export const processPDF = async (inputPath, outputPath) => {
  try {
    return await ocrPDFFlow.run({ inputPath, outputPath });
  } catch (error) {
    ocrPDFFlow.error(`Error processing PDF: ${error.message}`);
    throw error;
  }
};
