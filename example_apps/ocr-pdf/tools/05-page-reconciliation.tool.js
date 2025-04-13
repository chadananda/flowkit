/**
 * 05-page-reconciliation.tool.js - Reconciles OCR results using Claude
 * 
 * This tool takes the OCR results from Mistral and enhances them using Claude's
 * language understanding capabilities to correct errors, improve formatting,
 * and provide a more accurate representation of the original document.
 */
import { LLMTool } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';

export const pageReconciliationTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'pageReconciliation',
      description: 'Reconciles OCR results using Claude to improve accuracy and formatting',
      input: [
        { name: 'pageResults', description: 'Array of page results from OCR processing' },
        { name: 'tempDirs', description: 'Temporary directories for storing results' },
        { name: 'apiKey', description: 'Claude API key' }
      ],
      output: [
        { name: 'reconciledPages', description: 'Array of pages with reconciled text' },
        { name: 'error', description: 'Error message if reconciliation failed' }
      ]
    });
  }

  async execute({ pageResults, tempDirs, ...rest }) {
    if (!pageResults || !Array.isArray(pageResults)) {
      return { 
        error: 'Invalid page results: must be an array',
        ...rest
      };
    }

    if (!tempDirs) {
      return { 
        error: 'Temporary directories are required',
        ...rest
      };
    }

    if (!tempDirs.reconciledResults) {
      return { 
        error: 'Reconciled results directory is required',
        ...rest
      };
    }

    // Only process successful pages
    const successfulPages = pageResults.filter(page => page.success);
    
    if (successfulPages.length === 0) {
      return { 
        reconciledPages: [],
        error: 'No successful pages to reconcile',
        pageResults,
        ...rest
      };
    }

    try {
      // Ensure output directory exists
      const outputDir = tempDirs.reconciledResults;
      await fs.ensureDir(outputDir);
      
      // Initialize Claude client
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });

      // Process each page
      const reconciledPagesPromises = successfulPages.map(async (page) => {
        try {
          // Skip pages with missing OCR results
          if (!page.ocrResult || !page.ocrResult.textFilePath) {
            return {
              ...page,
              reconciled: false,
              reconciliationError: 'Missing OCR results'
            };
          }

          // Read the OCR text
          const ocrText = await fs.readFile(page.ocrResult.textFilePath, 'utf8');
          
          // Skip pages with empty OCR text
          if (!ocrText || ocrText.trim().length === 0) {
            return {
              ...page,
              reconciled: false,
              reconciliationError: 'Empty OCR text'
            };
          }

          // Get document type from context result if available
          const documentType = page.contextResult?.contextResult?.documentType || 'document';
          
          // Create the prompt for Claude
          const prompt = this.createReconciliationPrompt(ocrText, documentType);
          
          // Call Claude to reconcile the text
          const response = await anthropic.messages.create({
            model: 'claude-3-7-sonnet',
            max_tokens: 4000,
            messages: [
              { role: 'user', content: prompt }
            ],
            temperature: 0.2
          });

          // Extract the reconciled text
          const reconciledText = response.content[0].text;
          
          // Save the reconciled text to a file
          const reconciledFilePath = path.join(outputDir, `page_${page.pageNumber}_reconciled.txt`);
          await fs.writeFile(reconciledFilePath, reconciledText);
          
          // Return the updated page object
          return {
            ...page,
            reconciled: true,
            reconciledTextFilePath: reconciledFilePath,
            reconciliationMetadata: {
              model: 'claude-3-7-sonnet',
              timestamp: new Date().toISOString(),
              documentType
            }
          };
        } catch (error) {
          return {
            ...page,
            reconciled: false,
            reconciliationError: error.message
          };
        }
      });

      // Wait for all pages to be processed
      const reconciledPages = await Promise.all(reconciledPagesPromises);
      
      // Return the results
      return {
        reconciledPages,
        success: true,
        ...rest
      };
    } catch (error) {
      return {
        error: `Reconciliation failed: ${error.message}`,
        success: false,
        ...rest
      };
    }
  }

  /**
   * Creates a prompt for Claude to reconcile OCR text
   * @param {string} ocrText - The raw OCR text
   * @param {string} documentType - The type of document
   * @returns {string} - The prompt for Claude
   */
  createReconciliationPrompt(ocrText, documentType) {
    return `
You are an expert OCR post-processor. I'm going to provide you with raw OCR text extracted from a ${documentType}. 
Your task is to correct errors, improve formatting, and make the text more readable and accurate.

Please follow these guidelines:
1. Fix obvious OCR errors (e.g., "l" mistaken for "1", "O" for "0", etc.)
2. Correct spelling and grammar mistakes that are likely OCR errors
3. Preserve the original structure and layout as much as possible
4. Maintain paragraph breaks and section divisions
5. Format tables properly if they exist
6. Preserve bullet points and numbered lists
7. Do not add any new information or content that isn't in the original text
8. Do not remove any information from the original text
9. If you encounter text that seems completely garbled or nonsensical, indicate this with [ILLEGIBLE]

Here is the OCR text to reconcile:

${ocrText}

Please provide the corrected and formatted text only, without any explanations or comments.
`;
  }
}();
