/**
 * 07-cleanup.tool.js - Clean up temporary files and directories
 * 
 * This tool handles the cleanup of temporary files and directories created
 * during the OCR processing flow. It can either remove all temporary files
 * or keep them for debugging purposes.
 */
import { Tool } from '../../../flowlite.js';
import fs from 'fs-extra';

export const cleanupTool = new class extends Tool {
  constructor() {
    super({
      name: 'cleanup',
      description: 'Clean up temporary files and directories',
      input: [
        { name: 'tempDirs', description: 'Temporary directories to clean up' },
        { name: 'keepTemp', description: 'Whether to keep temporary files' }
      ],
      output: [
        { name: 'success', description: 'Whether cleanup was successful' },
        { name: 'kept', description: 'Whether temporary files were kept' }
      ]
    });
  }

  async execute(state) {
    const { tempDirs, keepTemp } = state;
    
    // If keepTemp is true or tempDirs is missing, skip cleanup
    if (keepTemp || !tempDirs || !tempDirs.root) {
      return { 
        success: true, 
        kept: true,
        cleanupComplete: true
      };
    }
    
    try {
      await fs.remove(tempDirs.root);
      return { 
        success: true, 
        kept: false,
        cleanupComplete: true
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to remove temporary directory: ${error.message}`,
        kept: true,
        cleanupComplete: false
      };
    }
  }
}();
