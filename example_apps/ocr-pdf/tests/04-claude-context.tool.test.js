/**
 * 04-claude-context.tool.test.js - Tests for the Claude Context tool
 * 
 * This file contains tests for the Claude Context tool, which converts OCR text
 * into structured context using Claude 3.7.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { claudeContextTool } from '../tools/04-claude-context.tool.js';
import fs from 'fs-extra';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

// Create a mock messages.create function that can be configured for each test
const mockMessagesCreate = vi.fn();

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        messages: {
          create: mockMessagesCreate
        }
      };
    })
  };
});

describe('Claude Context Tool', () => {
  let tempDirs;
  let testOcrTextPath;
  let persistentOutputDir;
  
  beforeEach(async () => {
    // Create temporary directories for testing
    tempDirs = {
      root: path.join(process.cwd(), 'test-temp-context'),
      ocrResults: path.join(process.cwd(), 'test-temp-context', 'ocr_results'),
      contextResults: path.join(process.cwd(), 'test-temp-context', 'context_results')
    };
    
    // Create persistent output directory
    persistentOutputDir = path.join(process.cwd(), 'tests', 'output');
    
    await fs.ensureDir(tempDirs.root);
    await fs.ensureDir(tempDirs.ocrResults);
    await fs.ensureDir(tempDirs.contextResults);
    await fs.ensureDir(persistentOutputDir);
    
    // Create a sample OCR text file
    testOcrTextPath = path.join(tempDirs.ocrResults, 'page_1.txt');
    await fs.writeFile(testOcrTextPath, `
      INVOICE
      
      Invoice Number: INV-12345
      Date: 2023-05-15
      
      Bill To:
      Acme Corporation
      123 Main Street
      Anytown, CA 12345
      
      Description                     Qty    Rate    Amount
      -----------------------------------------------------
      Web Development Services        40     $75     $3,000
      UI/UX Design                    20     $85     $1,700
      Server Maintenance              10     $95     $950
      
      Subtotal: $5,650
      Tax (8%): $452
      Total: $6,102
      
      Payment Terms: Net 30
      Due Date: 2023-06-14
    `);
    
    // Reset mock for each test
    vi.clearAllMocks();
    
    // Default successful response
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          text: JSON.stringify({
            invoiceNumber: 'INV-12345',
            date: '2023-05-15',
            dueDate: '2023-06-14',
            vendor: {
              name: 'Unknown',
              address: 'Unknown'
            },
            client: {
              name: 'Acme Corporation',
              address: '123 Main Street, Anytown, CA 12345'
            },
            items: [
              {
                description: 'Web Development Services',
                quantity: 40,
                rate: 75,
                amount: 3000
              },
              {
                description: 'UI/UX Design',
                quantity: 20,
                rate: 85,
                amount: 1700
              },
              {
                description: 'Server Maintenance',
                quantity: 10,
                rate: 95,
                amount: 950
              }
            ],
            subtotal: 5650,
            tax: 452,
            total: 6102,
            paymentTerms: 'Net 30'
          })
        }
      ]
    });
  });
  
  afterEach(async () => {
    // Clean up temporary directories
    if (tempDirs && tempDirs.root) {
      await fs.remove(tempDirs.root);
    }
    // Note: We don't clean up the persistent output directory
  });
  
  it('should convert OCR text into structured context using Claude 3.7', async () => {
    const textFilePath = testOcrTextPath;
    const outputDir = tempDirs.contextResults;
    const apiKey = 'test-api-key';
    const contextType = 'invoice';
    
    const result = await claudeContextTool.call({
      textFilePath,
      outputDir,
      apiKey,
      contextType
    });
    
    // Check the result
    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('contextResult');
    expect(result).toHaveProperty('outputPath');
    expect(result).toHaveProperty('contextComplete', true);
    
    // Verify that input properties are not in the result (state accumulation model)
    expect(result).not.toHaveProperty('textFilePath');
    expect(result).not.toHaveProperty('outputDir');
    expect(result).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('contextType');
    
    // Check context properties
    expect(result.contextResult).toHaveProperty('invoiceNumber', 'INV-12345');
    expect(result.contextResult).toHaveProperty('date', '2023-05-15');
    expect(result.contextResult).toHaveProperty('client');
    expect(result.contextResult.client).toHaveProperty('name', 'Acme Corporation');
    
    // Check that the file was created
    expect(await fs.pathExists(result.outputPath)).toBe(true);
    
    // Copy the result to the persistent output directory
    const persistentJsonPath = path.join(persistentOutputDir, 'claude_context_result.json');
    await fs.copyFile(result.outputPath, persistentJsonPath);
    
    console.log(`\nPersistent output file saved for viewing:`);
    console.log(`- JSON file: ${persistentJsonPath}`);
  });
  
  it('should handle API errors gracefully', async () => {
    // Mock API error by rejecting the messages.create method for this test only
    mockMessagesCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));
    
    const textFilePath = testOcrTextPath;
    const outputDir = tempDirs.contextResults;
    const apiKey = 'test-api-key';
    const contextType = 'invoice';
    
    const result = await claudeContextTool.call({
      textFilePath,
      outputDir,
      apiKey,
      contextType
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('contextComplete', false);
    expect(result.error).toContain('API rate limit exceeded');
    
    // Save error information to persistent output
    const errorLogPath = path.join(persistentOutputDir, 'claude_api_error.txt');
    await fs.writeFile(errorLogPath, `Error during Claude context extraction: ${result.error}`);
    
    console.log(`\nAPI error log saved to: ${errorLogPath}`);
  });
  
  it('should handle file read errors gracefully', async () => {
    const nonExistentPath = path.join(tempDirs.ocrResults, 'non-existent.txt');
    
    const textFilePath = nonExistentPath;
    const outputDir = tempDirs.contextResults;
    const apiKey = 'test-api-key';
    const contextType = 'invoice';
    
    const result = await claudeContextTool.call({
      textFilePath,
      outputDir,
      apiKey,
      contextType
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('contextComplete', false);
    expect(result.error).toContain('ENOENT'); // No such file or directory
    
    // Save error information to persistent output
    const errorLogPath = path.join(persistentOutputDir, 'claude_file_error.txt');
    await fs.writeFile(errorLogPath, `Error during Claude context extraction: ${result.error}`);
    
    console.log(`\nFile error log saved to: ${errorLogPath}`);
  });
  
  it('should handle different context types appropriately', async () => {
    // Set up a different mock response for document context
    mockMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          text: JSON.stringify({
            document_type: 'Invoice',
            title: 'Sales Invoice INV-12345',
            date: '2023-05-15',
            organization: 'Unknown Vendor',
            key_sections: [
              {
                title: 'Billing Information',
                content: 'Acme Corporation, 123 Main Street, Anytown, CA 12345'
              },
              {
                title: 'Services',
                content: 'Web Development, UI/UX Design, Server Maintenance'
              },
              {
                title: 'Payment Details',
                content: 'Total: $6,102, Payment Terms: Net 30, Due Date: 2023-06-14'
              }
            ],
            key_entities: [
              'Acme Corporation'
            ],
            key_facts: [
              'Invoice total is $6,102',
              'Payment is due on 2023-06-14',
              'Services include web development, design, and maintenance'
            ]
          })
        }
      ]
    });
    
    const textFilePath = testOcrTextPath;
    const outputDir = tempDirs.contextResults;
    const apiKey = 'test-api-key';
    const contextType = 'document'; // Using document context type
    
    const result = await claudeContextTool.call({
      textFilePath,
      outputDir,
      apiKey,
      contextType
    });
    
    // Check that the document context was extracted correctly
    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('contextResult');
    expect(result).toHaveProperty('outputPath');
    expect(result).toHaveProperty('contextComplete', true);
    
    // Check document context properties
    expect(result.contextResult).toHaveProperty('document_type', 'Invoice');
    expect(result.contextResult).toHaveProperty('key_sections');
    expect(result.contextResult).toHaveProperty('key_entities');
    expect(result.contextResult).toHaveProperty('key_facts');
    
    // Copy the result to the persistent output directory
    const persistentJsonPath = path.join(persistentOutputDir, 'claude_document_context.json');
    await fs.copyFile(result.outputPath, persistentJsonPath);
    
    console.log(`\nDocument context saved to: ${persistentJsonPath}`);
  });
  
  it('should work with the state accumulation model', async () => {
    // Test with additional state properties
    const initialState = {
      textFilePath: testOcrTextPath,
      outputDir: tempDirs.contextResults,
      apiKey: 'test-api-key',
      contextType: 'invoice',
      extraProperty: 'should be preserved',
      ocrComplete: true,
      pageNumber: 1
    };
    
    // Call the tool with the initial state
    const toolResult = await claudeContextTool.call(initialState);
    
    // Simulate how Flow would merge the result
    const mergedState = { ...initialState, ...toolResult };
    
    // Verify that the original properties are preserved
    expect(mergedState).toHaveProperty('textFilePath', testOcrTextPath);
    expect(mergedState).toHaveProperty('outputDir', tempDirs.contextResults);
    expect(mergedState).toHaveProperty('apiKey', 'test-api-key');
    expect(mergedState).toHaveProperty('contextType', 'invoice');
    expect(mergedState).toHaveProperty('extraProperty', 'should be preserved');
    expect(mergedState).toHaveProperty('ocrComplete', true);
    expect(mergedState).toHaveProperty('pageNumber', 1);
    
    // And that the new properties are added
    expect(mergedState).toHaveProperty('contextResult');
    expect(mergedState).toHaveProperty('outputPath');
    expect(mergedState).toHaveProperty('contextComplete', true);
  });
});
