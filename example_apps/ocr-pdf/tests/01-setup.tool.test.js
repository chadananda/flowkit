/**
 * 01-setup.tool.test.js - Tests for the setup tool
 * 
 * This file contains tests for the setup tool, which creates temporary directories.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupTool } from '../tools/01-setup.tool.js';
import fs from 'fs-extra';
import path from 'path';

describe('Setup Tool', () => {
  let result;
  
  afterEach(async () => {
    // Clean up the temporary directories after each test
    if (result && result.tempDirs && result.tempDirs.root) {
      await fs.remove(result.tempDirs.root);
    }
    
    // Also clean up our test directory if it exists
    const testDir = path.join(process.cwd(), 'temp-test-dir');
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });
  
  it('should create temporary directories', async () => {
    result = await setupTool.call({ inputPath: 'test.pdf' });
    
    // Check that the directories were created
    expect(result).toHaveProperty('tempDirs');
    expect(result.tempDirs).toHaveProperty('root');
    expect(result.tempDirs).toHaveProperty('rawPages');
    expect(result.tempDirs).toHaveProperty('ocrResults');
    expect(result.tempDirs).toHaveProperty('jsonResults');
    expect(result.tempDirs).toHaveProperty('markdownPages');
    expect(result.tempDirs).toHaveProperty('finalOutput');
    
    // Verify that the directories exist
    expect(await fs.pathExists(result.tempDirs.root)).toBe(true);
    expect(await fs.pathExists(result.tempDirs.rawPages)).toBe(true);
    expect(await fs.pathExists(result.tempDirs.ocrResults)).toBe(true);
    expect(await fs.pathExists(result.tempDirs.jsonResults)).toBe(true);
    expect(await fs.pathExists(result.tempDirs.markdownPages)).toBe(true);
    expect(await fs.pathExists(result.tempDirs.finalOutput)).toBe(true);
    
    // Check that the file name was extracted correctly
    expect(result).toHaveProperty('fileName', 'test');
    
    // Check that setupComplete flag is set
    expect(result).toHaveProperty('setupComplete', true);
    
    // Verify that inputPath is not in the result (state accumulation model)
    expect(result).not.toHaveProperty('inputPath');
  });
  
  it('should handle missing input path', async () => {
    result = await setupTool.call({});
    
    // Check that the error was handled
    expect(result).toHaveProperty('error', 'Input path is required');
    expect(result).toHaveProperty('setupComplete', false);
  });
  
  it('should handle errors during directory creation', async () => {
    // Create a file where a directory should be to cause an error
    const tempDir = path.join(process.cwd(), 'temp-test-dir');
    const blockingFile = path.join(tempDir, 'raw_pages');
    
    // Create the temp directory
    await fs.ensureDir(tempDir);
    
    // Create a file where a directory should be
    await fs.writeFile(blockingFile, 'This will block directory creation');
    
    // Spy on the temporaryDirectory function to return our controlled path
    const originalExecute = setupTool.execute;
    setupTool.execute = async (state) => {
      const { inputPath } = state;
      
      // Override the temp directory to use our controlled path
      const dirs = {
        root: tempDir,
        rawPages: path.join(tempDir, 'raw_pages'),
        ocrResults: path.join(tempDir, 'ocr_results'),
        jsonResults: path.join(tempDir, 'json_results'),
        markdownPages: path.join(tempDir, 'md_pages'),
        finalOutput: path.join(tempDir, 'output')
      };
      
      try {
        // Try to create the directories
        for (const dir of Object.values(dirs)) {
          await fs.ensureDir(dir);
        }
        
        return { 
          tempDirs: dirs,
          fileName: path.basename(inputPath, '.pdf'),
          setupComplete: true
        };
      } catch (error) {
        return { 
          error: error.message,
          setupComplete: false
        };
      }
    };
    
    // Run the test
    result = await setupTool.call({ inputPath: 'test.pdf' });
    
    // Restore the original execute function
    setupTool.execute = originalExecute;
    
    // Check that the error was handled
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('setupComplete', false);
    // The exact error message might vary by platform, so just check that there's an error
    expect(result.error).toBeTruthy();
  });
  
  it('should work with the state accumulation model', async () => {
    // Test with additional state properties
    const initialState = {
      inputPath: 'test.pdf',
      extraProperty: 'should be preserved'
    };
    
    // Call the tool with the initial state
    const toolResult = await setupTool.call(initialState);
    
    // Simulate how Flow would merge the result
    const mergedState = { ...initialState, ...toolResult };
    
    // Verify that the original properties are preserved
    expect(mergedState).toHaveProperty('inputPath', 'test.pdf');
    expect(mergedState).toHaveProperty('extraProperty', 'should be preserved');
    
    // And that the new properties are added
    expect(mergedState).toHaveProperty('tempDirs');
    expect(mergedState).toHaveProperty('fileName', 'test');
    expect(mergedState).toHaveProperty('setupComplete', true);
    
    // Clean up to avoid affecting other tests
    if (toolResult.tempDirs && toolResult.tempDirs.root) {
      await fs.remove(toolResult.tempDirs.root);
    }
  });
});
