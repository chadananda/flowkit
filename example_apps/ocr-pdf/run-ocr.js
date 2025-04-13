/**
 * run-ocr.js - Run OCR on the provided PDF file
 * 
 * This script runs the actual OCR process on the provided PDF file
 * and saves the results to the tests/output directory.
 */
import { setupTool } from './tools/01-setup.tool.js';
import { splitPDFTool } from './tools/02-split-pdf.tool.js';
import { mistralOCRTool } from './tools/03-mistral-ocr.tool.js';
import fs from 'fs-extra';
import path from 'path';

// Path to the PDF file
const pdfPath = './tests/The Priceless Pearl OCRd.pdf';
const outputDir = './tests/output';

async function runOcr() {
  try {
    console.log(`Processing PDF: ${pdfPath}`);
    
    // Ensure output directory exists
    await fs.ensureDir(outputDir);
    
    // Step 1: Set up temporary directories
    console.log('Setting up temporary directories...');
    const setupResult = await setupTool.call({ inputPath: pdfPath });
    console.log('Temporary directories created:', setupResult.tempDirs);
    
    // Step 2: Split PDF into pages
    console.log('Splitting PDF into pages...');
    const splitResult = await splitPDFTool.call({
      inputPath: pdfPath,
      tempDirs: setupResult.tempDirs
    });
    console.log(`PDF split into ${splitResult.pageCount} pages`);
    
    // Step 3: Process the first page with Mistral OCR
    console.log('Processing first page with Mistral OCR...');
    const pageFile = splitResult.pageFiles[0];
    const pageOutputDir = path.join(setupResult.tempDirs.ocrResults, `page_${pageFile.pageNumber}`);
    
    // Get the Mistral API key from environment variable
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is required');
    }
    
    const ocrResult = await mistralOCRTool.call({
      pageFile,
      outputDir: pageOutputDir,
      apiKey
    });
    
    if (ocrResult.error) {
      console.error(`Error processing page: ${ocrResult.error}`);
    } else {
      console.log(`Successfully processed page ${pageFile.pageNumber}`);
      
      // Save the results to the output directory
      const outputTextPath = path.join(outputDir, 'actual_ocr_text.txt');
      const outputJsonPath = path.join(outputDir, 'actual_ocr_data.json');
      
      await fs.copyFile(ocrResult.textFilePath, outputTextPath);
      await fs.copyFile(ocrResult.outputPath, outputJsonPath);
      
      console.log(`\nOCR results saved for viewing:`);
      console.log(`- Text file: ${outputTextPath}`);
      console.log(`- JSON file: ${outputJsonPath}`);
      
      // Display a snippet of the extracted text
      const textContent = await fs.readFile(ocrResult.textFilePath, 'utf8');
      console.log(`\nExtracted text snippet:`);
      console.log(textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''));
    }
    
    // Clean up temporary directories
    await fs.remove(setupResult.tempDirs.root);
    console.log('Temporary directories cleaned up');
    
  } catch (error) {
    console.error('Error running OCR:', error);
  }
}

// Run the OCR
runOcr();
