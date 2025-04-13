/**
 * 03b-abbyy-ocr.tool.test.js - Tests for the ABBYY OCR tool
 * 
 * This file contains tests for the ABBYY OCR tool, which extracts text from PDF pages
 * using ABBYY Cloud OCR SDK.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { abbyyOCRTool } from '../tools/03b-abbyy-ocr.tool.js';
import fs from 'fs-extra';
import path from 'path';

// Mock the ABBYY OCR client
vi.mock('abbyy-ocr-ts', () => {
  return {
    createClient: vi.fn().mockImplementation(() => {
      return {
        processImage: vi.fn().mockResolvedValue({
          waitForCompletion: vi.fn().mockResolvedValue({
            downloadUrl: vi.fn().mockImplementation((format) => {
              if (format === 'txtFile') {
                return Promise.resolve('This is the OCR text extracted by ABBYY Cloud OCR from the PDF document.');
              } else if (format === 'xmlFile') {
                return Promise.resolve('<xml>Sample XML result</xml>');
              }
              return Promise.resolve('');
            })
          })
        })
      };
    })
  };
});

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  process.env = { 
    ...originalEnv, 
    ABBYY_API_KEY: 'test-api-key',
    ABBYY_APPLICATION_ID: 'test-app-id'
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('ABBYY OCR Tool', () => {
  let tempDirs;
  let testPdfPath;
  let persistentOutputDir;
  
  beforeEach(async () => {
    // Create temporary directories for testing
    tempDirs = {
      root: path.join(process.cwd(), 'test-temp-abbyy-ocr'),
      rawPages: path.join(process.cwd(), 'test-temp-abbyy-ocr', 'raw_pages'),
      ocrResults: path.join(process.cwd(), 'test-temp-abbyy-ocr', 'ocr_results')
    };
    
    // Create persistent output directory
    persistentOutputDir = path.join(process.cwd(), 'tests', 'output');
    
    await fs.ensureDir(tempDirs.root);
    await fs.ensureDir(tempDirs.rawPages);
    await fs.ensureDir(tempDirs.ocrResults);
    await fs.ensureDir(persistentOutputDir);
    
    // Create a simple test PDF file
    testPdfPath = path.join(tempDirs.rawPages, 'test.pdf');
    await fs.writeFile(testPdfPath, '%PDF-1.5\nTest PDF content');
    
    // Reset mocks
    vi.clearAllMocks();
  });
  
  afterEach(async () => {
    // Clean up temporary directories
    if (tempDirs && tempDirs.root) {
      await fs.remove(tempDirs.root);
    }
    // Note: We don't clean up the persistent output directory
  });
  
  it('should extract text from PDF pages using ABBYY OCR', async () => {
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      },
      {
        pageNumber: 2,
        path: testPdfPath
      }
    ];
    
    const result = await abbyyOCRTool.call({
      pageFiles,
      tempDirs,
      initialContext: { title: 'Test Document' }
    });
    
    // Check the result
    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('ocrResults');
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('abbyyComplete', true);
    
    // Verify that input properties are not in the result (state accumulation model)
    expect(result).not.toHaveProperty('pageFiles');
    expect(result).not.toHaveProperty('tempDirs');
    expect(result).not.toHaveProperty('initialContext');
    
    // Check OCR results
    expect(result.ocrResults).toHaveLength(2);
    expect(result.ocrResults[0]).toHaveProperty('pageNumber', 1);
    expect(result.ocrResults[0]).toHaveProperty('engine', 'abbyy');
    expect(result.ocrResults[0]).toHaveProperty('textFilePath');
    expect(result.ocrResults[0]).toHaveProperty('xmlFilePath');
    expect(result.ocrResults[0]).toHaveProperty('success', true);
    
    // Check that the files were created
    expect(await fs.pathExists(result.ocrResults[0].textFilePath)).toBe(true);
    expect(await fs.pathExists(result.ocrResults[0].xmlFilePath)).toBe(true);
    
    // Verify text file content
    const textContent = await fs.readFile(result.ocrResults[0].textFilePath, 'utf8');
    expect(textContent).toBe('This is the OCR text extracted by ABBYY Cloud OCR from the PDF document.');
    
    // Verify XML file content
    const xmlContent = await fs.readFile(result.ocrResults[0].xmlFilePath, 'utf8');
    expect(xmlContent).toBe('<xml>Sample XML result</xml>');
  });
  
  it('should handle missing API key gracefully', async () => {
    // Remove API key from environment
    delete process.env.ABBYY_API_KEY;
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await abbyyOCRTool.call({
      pageFiles,
      tempDirs
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('abbyyComplete', false);
    expect(result.error).toContain('ABBYY_API_KEY environment variable is required');
  });
  
  it('should handle missing application ID gracefully', async () => {
    // Remove application ID from environment
    delete process.env.ABBYY_APPLICATION_ID;
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await abbyyOCRTool.call({
      pageFiles,
      tempDirs
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('abbyyComplete', false);
    expect(result.error).toContain('ABBYY_APPLICATION_ID environment variable is required');
  });
  
  it('should handle invalid page files gracefully', async () => {
    const result = await abbyyOCRTool.call({
      pageFiles: 'not-an-array',
      tempDirs
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('abbyyComplete', false);
    expect(result.error).toContain('Invalid page files: must be an array');
  });
  
  it('should handle missing tempDirs gracefully', async () => {
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await abbyyOCRTool.call({
      pageFiles
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('abbyyComplete', false);
    expect(result.error).toContain('Temporary directories are required');
  });
  
  it('should handle API errors gracefully', async () => {
    // Mock API error
    const { createClient } = await import('abbyy-ocr-ts');
    createClient.mockImplementationOnce(() => {
      return {
        processImage: vi.fn().mockRejectedValue(new Error('API error'))
      };
    });
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await abbyyOCRTool.call({
      pageFiles,
      tempDirs
    });
    
    // The tool should still return a result with the error in the page result
    expect(result).toHaveProperty('ocrResults');
    expect(result.ocrResults[0]).toHaveProperty('error');
    expect(result.ocrResults[0]).toHaveProperty('success', false);
    expect(result.ocrResults[0].error).toContain('API error');
  });
  
  it('should work with the state accumulation model', async () => {
    // Test with additional state properties
    const initialState = {
      pageFiles: [
        {
          pageNumber: 1,
          path: testPdfPath
        }
      ],
      tempDirs,
      initialContext: { title: 'Test Document' },
      extraProperty: 'should be preserved',
      splitComplete: true
    };
    
    // Call the tool with the initial state
    const toolResult = await abbyyOCRTool.call(initialState);
    
    // Simulate how Flow would merge the result
    const mergedState = { ...initialState, ...toolResult };
    
    // Verify that the original properties are preserved
    expect(mergedState).toHaveProperty('pageFiles');
    expect(mergedState).toHaveProperty('tempDirs');
    expect(mergedState).toHaveProperty('initialContext');
    expect(mergedState).toHaveProperty('extraProperty', 'should be preserved');
    expect(mergedState).toHaveProperty('splitComplete', true);
    
    // And that the new properties are added
    expect(mergedState).toHaveProperty('ocrResults');
    expect(mergedState).toHaveProperty('success', true);
    expect(mergedState).toHaveProperty('abbyyComplete', true);
  });
});
