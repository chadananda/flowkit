/**
 * 03a-google-vision-ocr.tool.test.js - Tests for the Google Vision OCR tool
 * 
 * This file contains tests for the Google Vision OCR tool, which extracts text from PDF pages
 * using Google Cloud Vision API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { googleVisionOCRTool } from '../tools/03a-google-vision-ocr.tool.js';
import fs from 'fs-extra';
import path from 'path';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Mock the Google Cloud Vision client
vi.mock('@google-cloud/vision', () => {
  return {
    ImageAnnotatorClient: vi.fn().mockImplementation(() => {
      return {
        textDetection: vi.fn().mockResolvedValue([
          {
            textAnnotations: [
              {
                description: 'This is the OCR text extracted by Google Cloud Vision from the PDF document.'
              }
            ]
          }
        ])
      };
    })
  };
});

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv, GOOGLE_CLOUD_VISION_KEY: 'test-key.json' };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('Google Vision OCR Tool', () => {
  let tempDirs;
  let testPdfPath;
  let persistentOutputDir;
  
  beforeEach(async () => {
    // Create temporary directories for testing
    tempDirs = {
      root: path.join(process.cwd(), 'test-temp-google-ocr'),
      rawPages: path.join(process.cwd(), 'test-temp-google-ocr', 'raw_pages'),
      ocrResults: path.join(process.cwd(), 'test-temp-google-ocr', 'ocr_results')
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
  
  it('should extract text from PDF pages using Google Cloud Vision', async () => {
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
    
    const result = await googleVisionOCRTool.call({
      pageFiles,
      tempDirs,
      initialContext: { title: 'Test Document' }
    });
    
    // Check that ImageAnnotatorClient was instantiated with the correct key
    expect(ImageAnnotatorClient).toHaveBeenCalledWith({
      keyFilename: 'test-key.json'
    });
    
    // Check the result
    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('ocrResults');
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('googleVisionComplete', true);
    
    // Verify that input properties are not in the result (state accumulation model)
    expect(result).not.toHaveProperty('pageFiles');
    expect(result).not.toHaveProperty('tempDirs');
    expect(result).not.toHaveProperty('initialContext');
    
    // Check OCR results
    expect(result.ocrResults).toHaveLength(2);
    expect(result.ocrResults[0]).toHaveProperty('pageNumber', 1);
    expect(result.ocrResults[0]).toHaveProperty('engine', 'google');
    expect(result.ocrResults[0]).toHaveProperty('textFilePath');
    expect(result.ocrResults[0]).toHaveProperty('jsonFilePath');
    expect(result.ocrResults[0]).toHaveProperty('success', true);
    
    // Check that the files were created
    expect(await fs.pathExists(result.ocrResults[0].textFilePath)).toBe(true);
    expect(await fs.pathExists(result.ocrResults[0].jsonFilePath)).toBe(true);
    
    // Verify text file content
    const textContent = await fs.readFile(result.ocrResults[0].textFilePath, 'utf8');
    expect(textContent).toBe('This is the OCR text extracted by Google Cloud Vision from the PDF document.');
  });
  
  it('should handle missing API key gracefully', async () => {
    // Remove API key from environment
    delete process.env.GOOGLE_CLOUD_VISION_KEY;
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await googleVisionOCRTool.call({
      pageFiles,
      tempDirs
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('googleVisionComplete', false);
    expect(result.error).toContain('GOOGLE_CLOUD_VISION_KEY environment variable is required');
  });
  
  it('should handle invalid page files gracefully', async () => {
    const result = await googleVisionOCRTool.call({
      pageFiles: 'not-an-array',
      tempDirs
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('googleVisionComplete', false);
    expect(result.error).toContain('Invalid page files: must be an array');
  });
  
  it('should handle missing tempDirs gracefully', async () => {
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await googleVisionOCRTool.call({
      pageFiles
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('googleVisionComplete', false);
    expect(result.error).toContain('Temporary directories are required');
  });
  
  it('should handle API errors gracefully', async () => {
    // Mock API error
    ImageAnnotatorClient.mockImplementationOnce(() => {
      return {
        textDetection: vi.fn().mockRejectedValue(new Error('API error'))
      };
    });
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await googleVisionOCRTool.call({
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
    const toolResult = await googleVisionOCRTool.call(initialState);
    
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
    expect(mergedState).toHaveProperty('googleVisionComplete', true);
  });
});
