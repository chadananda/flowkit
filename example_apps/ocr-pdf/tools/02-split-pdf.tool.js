/**
 * split-pdf.tool.js - Splits a PDF into individual pages
 * 
 * This tool uses pdf-lib to split a PDF document into individual pages,
 * saving each page as a separate PDF file for parallel processing.
 */
import { Tool, param, ParamType } from '../../../flowlite.js';
import { PDFDocument } from 'pdf-lib';
import path from 'path';
import { readFile, writeFile } from 'fs/promises';

/**
 * Split PDF Tool - Splits input PDF into individual page PDFs
 */
export const splitPDFTool = new class extends Tool {
  constructor() {
    super({
      name: 'splitPDF',
      description: 'Split input PDF into individual page PDFs',
      input: [
        param('inputPath', ParamType.STRING, 'Path to input PDF file'),
        param('tempDirs', ParamType.OBJECT, 'Temporary directories')
      ]
    });
  }
  
  async execute(state) {
    const { inputPath, tempDirs } = state;
    
    try {
      if (!inputPath) {
        return { 
          error: 'Input path is required',
          splitComplete: false
        };
      }

      if (!tempDirs || !tempDirs.rawPages) {
        return { 
          error: 'Temporary directories are required',
          splitComplete: false
        };
      }

      this.info(`Splitting PDF: ${inputPath}`);
      
      // Load the PDF using pdf-lib
      const pdfBytes = await readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();
      
      this.info(`PDF has ${pageCount} pages`);
      
      // Split each page into a separate PDF
      const pageFiles = [];
      
      for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);
        
        const pagePdfBytes = await newPdf.save();
        const pageFilePath = path.join(tempDirs.rawPages, `page_${i + 1}.pdf`);
        
        await writeFile(pageFilePath, pagePdfBytes);
        pageFiles.push({
          index: i,
          pageNumber: i + 1,
          path: pageFilePath
        });
        
        this.info(`Saved page ${i + 1} to ${pageFilePath}`);
      }
      
      // Return only the new state properties to be merged with existing state
      return { 
        pageFiles,
        pageCount,
        splitComplete: true
      };
    } catch (error) {
      this.error(`PDF splitting failed: ${error.message}`);
      return { 
        error: error.message, 
        splitComplete: false 
      };
    }
  }
}();
