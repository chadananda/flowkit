/**
 * 08-process-pages.tool.js - Process PDF pages with OCR and context extraction
 * 
 * This tool handles the processing of PDF pages, including:
 * 1. Running OCR on each page using Mistral AI
 * 2. Extracting context from OCR text using Claude
 */
import { Tool } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import { mistralOCRTool } from './03-mistral-ocr.tool.js';
import { claudeContextTool } from './04-claude-context.tool.js';

export const processPagesTool = new class extends Tool {
  constructor() {
    super({
      name: 'processPages',
      description: 'Process PDF pages with OCR and context extraction',
      input: [
        { name: 'pageFiles', description: 'Array of page files to process' },
        { name: 'tempDirs', description: 'Temporary directories for processing' }
      ],
      output: [
        { name: 'pageResults', description: 'Array of processed page results' }
      ]
    });
  }

  async execute({ pageFiles, tempDirs, ...rest }) {
    if (!pageFiles || !Array.isArray(pageFiles)) {
      return { 
        error: 'Invalid page files: must be an array',
        ...rest
      };
    }

    if (!tempDirs) {
      return { 
        error: 'Temporary directories are required',
        ...rest
      };
    }

    try {
      // Get API keys from environment variables
      const mistralApiKey = process.env.MISTRAL_API_KEY;
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      
      if (!mistralApiKey) {
        return { 
          error: 'MISTRAL_API_KEY environment variable is required',
          ...rest
        };
      }
      
      if (!anthropicApiKey) {
        return { 
          error: 'ANTHROPIC_API_KEY environment variable is required',
          ...rest
        };
      }

      // Process each page with OCR and context extraction
      const pagePromises = pageFiles.map(async (pageFile) => {
        try {
          // Create output directories for this page
          const pageOcrDir = path.join(tempDirs.ocrResults, `page_${pageFile.pageNumber}`);
          const pageContextDir = path.join(tempDirs.jsonResults, `page_${pageFile.pageNumber}`);
          await fs.ensureDir(pageOcrDir);
          await fs.ensureDir(pageContextDir);
          
          // Run OCR on the page
          const ocrResult = await mistralOCRTool.call({
            pageFile,
            outputDir: pageOcrDir,
            apiKey: mistralApiKey
          });
          
          if (ocrResult.error) {
            return {
              pageNumber: pageFile.pageNumber,
              error: ocrResult.error,
              stage: 'ocr',
              success: false
            };
          }
          
          // Extract context using Claude
          const contextResult = await claudeContextTool.call({
            textFilePath: ocrResult.textFilePath,
            outputDir: pageContextDir,
            apiKey: anthropicApiKey,
            contextType: 'document'
          });
          
          if (contextResult.error) {
            return {
              pageNumber: pageFile.pageNumber,
              ocrResult,
              error: contextResult.error,
              stage: 'context',
              success: false
            };
          }
          
          // Return the combined results
          return {
            pageNumber: pageFile.pageNumber,
            ocrResult,
            contextResult,
            success: true
          };
        } catch (error) {
          return {
            pageNumber: pageFile.pageNumber,
            error: error.message,
            stage: 'processing',
            success: false
          };
        }
      });
      
      const pageResults = await Promise.all(pagePromises);
      return { pageResults, success: true, ...rest };
    } catch (error) {
      return { error: `Page processing failed: ${error.message}`, ...rest };
    }
  }
}();
