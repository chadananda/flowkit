/**
 * 03b-abbyy-ocr.tool.js - OCR processing using ABBYY Cloud OCR
 * 
 * This tool processes PDF pages using ABBYY Cloud OCR SDK,
 * which provides high-quality OCR for complex documents.
 */
import { Tool } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import { createClient } from 'abbyy-ocr-ts';

export const abbyyOCRTool = new class extends Tool {
  constructor() {
    super({
      name: 'abbyyOCR',
      description: 'Process PDF pages with ABBYY Cloud OCR',
      input: [
        { name: 'pageFiles', description: 'Array of page files to process' },
        { name: 'tempDirs', description: 'Temporary directories for processing' },
        { name: 'initialContext', description: 'Initial context information about the document' }
      ],
      output: [
        { name: 'ocrResults', description: 'Array of OCR results for each page' }
      ]
    });
  }

  async execute(state) {
    const { pageFiles, tempDirs, initialContext } = state;
    
    if (!pageFiles || !Array.isArray(pageFiles)) {
      return { 
        error: 'Invalid page files: must be an array',
        abbyyComplete: false
      };
    }

    if (!tempDirs) {
      return { 
        error: 'Temporary directories are required',
        abbyyComplete: false
      };
    }

    try {
      // Get API credentials from environment variables
      const abbyyApiKey = process.env.ABBYY_API_KEY;
      const abbyyApplicationId = process.env.ABBYY_APPLICATION_ID;
      
      if (!abbyyApiKey) {
        return { 
          error: 'ABBYY_API_KEY environment variable is required',
          abbyyComplete: false
        };
      }

      if (!abbyyApplicationId) {
        return { 
          error: 'ABBYY_APPLICATION_ID environment variable is required',
          abbyyComplete: false
        };
      }

      // Initialize ABBYY client
      const client = createClient({
        applicationId: abbyyApplicationId,
        password: abbyyApiKey
      });

      // Process each page with OCR
      const ocrPromises = pageFiles.map(async (pageFile) => {
        try {
          // Create output directory for this page
          const pageOcrDir = path.join(tempDirs.ocrResults, `page_${pageFile.pageNumber}`, 'abbyy');
          await fs.ensureDir(pageOcrDir);
          
          // Read the PDF file
          const fileContent = await fs.readFile(pageFile.path);
          
          // Process the file with ABBYY
          const task = await client.processImage({
            fileContent,
            exportFormats: {
              txtFile: true,
              xmlFile: true
            },
            language: 'English',
            profile: 'documentConversion'
          });
          
          // Wait for the task to complete
          const result = await task.waitForCompletion();
          
          // Download the results
          const txtResult = await result.downloadUrl('txtFile');
          const xmlResult = await result.downloadUrl('xmlFile');
          
          // Save the OCR text to a file
          const textFilePath = path.join(pageOcrDir, `text.txt`);
          await fs.writeFile(textFilePath, txtResult);
          
          // Save the OCR XML to a file
          const xmlFilePath = path.join(pageOcrDir, `result.xml`);
          await fs.writeFile(xmlFilePath, xmlResult);
          
          // Return the result
          return {
            pageNumber: pageFile.pageNumber,
            engine: 'abbyy',
            textFilePath,
            xmlFilePath,
            success: true
          };
        } catch (error) {
          return {
            pageNumber: pageFile.pageNumber,
            engine: 'abbyy',
            error: error.message,
            success: false
          };
        }
      });
      
      const ocrResults = await Promise.all(ocrPromises);
      
      // Return only the new state properties to be merged with existing state
      return { 
        ocrResults, 
        success: true,
        abbyyComplete: true
      };
    } catch (error) {
      return { 
        error: `ABBYY OCR processing failed: ${error.message}`,
        abbyyComplete: false
      };
    }
  }
}();
