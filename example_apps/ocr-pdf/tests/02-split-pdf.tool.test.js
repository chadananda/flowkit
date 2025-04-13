/**
 * 02-split-pdf.tool.test.js - Tests for the split PDF tool
 * 
 * This file contains tests for the split PDF tool, which splits a PDF into individual pages.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { splitPDFTool } from '../tools/02-split-pdf.tool.js';
import fs from 'fs-extra';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

describe('Split PDF Tool', () => {
  let tempDirs;
  let testPdfPath;
  
  beforeEach(async () => {
    // Create temporary directories for testing
    tempDirs = {
      root: path.join(process.cwd(), 'test-temp'),
      rawPages: path.join(process.cwd(), 'test-temp', 'raw_pages'),
      ocrResults: path.join(process.cwd(), 'test-temp', 'ocr_results')
    };
    
    await fs.ensureDir(tempDirs.root);
    await fs.ensureDir(tempDirs.rawPages);
    await fs.ensureDir(tempDirs.ocrResults);
    
    // Create a simple test PDF
    testPdfPath = path.join(tempDirs.root, 'test.pdf');
    
    // Create a PDF with 3 pages
    const pdfDoc = await PDFDocument.create();
    
    // Add 3 blank pages
    pdfDoc.addPage([500, 700]);
    pdfDoc.addPage([500, 700]);
    pdfDoc.addPage([500, 700]);
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(testPdfPath, pdfBytes);
  });
  
  afterEach(async () => {
    // Clean up temporary directories
    if (tempDirs && tempDirs.root) {
      await fs.remove(tempDirs.root);
    }
  });
  
  it('should split a PDF into individual pages', async () => {
    const result = await splitPDFTool.call({
      inputPath: testPdfPath,
      tempDirs
    });
    
    // Check the result
    expect(result).toHaveProperty('pageFiles');
    expect(result).toHaveProperty('pageCount', 3);
    expect(result).toHaveProperty('splitComplete', true);
    expect(result.pageFiles).toHaveLength(3);
    
    // Verify that inputPath and tempDirs are not in the result (state accumulation model)
    expect(result).not.toHaveProperty('inputPath');
    expect(result).not.toHaveProperty('tempDirs');
    
    // Check that the page files were created
    for (let i = 0; i < 3; i++) {
      const pageFile = result.pageFiles[i];
      expect(pageFile).toHaveProperty('index', i);
      expect(pageFile).toHaveProperty('pageNumber', i + 1);
      expect(pageFile).toHaveProperty('path');
      
      // Check that the file exists
      expect(await fs.pathExists(pageFile.path)).toBe(true);
      
      // Check that the file is a valid PDF
      const fileContent = await fs.readFile(pageFile.path);
      const pdfDoc = await PDFDocument.load(fileContent);
      expect(pdfDoc.getPageCount()).toBe(1);
    }
  });
  
  it('should handle errors during PDF loading', async () => {
    // Create an invalid PDF file
    const invalidPdfPath = path.join(tempDirs.root, 'invalid.pdf');
    await fs.writeFile(invalidPdfPath, 'This is not a valid PDF');
    
    const result = await splitPDFTool.call({
      inputPath: invalidPdfPath,
      tempDirs
    });
    
    // Check that the error was handled
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('splitComplete', false);
    expect(result.error).toContain('Failed to parse');
  });
  
  it('should handle missing input path', async () => {
    const result = await splitPDFTool.call({
      tempDirs
    });
    
    expect(result).toHaveProperty('error', 'Input path is required');
    expect(result).toHaveProperty('splitComplete', false);
  });
  
  it('should handle missing tempDirs', async () => {
    const result = await splitPDFTool.call({
      inputPath: testPdfPath
    });
    
    expect(result).toHaveProperty('error', 'Temporary directories are required');
    expect(result).toHaveProperty('splitComplete', false);
  });
  
  it('should work with the state accumulation model', async () => {
    // Test with additional state properties
    const initialState = {
      inputPath: testPdfPath,
      tempDirs,
      extraProperty: 'should be preserved',
      setupComplete: true
    };
    
    // Call the tool with the initial state
    const toolResult = await splitPDFTool.call(initialState);
    
    // Simulate how Flow would merge the result
    const mergedState = { ...initialState, ...toolResult };
    
    // Verify that the original properties are preserved
    expect(mergedState).toHaveProperty('inputPath', testPdfPath);
    expect(mergedState).toHaveProperty('tempDirs', tempDirs);
    expect(mergedState).toHaveProperty('extraProperty', 'should be preserved');
    expect(mergedState).toHaveProperty('setupComplete', true);
    
    // And that the new properties are added
    expect(mergedState).toHaveProperty('pageFiles');
    expect(mergedState).toHaveProperty('pageCount', 3);
    expect(mergedState).toHaveProperty('splitComplete', true);
  });
});
