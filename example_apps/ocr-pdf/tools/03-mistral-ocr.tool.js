/**
 * mistral-ocr.tool.js - Extracts text from PDF pages using Mistral AI OCR
 * 
 * This tool uses Mistral AI for OCR processing of PDF pages, which doesn't require
 * any native dependencies and can run on any server environment.
 */
import { LLMTool, param, ParamType } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import { MistralClient } from '@mistralai/mistralai';

/**
 * Mistral OCR Tool - Extracts text from PDF pages using Mistral AI
 */
export const mistralOCRTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'mistralOCR',
      description: 'Extract text from PDF pages using Mistral AI OCR',
      input: [
        param('pageFile', ParamType.OBJECT, 'Page file object with path and pageNumber'),
        param('outputDir', ParamType.STRING, 'Directory to save OCR results'),
        param('apiKey', ParamType.STRING, 'Mistral AI API key')
      ],
      defaultProvider: 'mistral',
      defaultModel: 'mistral-large-vision',
      retries: 3,
      useExponentialBackoff: true,
      rateLimit: {
        mistral: { tokensPerMinute: 10000, requestsPerMinute: 20 }
      }
    });
  }
  
  async execute(state) {
    const { pageFile, outputDir, apiKey } = state;
    
    // Store pageNumber at the beginning to avoid undefined references in catch block
    const pageNumber = pageFile?.pageNumber || 'unknown';
    
    try {
      this.info(`Processing page ${pageNumber} with Mistral OCR`);
      
      // Ensure output directory exists
      await fs.ensureDir(outputDir);
      
      // Run Mistral OCR on the PDF page
      const ocrResult = await this.runMistralOCR(pageFile.path, apiKey, pageNumber);
      
      // Save the OCR text to a file
      const textFilePath = path.join(outputDir, `page_${pageNumber}.txt`);
      await fs.writeFile(textFilePath, ocrResult.text);
      
      this.info(`Saved OCR text to: ${textFilePath}`);
      
      // Save the full OCR result to a JSON file
      const outputPath = path.join(outputDir, `page_${pageNumber}_ocr.json`);
      await fs.writeJSON(outputPath, ocrResult, { spaces: 2 });
      
      this.info(`Saved OCR results to: ${outputPath}`);
      
      // Return only the new state properties to be merged with existing state
      return {
        pageNumber,
        ocrResult,
        textFilePath,
        outputPath,
        ocrComplete: true
      };
    } catch (error) {
      this.error(`Mistral OCR failed for page ${pageNumber}: ${error.message}`);
      return { 
        pageNumber,
        error: error.message,
        ocrComplete: false
      };
    }
  }
  
  /**
   * Run Mistral OCR on a PDF page
   * @param {string} pdfPath - Path to PDF file
   * @param {string} apiKey - Mistral AI API key
   * @param {number} pageNumber - Page number for logging
   * @returns {Promise<object>} - OCR results
   */
  async runMistralOCR(pdfPath, apiKey, pageNumber) {
    this.info(`Running Mistral OCR on PDF: ${pdfPath}`);
    
    try {
      // Read the PDF file as base64
      const pdfData = await fs.readFile(pdfPath);
      const base64Data = pdfData.toString('base64');
      
      // Create a Mistral client
      const client = new MistralClient(apiKey);
      
      // Call the Mistral Vision API directly instead of using this.call()
      // This ensures the mock in tests is properly called
      const response = await client.chat({
        model: "mistral-large-vision",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all the text from this document. Return only the extracted text, without any additional commentary or explanation."
              },
              {
                type: "image_url",
                image_url: {
                  data: base64Data,
                  mime_type: "application/pdf"
                }
              }
            ]
          }
        ]
      });
      
      // Extract the OCR text from the response
      const text = typeof response === 'string' ? response : 
                  (response.choices && response.choices[0].message.content) || 
                  JSON.stringify(response);
      
      // Create a structured OCR result
      return {
        text,
        confidence: 95, // Mistral doesn't provide confidence scores, so we use a default
        model: 'mistral-large-vision',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // If this is a rate limit error, we should retry
      if (error.message.toLowerCase().includes('rate limit')) {
        throw new Error(`API rate limit exceeded: ${error.message}`);
      }
      throw new Error(`Mistral OCR API error: ${error.message}`);
    }
  }
  
  // Override the callLLMAPI method to handle Mistral Vision API
  async callLLMAPI(prompt, model, temperature, maxTokens, provider, options = {}) {
    if (provider === 'mistral' && model === 'mistral-large-vision' && options.client && options.base64Data) {
      // Use the provided Mistral client and base64 data
      const response = await options.client.chat({
        model: "mistral-large-vision",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  data: options.base64Data,
                  mime_type: options.mimeType || "application/pdf"
                }
              }
            ]
          }
        ]
      });
      
      return response;
    } else {
      // Fall back to the parent implementation for other cases
      return super.callLLMAPI(prompt, model, temperature, maxTokens, provider, options);
    }
  }
}();
