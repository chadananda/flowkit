/**
 * 04-page-ocr.tool.test.js - Tests for the Page OCR tool
 * 
 * This file contains tests for the Page OCR tool, which processes PDF pages through
 * multiple OCR engines in parallel (Google Cloud Vision, ABBYY, and Mistral).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pageOCRTool } from '../tools/04-page-ocr.tool.js';
import fs from 'fs-extra';
import path from 'path';

// Mock Google Cloud Vision client
vi.mock('@google-cloud/vision', () => {
  return {
    ImageAnnotatorClient: vi.fn().mockImplementation(() => {
      return {
        textDetection: vi.fn().mockResolvedValue([
          {
            textAnnotations: [
              {
                description: 'This is sample OCR text from Google Cloud Vision.'
              }
            ]
          }
        ])
      };
    })
  };
});

// Mock ABBYY OCR client
vi.mock('abbyy-ocr-ts', () => {
  return {
    createClient: vi.fn().mockImplementation(() => {
      return {
        processImage: vi.fn().mockResolvedValue({
          waitForCompletion: vi.fn().mockResolvedValue({
            downloadUrl: vi.fn().mockImplementation((format) => {
              if (format === 'txtFile') {
                return Promise.resolve('This is sample OCR text from ABBYY Cloud OCR.');
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

// Mock Mistral AI client
vi.mock('@mistralai/mistralai', () => {
  return {
    MistralClient: vi.fn().mockImplementation(() => {
      return {
        chat: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'This is sample OCR text from Mistral AI Vision.'
              }
            }
          ]
        })
      };
    })
  };
});

// Mock fs-extra
vi.mock('fs-extra', async () => {
  const actual = await vi.importActual('fs-extra');
  return {
    ...actual,
    ensureDir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockImplementation((path) => {
      if (path.endsWith('.pdf')) {
        return Promise.resolve(Buffer.from('Mock PDF content'));
      } else if (path.endsWith('google/text.txt')) {
        return Promise.resolve('This is sample OCR text from Google Cloud Vision.');
      } else if (path.endsWith('abbyy/text.txt')) {
        return Promise.resolve('This is sample OCR text from ABBYY Cloud OCR.');
      } else if (path.endsWith('mistral/text.txt')) {
        return Promise.resolve('This is sample OCR text from Mistral AI Vision.');
      }
      return Promise.resolve('');
    }),
    pathExists: vi.fn().mockResolvedValue(true)
  };
});

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  process.env = { 
    ...originalEnv, 
    GOOGLE_CLOUD_VISION_KEY: 'google-key.json',
    ABBYY_API_KEY: 'abbyy-api-key',
    ABBYY_APPLICATION_ID: 'abbyy-app-id',
    MISTRAL_API_KEY: 'mistral-api-key'
  };
});

afterEach(() => {
  process.env = originalEnv;
  vi.clearAllMocks();
});

describe('Page OCR Tool', () => {
  let tempDirs;
  let testPdfPath;
  
  beforeEach(async () => {
    // Setup test directories
    tempDirs = {
      root: path.join(process.cwd(), 'test-temp-page-ocr'),
      rawPages: path.join(process.cwd(), 'test-temp-page-ocr', 'raw_pages'),
      ocrResults: path.join(process.cwd(), 'test-temp-page-ocr', 'ocr_results'),
      jsonResults: path.join(process.cwd(), 'test-temp-page-ocr', 'json_results')
    };
    
    // Create a simple test PDF file path
    testPdfPath = path.join(tempDirs.rawPages, 'test.pdf');
  });
  
  it('should process pages with multiple OCR engines in parallel', async () => {
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
    
    const result = await pageOCRTool.call({
      pageFiles,
      tempDirs,
      initialContext: { title: 'Test Document' }
    });
    
    // Check the result
    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('ocrResults');
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('pageOcrComplete', true);
    
    // Verify that input properties are not in the result (state accumulation model)
    expect(result).not.toHaveProperty('pageFiles');
    expect(result).not.toHaveProperty('tempDirs');
    expect(result).not.toHaveProperty('initialContext');
    
    // Check OCR results
    expect(result.ocrResults).toHaveLength(2);
    expect(result.ocrResults[0]).toHaveProperty('pageNumber', 1);
    expect(result.ocrResults[0]).toHaveProperty('google');
    expect(result.ocrResults[0]).toHaveProperty('abbyy');
    expect(result.ocrResults[0]).toHaveProperty('mistral');
    expect(result.ocrResults[0]).toHaveProperty('success', true);
    
    // Check individual engine results
    expect(result.ocrResults[0].google).toHaveProperty('engine', 'google');
    expect(result.ocrResults[0].google).toHaveProperty('textFilePath');
    expect(result.ocrResults[0].google).toHaveProperty('jsonFilePath');
    expect(result.ocrResults[0].google).toHaveProperty('success', true);
    
    expect(result.ocrResults[0].abbyy).toHaveProperty('engine', 'abbyy');
    expect(result.ocrResults[0].abbyy).toHaveProperty('textFilePath');
    expect(result.ocrResults[0].abbyy).toHaveProperty('xmlFilePath');
    expect(result.ocrResults[0].abbyy).toHaveProperty('success', true);
    
    expect(result.ocrResults[0].mistral).toHaveProperty('engine', 'mistral');
    expect(result.ocrResults[0].mistral).toHaveProperty('textFilePath');
    expect(result.ocrResults[0].mistral).toHaveProperty('jsonFilePath');
    expect(result.ocrResults[0].mistral).toHaveProperty('success', true);
    
    // Verify that directories were created
    expect(fs.ensureDir).toHaveBeenCalledTimes(10); // 2 pages x 3 engines + 2 md dirs + 2 page dirs
    
    // Verify that files were written
    expect(fs.writeFile).toHaveBeenCalledTimes(14); // 2 pages x (3 engines x 2 files + 3 md files)
  });
  
  it('should handle missing API keys gracefully', async () => {
    // Remove API keys from environment
    delete process.env.GOOGLE_CLOUD_VISION_KEY;
    delete process.env.ABBYY_API_KEY;
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await pageOCRTool.call({
      pageFiles,
      tempDirs
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('pageOcrComplete', false);
    expect(result.error).toContain('Missing required API keys');
    expect(result.error).toContain('GOOGLE_CLOUD_VISION_KEY');
    expect(result.error).toContain('ABBYY_API_KEY');
  });
  
  it('should handle invalid page files gracefully', async () => {
    const result = await pageOCRTool.call({
      pageFiles: 'not-an-array',
      tempDirs
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('pageOcrComplete', false);
    expect(result.error).toContain('Invalid page files: must be an array');
  });
  
  it('should handle missing tempDirs gracefully', async () => {
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await pageOCRTool.call({
      pageFiles
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('pageOcrComplete', false);
    expect(result.error).toContain('Temporary directories are required');
  });
  
  it('should handle OCR engine errors gracefully', async () => {
    // Mock Google OCR error
    const { ImageAnnotatorClient } = await import('@google-cloud/vision');
    const googleInstance = ImageAnnotatorClient.mock.results[0].value;
    googleInstance.textDetection.mockRejectedValueOnce(new Error('Google API error'));
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await pageOCRTool.call({
      pageFiles,
      tempDirs
    });
    
    // The tool should still succeed with the remaining engines
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('pageOcrComplete', true);
    expect(result).toHaveProperty('ocrResults');
    expect(result.ocrResults[0].google).toHaveProperty('success', false);
    expect(result.ocrResults[0].google).toHaveProperty('error', 'Google API error');
    expect(result.ocrResults[0].abbyy).toHaveProperty('success', true);
    expect(result.ocrResults[0].mistral).toHaveProperty('success', true);
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
      splitComplete: true,
      initialContextComplete: true
    };
    
    // Call the tool with the initial state
    const toolResult = await pageOCRTool.call(initialState);
    
    // Simulate how Flow would merge the result
    const mergedState = { ...initialState, ...toolResult };
    
    // Verify that the original properties are preserved
    expect(mergedState).toHaveProperty('pageFiles');
    expect(mergedState).toHaveProperty('tempDirs');
    expect(mergedState).toHaveProperty('initialContext');
    expect(mergedState).toHaveProperty('extraProperty', 'should be preserved');
    expect(mergedState).toHaveProperty('splitComplete', true);
    expect(mergedState).toHaveProperty('initialContextComplete', true);
    
    // And that the new properties are added
    expect(mergedState).toHaveProperty('ocrResults');
    expect(mergedState).toHaveProperty('success', true);
    expect(mergedState).toHaveProperty('pageOcrComplete', true);
  });
  
  it('should handle all OCR engines failing gracefully', async () => {
    // Mock all OCR engines failing
    const { ImageAnnotatorClient } = await import('@google-cloud/vision');
    const googleInstance = ImageAnnotatorClient.mock.results[0].value;
    googleInstance.textDetection.mockRejectedValueOnce(new Error('Google API error'));
    
    const { createClient } = await import('abbyy-ocr-ts');
    const abbyyInstance = createClient.mock.results[0].value;
    abbyyInstance.processImage.mockRejectedValueOnce(new Error('ABBYY API error'));
    
    const { MistralClient } = await import('@mistralai/mistralai');
    const mistralInstance = MistralClient.mock.results[0].value;
    mistralInstance.chat.mockRejectedValueOnce(new Error('Mistral API error'));
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await pageOCRTool.call({
      pageFiles,
      tempDirs
    });
    
    // The tool should still return a result but with failures
    expect(result).toHaveProperty('success', false);
    expect(result).toHaveProperty('pageOcrComplete', true);
    expect(result).toHaveProperty('ocrResults');
    expect(result.ocrResults[0].google).toHaveProperty('success', false);
    expect(result.ocrResults[0].abbyy).toHaveProperty('success', false);
    expect(result.ocrResults[0].mistral).toHaveProperty('success', false);
  });
});
