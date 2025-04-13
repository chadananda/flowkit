/**
 * 07-cleanup.tool.test.js - Tests for the cleanup tool
 * 
 * This file contains tests for the cleanup tool, which removes temporary directories
 * after processing is complete.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupTool } from '../tools/07-cleanup.tool.js';
import fs from 'fs-extra';
import path from 'path';

describe('Cleanup Tool', () => {
  let tempDirs;
  
  beforeEach(async () => {
    // Create temporary directories for testing
    tempDirs = {
      root: path.join(process.cwd(), 'test-temp-cleanup'),
      rawPages: path.join(process.cwd(), 'test-temp-cleanup', 'raw_pages'),
      ocrResults: path.join(process.cwd(), 'test-temp-cleanup', 'ocr_results')
    };
    
    await fs.ensureDir(tempDirs.root);
    await fs.ensureDir(tempDirs.rawPages);
    await fs.ensureDir(tempDirs.ocrResults);
    
    // Create a test file in the directory
    await fs.writeFile(path.join(tempDirs.rawPages, 'test.txt'), 'Test content');
  });
  
  afterEach(async () => {
    // Clean up any remaining directories
    if (await fs.pathExists(tempDirs.root)) {
      await fs.remove(tempDirs.root);
    }
  });
  
  it('should remove temporary directories when keepTemp is false', async () => {
    // Verify directories exist before cleanup
    expect(await fs.pathExists(tempDirs.root)).toBe(true);
    expect(await fs.pathExists(tempDirs.rawPages)).toBe(true);
    
    const result = await cleanupTool.call({
      tempDirs,
      keepTemp: false
    });
    
    // Check the result
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('kept', false);
    expect(result).toHaveProperty('cleanupComplete', true);
    
    // Verify that input properties are not in the result (state accumulation model)
    expect(result).not.toHaveProperty('tempDirs');
    expect(result).not.toHaveProperty('keepTemp');
    
    // Verify directories were removed
    expect(await fs.pathExists(tempDirs.root)).toBe(false);
  });
  
  it('should keep temporary directories when keepTemp is true', async () => {
    const result = await cleanupTool.call({
      tempDirs,
      keepTemp: true
    });
    
    // Check the result
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('kept', true);
    expect(result).toHaveProperty('cleanupComplete', true);
    
    // Verify directories still exist
    expect(await fs.pathExists(tempDirs.root)).toBe(true);
    expect(await fs.pathExists(tempDirs.rawPages)).toBe(true);
  });
  
  it('should handle missing tempDirs gracefully', async () => {
    const result = await cleanupTool.call({
      keepTemp: false
    });
    
    // Check the result
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('kept', true);
    expect(result).toHaveProperty('cleanupComplete', true);
  });
  
  it('should handle errors during directory removal', async () => {
    // Mock fs.remove to throw an error
    const originalRemove = fs.remove;
    fs.remove = vi.fn().mockRejectedValue(new Error('Permission denied'));
    
    const result = await cleanupTool.call({
      tempDirs,
      keepTemp: false
    });
    
    // Restore original function
    fs.remove = originalRemove;
    
    // Check the result
    expect(result).toHaveProperty('success', false);
    expect(result).toHaveProperty('kept', true);
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('cleanupComplete', false);
    expect(result.error).toContain('Permission denied');
  });
  
  it('should work with the state accumulation model', async () => {
    // Test with additional state properties
    const initialState = {
      tempDirs,
      keepTemp: false,
      extraProperty: 'should be preserved',
      contextComplete: true
    };
    
    // Call the tool with the initial state
    const toolResult = await cleanupTool.call(initialState);
    
    // Simulate how Flow would merge the result
    const mergedState = { ...initialState, ...toolResult };
    
    // Verify that the original properties are preserved
    expect(mergedState).toHaveProperty('tempDirs', tempDirs);
    expect(mergedState).toHaveProperty('keepTemp', false);
    expect(mergedState).toHaveProperty('extraProperty', 'should be preserved');
    expect(mergedState).toHaveProperty('contextComplete', true);
    
    // And that the new properties are added
    expect(mergedState).toHaveProperty('success', true);
    expect(mergedState).toHaveProperty('kept', false);
    expect(mergedState).toHaveProperty('cleanupComplete', true);
  });
});
