/**
 * 03c-initial-context.tool.js - Extract initial context from first pages using Claude
 * 
 * This tool processes the first 20 pages of a document using Tesseract OCR
 * and then uses Claude 3.7 to extract key context information like document type,
 * characters, locations, and document style.
 */
import { LLMTool } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import Tesseract from 'node-tesseract-ocr';

export const initialContextTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'initialContext',
      description: 'Extract initial context from first pages using Claude',
      input: [
        { name: 'pageFiles', description: 'Array of page files to process' },
        { name: 'tempDirs', description: 'Temporary directories for processing' }
      ],
      output: [
        { name: 'initialContext', description: 'Initial context information about the document' }
      ]
    });
  }

  async execute(state) {
    const { pageFiles, tempDirs } = state;
    
    if (!pageFiles || !Array.isArray(pageFiles)) {
      return { 
        error: 'Invalid page files: must be an array',
        initialContextComplete: false
      };
    }

    if (!tempDirs) {
      return { 
        error: 'Temporary directories are required',
        initialContextComplete: false
      };
    }

    try {
      // Get API key from environment variables
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      
      if (!anthropicApiKey) {
        return { 
          error: 'ANTHROPIC_API_KEY environment variable is required',
          initialContextComplete: false
        };
      }

      // Initialize Claude client
      const anthropic = new Anthropic({
        apiKey: anthropicApiKey
      });

      // Create output directory for initial context
      const contextDir = path.join(tempDirs.jsonResults, 'initial_context');
      await fs.ensureDir(contextDir);

      // Process only the first 20 pages (or all if less than 20)
      const pagesToProcess = pageFiles.slice(0, 20);
      
      // Extract text from each page using Tesseract OCR
      const ocrPromises = pagesToProcess.map(async (pageFile) => {
        try {
          // Configure Tesseract options
          const config = {
            lang: 'eng',
            oem: 1,
            psm: 3,
          };
          
          // Run OCR on the page
          const text = await Tesseract.recognize(pageFile.path, config);
          
          return {
            pageNumber: pageFile.pageNumber,
            text,
            success: true
          };
        } catch (error) {
          return {
            pageNumber: pageFile.pageNumber,
            error: error.message,
            success: false
          };
        }
      });
      
      const ocrResults = await Promise.all(ocrPromises);
      
      // Combine successful OCR results
      const successfulResults = ocrResults.filter(result => result.success);
      const combinedText = successfulResults
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .map(result => `--- PAGE ${result.pageNumber} ---\n${result.text}`)
        .join('\n\n');
      
      // Save the combined text to a file
      const combinedTextPath = path.join(contextDir, 'combined_text.txt');
      await fs.writeFile(combinedTextPath, combinedText);
      
      // Create the prompt for Claude
      const prompt = this.createContextExtractionPrompt(combinedText);
      
      // Call Claude to extract context
      const response = await anthropic.messages.create({
        model: 'claude-3-7-sonnet',
        max_tokens: 4000,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      });

      // Parse the JSON response
      const contextText = response.content[0].text;
      const contextJson = this.extractJsonFromText(contextText);
      
      // Save the context to a file
      const contextPath = path.join(contextDir, 'initial_context.json');
      await fs.writeFile(contextPath, JSON.stringify(contextJson, null, 2));
      
      // Return only the new state properties to be merged with existing state
      return { 
        initialContext: contextJson,
        contextPath,
        success: true,
        initialContextComplete: true
      };
    } catch (error) {
      return { 
        error: `Initial context extraction failed: ${error.message}`,
        initialContextComplete: false
      };
    }
  }

  /**
   * Creates a prompt for Claude to extract context from OCR text
   * @param {string} combinedText - The combined OCR text from multiple pages
   * @returns {string} - The prompt for Claude
   */
  createContextExtractionPrompt(combinedText) {
    return `
You are an expert document analyzer. I'm going to provide you with OCR text extracted from the first few pages of a document.
Your task is to analyze this text and extract key contextual information about the document.

Please analyze the text and provide the following information in JSON format:
1. documentType: The type of document (e.g., novel, textbook, manual, report, etc.)
2. title: The title of the document if present
3. authors: An array of authors if present
4. publicationDate: The publication date if present
5. language: The primary language of the document
6. keyCharacters: An array of key characters or entities mentioned (for fiction) or key concepts (for non-fiction)
7. keyLocations: An array of important locations mentioned
8. documentStyle: A brief description of the writing style (formal, informal, technical, narrative, etc.)
9. summary: A brief summary of what the document appears to be about based on these initial pages
10. structuralElements: An array of structural elements observed (chapters, sections, footnotes, etc.)

Here is the OCR text from the first few pages:

${combinedText}

Please respond with ONLY a valid JSON object containing the requested information. If you're uncertain about any field, use null for that field rather than guessing.
`;
  }

  /**
   * Extracts JSON from Claude's text response
   * @param {string} text - The text response from Claude
   * @returns {object} - The extracted JSON object
   */
  extractJsonFromText(text) {
    try {
      // Try to find JSON in the text using regex
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, return a default object
      return {
        documentType: null,
        title: null,
        authors: [],
        publicationDate: null,
        language: 'English',
        keyCharacters: [],
        keyLocations: [],
        documentStyle: null,
        summary: null,
        structuralElements: []
      };
    } catch (error) {
      console.error('Error parsing JSON from Claude response:', error);
      return {
        documentType: null,
        title: null,
        authors: [],
        publicationDate: null,
        language: 'English',
        keyCharacters: [],
        keyLocations: [],
        documentStyle: null,
        summary: null,
        structuralElements: []
      };
    }
  }
}();
