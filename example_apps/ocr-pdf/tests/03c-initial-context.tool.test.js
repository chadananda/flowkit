/**
 * 03c-initial-context.tool.test.js - Tests for the Initial Context tool
 * 
 * This file contains tests for the Initial Context tool, which extracts key context
 * information from the first pages of a document using Tesseract OCR and Claude 3.7.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initialContextTool } from '../tools/03c-initial-context.tool.js';
import fs from 'fs-extra';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import Tesseract from 'node-tesseract-ocr';

// Mock Tesseract OCR
vi.mock('node-tesseract-ocr', () => {
  return {
    default: {
      recognize: vi.fn().mockResolvedValue('This is sample OCR text from a document page. It contains information about characters and locations.')
    }
  };
});

// Mock Anthropic (Claude)
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [
              {
                text: `{
                  "documentType": "Novel",
                  "title": "Sample Document",
                  "authors": ["John Doe"],
                  "publicationDate": "2023",
                  "language": "English",
                  "keyCharacters": ["Character A", "Character B"],
                  "keyLocations": ["Location X", "Location Y"],
                  "documentStyle": "Narrative",
                  "summary": "A sample document for testing purposes.",
                  "structuralElements": ["Chapters", "Sections"]
                }`
              }
            ]
          })
        }
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
    pathExists: vi.fn().mockResolvedValue(true)
  };
});

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-api-key' };
});

afterEach(() => {
  process.env = originalEnv;
  vi.clearAllMocks();
});

describe('Initial Context Tool', () => {
  let tempDirs;
  let testPdfPath;
  
  beforeEach(async () => {
    // Setup test directories
    tempDirs = {
      root: path.join(process.cwd(), 'test-temp-initial-context'),
      rawPages: path.join(process.cwd(), 'test-temp-initial-context', 'raw_pages'),
      ocrResults: path.join(process.cwd(), 'test-temp-initial-context', 'ocr_results'),
      jsonResults: path.join(process.cwd(), 'test-temp-initial-context', 'json_results')
    };
    
    // Create a simple test PDF file path
    testPdfPath = path.join(tempDirs.rawPages, 'test.pdf');
  });
  
  it('should extract initial context from document pages', async () => {
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
    
    const result = await initialContextTool.call({
      pageFiles,
      tempDirs
    });
    
    // Check the result
    expect(result).not.toHaveProperty('error');
    expect(result).toHaveProperty('initialContext');
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('initialContextComplete', true);
    expect(result).toHaveProperty('contextPath');
    
    // Verify that input properties are not in the result (state accumulation model)
    expect(result).not.toHaveProperty('pageFiles');
    expect(result).not.toHaveProperty('tempDirs');
    
    // Check initial context properties
    expect(result.initialContext).toHaveProperty('documentType', 'Novel');
    expect(result.initialContext).toHaveProperty('title', 'Sample Document');
    expect(result.initialContext).toHaveProperty('authors');
    expect(result.initialContext.authors).toContain('John Doe');
    expect(result.initialContext).toHaveProperty('keyCharacters');
    expect(result.initialContext.keyCharacters).toHaveLength(2);
    
    // Verify that Tesseract was called
    expect(Tesseract.recognize).toHaveBeenCalledTimes(2);
    
    // Verify that Claude was called
    expect(Anthropic).toHaveBeenCalledWith({
      apiKey: 'test-api-key'
    });
    
    // Verify that files were created
    expect(fs.ensureDir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledTimes(2); // combined text and context JSON
  });
  
  it('should handle missing API key gracefully', async () => {
    // Remove API key from environment
    delete process.env.ANTHROPIC_API_KEY;
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await initialContextTool.call({
      pageFiles,
      tempDirs
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('initialContextComplete', false);
    expect(result.error).toContain('ANTHROPIC_API_KEY environment variable is required');
  });
  
  it('should handle invalid page files gracefully', async () => {
    const result = await initialContextTool.call({
      pageFiles: 'not-an-array',
      tempDirs
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('initialContextComplete', false);
    expect(result.error).toContain('Invalid page files: must be an array');
  });
  
  it('should handle missing tempDirs gracefully', async () => {
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await initialContextTool.call({
      pageFiles
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('initialContextComplete', false);
    expect(result.error).toContain('Temporary directories are required');
  });
  
  it('should handle OCR errors gracefully', async () => {
    // Mock OCR error
    Tesseract.recognize.mockRejectedValueOnce(new Error('OCR error'));
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await initialContextTool.call({
      pageFiles,
      tempDirs
    });
    
    // The tool should still succeed with the remaining pages
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('initialContextComplete', true);
    expect(result).toHaveProperty('initialContext');
  });
  
  it('should handle Claude API errors gracefully', async () => {
    // Mock Claude API error
    const anthropicInstance = Anthropic.mock.results[0].value;
    anthropicInstance.messages.create.mockRejectedValueOnce(new Error('API error'));
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await initialContextTool.call({
      pageFiles,
      tempDirs
    });
    
    // Check that the error was handled correctly
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('initialContextComplete', false);
    expect(result.error).toContain('Initial context extraction failed');
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
      extraProperty: 'should be preserved',
      splitComplete: true
    };
    
    // Call the tool with the initial state
    const toolResult = await initialContextTool.call(initialState);
    
    // Simulate how Flow would merge the result
    const mergedState = { ...initialState, ...toolResult };
    
    // Verify that the original properties are preserved
    expect(mergedState).toHaveProperty('pageFiles');
    expect(mergedState).toHaveProperty('tempDirs');
    expect(mergedState).toHaveProperty('extraProperty', 'should be preserved');
    expect(mergedState).toHaveProperty('splitComplete', true);
    
    // And that the new properties are added
    expect(mergedState).toHaveProperty('initialContext');
    expect(mergedState).toHaveProperty('contextPath');
    expect(mergedState).toHaveProperty('success', true);
    expect(mergedState).toHaveProperty('initialContextComplete', true);
  });
  
  it('should handle JSON parsing errors gracefully', async () => {
    // Mock invalid JSON response from Claude
    const anthropicInstance = Anthropic.mock.results[0].value;
    anthropicInstance.messages.create.mockResolvedValueOnce({
      content: [
        {
          text: 'This is not valid JSON'
        }
      ]
    });
    
    const pageFiles = [
      {
        pageNumber: 1,
        path: testPdfPath
      }
    ];
    
    const result = await initialContextTool.call({
      pageFiles,
      tempDirs
    });
    
    // The tool should still succeed with a default context object
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('initialContextComplete', true);
    expect(result).toHaveProperty('initialContext');
    expect(result.initialContext).toHaveProperty('documentType', null);
    expect(result.initialContext).toHaveProperty('language', 'English');
  });
});
