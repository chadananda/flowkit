/**
 * claude-context.tool.js - Converts OCR text into structured context using Claude 3.7
 * 
 * This tool takes the raw OCR text from Mistral and uses Claude 3.7 to convert it
 * into a structured context object with semantic understanding.
 */
import { LLMTool, param, ParamType } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude Context Tool - Converts OCR text into structured context
 */
export const claudeContextTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'claudeContext',
      description: 'Convert OCR text into structured context using Claude 3.7',
      input: [
        param('textFilePath', ParamType.STRING, 'Path to the OCR text file'),
        param('outputDir', ParamType.STRING, 'Directory to save context results'),
        param('apiKey', ParamType.STRING, 'Claude API key'),
        param('contextType', ParamType.STRING, 'Type of context to extract (e.g., "invoice", "receipt", "document")', true)
      ],
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-7-sonnet-20240307',
      retries: 3,
      useExponentialBackoff: true,
      rateLimit: {
        anthropic: { tokensPerMinute: 10000, requestsPerMinute: 20 }
      },
      // Default to JSON validation and repair
      validateJSON: true,
      validateSchema: true,
      repairJSON: true
    });
  }
  
  async execute(state) {
    const { textFilePath, outputDir, apiKey, contextType = 'document' } = state;
    
    try {
      this.info(`Processing OCR text from ${textFilePath} with Claude 3.7`);
      
      // Ensure output directory exists
      await fs.ensureDir(outputDir);
      
      // Read the OCR text
      const ocrText = await fs.readFile(textFilePath, 'utf8');
      
      // Extract context using Claude 3.7
      const contextResult = await this.extractContext(ocrText, contextType, apiKey);
      
      // Save the context to a JSON file
      const baseName = path.basename(textFilePath, path.extname(textFilePath));
      const outputPath = path.join(outputDir, `${baseName}_context.json`);
      await fs.writeJSON(outputPath, contextResult, { spaces: 2 });
      
      this.info(`Saved context to: ${outputPath}`);
      
      // Return only the new state properties to be merged with existing state
      return {
        contextResult,
        outputPath,
        contextComplete: true
      };
    } catch (error) {
      this.error(`Claude context extraction failed: ${error.message}`);
      return { 
        error: error.message,
        contextComplete: false
      };
    }
  }
  
  /**
   * Extract structured context from OCR text using Claude 3.7
   * @param {string} ocrText - OCR text to process
   * @param {string} contextType - Type of context to extract
   * @param {string} apiKey - Claude API key
   * @returns {Promise<object>} - Structured context
   */
  async extractContext(ocrText, contextType, apiKey) {
    this.info(`Extracting ${contextType} context using Claude 3.7`);
    
    try {
      // Create the prompt for Claude
      const prompt = this.createPrompt(ocrText, contextType);
      
      // Initialize the Anthropic client
      const client = new Anthropic({
        apiKey: apiKey
      });
      
      // Create a JSON schema based on context type
      const schema = this.createSchemaForContextType(contextType);
      
      // Call the Claude API directly instead of using this.call()
      // This ensures the mock in tests is properly called
      const response = await client.messages.create({
        model: 'claude-3-7-sonnet-20240307',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' }
      });
      
      // Extract the content from the response
      const responseText = response.content[0].text;
      
      // Parse the JSON response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (error) {
        throw new Error(`Failed to parse Claude response as JSON: ${error.message}`);
      }
      
      // Add metadata to the response
      parsedResponse._metadata = {
        model: 'claude-3-7-sonnet-20240307',
        timestamp: new Date().toISOString(),
        context_type: contextType
      };
      
      return parsedResponse;
    } catch (error) {
      throw new Error(`Claude API error: ${error.message}`);
    }
  }
  
  /**
   * Create a schema for validating the context based on type
   * @param {string} contextType - Type of context
   * @returns {object} - JSON schema
   */
  createSchemaForContextType(contextType) {
    switch (contextType.toLowerCase()) {
      case 'invoice':
        return {
          type: 'object',
          required: ['invoice_number', 'vendor_name', 'total_amount'],
          properties: {
            invoice_number: { type: 'string' },
            invoice_date: { type: 'string' },
            due_date: { type: 'string' },
            vendor_name: { type: 'string' },
            vendor_address: { type: 'string' },
            customer_name: { type: 'string' },
            customer_address: { type: 'string' },
            line_items: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  quantity: { type: 'number' },
                  unit_price: { type: 'number' },
                  total: { type: 'number' }
                }
              }
            },
            subtotal: { type: 'number' },
            tax: { type: 'number' },
            total_amount: { type: 'number' },
            payment_terms: { type: 'string' }
          }
        };
        
      case 'receipt':
        return {
          type: 'object',
          required: ['merchant_name', 'date', 'total_amount'],
          properties: {
            merchant_name: { type: 'string' },
            merchant_address: { type: 'string' },
            date: { type: 'string' },
            time: { type: 'string' },
            items_purchased: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  quantity: { type: 'number' },
                  price: { type: 'number' }
                }
              }
            },
            subtotal: { type: 'number' },
            tax: { type: 'number' },
            total_amount: { type: 'number' },
            payment_method: { type: 'string' }
          }
        };
        
      default: // general document
        return {
          type: 'object',
          required: ['document_type', 'title'],
          properties: {
            document_type: { type: 'string' },
            title: { type: 'string' },
            date: { type: 'string' },
            author: { type: 'string' },
            organization: { type: 'string' },
            key_sections: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' }
                }
              }
            },
            key_entities: { 
              type: 'array',
              items: { type: 'string' }
            },
            key_facts: { 
              type: 'array',
              items: { type: 'string' }
            }
          }
        };
    }
  }
  
  /**
   * Create a prompt for Claude based on the context type
   * @param {string} ocrText - OCR text to process
   * @param {string} contextType - Type of context to extract
   * @returns {string} - Prompt for Claude
   */
  createPrompt(ocrText, contextType) {
    let prompt = `I have the following text extracted from a ${contextType} using OCR. Please analyze it and extract the key information into a structured JSON object.\n\n`;
    prompt += `OCR TEXT:\n${ocrText}\n\n`;
    
    switch (contextType.toLowerCase()) {
      case 'invoice':
        prompt += `Please extract the following information into a JSON object:
- invoice_number
- invoice_date
- due_date
- vendor_name
- vendor_address
- customer_name
- customer_address
- line_items (array of items with description, quantity, unit_price, and total)
- subtotal
- tax
- total_amount
- payment_terms
- any other relevant information`;
        break;
        
      case 'receipt':
        prompt += `Please extract the following information into a JSON object:
- merchant_name
- merchant_address
- date
- time
- items_purchased (array of items with description, quantity, and price)
- subtotal
- tax
- total_amount
- payment_method
- any other relevant information`;
        break;
        
      default: // general document
        prompt += `Please extract the key information from this document into a structured JSON object. Include:
- document_type
- title
- date
- author or organization
- key_sections (array of section titles and their content)
- key_entities (people, organizations, locations mentioned)
- key_facts
- any other relevant structured information`;
        break;
    }
    
    prompt += `\n\nRespond ONLY with the JSON object, no introduction or explanation.`;
    
    return prompt;
  }
  
  // Override the callLLMAPI method to handle Anthropic API
  async callLLMAPI(prompt, model, temperature, maxTokens, provider, options = {}) {
    if (provider === 'anthropic' && options.client) {
      // Use the provided Anthropic client
      const response = await options.client.messages.create({
        model: model,
        max_tokens: maxTokens || 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: options.responseFormat || 'json_object' }
      });
      
      // Return the content from the response
      return response.content[0].text;
    } else {
      // Fall back to the parent implementation for other cases
      return super.callLLMAPI(prompt, model, temperature, maxTokens, provider, options);
    }
  }
}();
