/**
 * 03a-google-vision-ocr.tool.js - OCR processing using Google Cloud Vision
 * 
 * This tool processes PDF pages using Google Cloud Vision API for OCR,
 * extracting text with high accuracy for complex documents.
 */
import { Tool } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import { ImageAnnotatorClient } from '@google-cloud/vision';

export const googleVisionOCRTool = new class extends Tool {
  constructor() {
    super({
      name: 'googleVisionOCR',
      description: 'Process PDF pages with Google Cloud Vision OCR',
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
        googleVisionComplete: false
      };
    }

    if (!tempDirs) {
      return { 
        error: 'Temporary directories are required',
        googleVisionComplete: false
      };
    }

    try {
      // Get API key from environment variables
      const googleCloudVisionKey = process.env.GOOGLE_CLOUD_VISION_KEY;
      
      if (!googleCloudVisionKey) {
        return { 
          error: 'GOOGLE_CLOUD_VISION_KEY environment variable is required',
          googleVisionComplete: false
        };
      }

      // Initialize Google Cloud Vision client
      const client = new ImageAnnotatorClient({
        keyFilename: googleCloudVisionKey
      });

      // Process each page with OCR
      const ocrPromises = pageFiles.map(async (pageFile) => {
        try {
          // Create output directory for this page
          const pageOcrDir = path.join(tempDirs.ocrResults, `page_${pageFile.pageNumber}`, 'google');
          await fs.ensureDir(pageOcrDir);
          
          // Convert PDF to image (this would need to be implemented)
          // For now, we'll assume the PDF is already an image
          const imagePath = pageFile.path;
          
          // Run OCR on the image
          const [result] = await client.textDetection(imagePath);
          const detections = result.textAnnotations;
          const text = detections.length > 0 ? detections[0].description : '';
          
          // Save the OCR text to a file
          const textFilePath = path.join(pageOcrDir, `text.txt`);
          await fs.writeFile(textFilePath, text);
          
          // Save the OCR JSON to a file
          const jsonFilePath = path.join(pageOcrDir, `result.json`);
          await fs.writeFile(jsonFilePath, JSON.stringify(detections, null, 2));
          
          // Return the result
          return {
            pageNumber: pageFile.pageNumber,
            engine: 'google',
            textFilePath,
            jsonFilePath,
            success: true
          };
        } catch (error) {
          return {
            pageNumber: pageFile.pageNumber,
            engine: 'google',
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
        googleVisionComplete: true
      };
    } catch (error) {
      return { 
        error: `Google Vision OCR processing failed: ${error.message}`,
        googleVisionComplete: false
      };
    }
  }
}();
