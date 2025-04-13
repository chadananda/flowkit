/**
 * 10-cleanup.tool.js - Remove temporary files and directories
 * 
 * This tool removes all temporary files and directories created during processing
 * to reclaim disk space and maintain system health.
 */
import { Tool } from '../../../flowlite.js';
import fs from 'fs-extra';

export const cleanupTool = new class extends Tool {
  constructor() {
    super({
      name: 'cleanup',
      description: 'Remove temporary files and directories',
      input: [
        { name: 'tempDirs', description: 'Temporary directories to clean up' },
        { name: 'keepTemp', description: 'Whether to keep temporary files', default: false }
      ],
      output: [
        { name: 'success', description: 'Whether cleanup was successful' },
        { name: 'kept', description: 'Whether temporary files were kept' }
      ]
    });
  }

  async execute({ tempDirs, keepTemp = false, ...rest }) {
    // If keepTemp is true or tempDirs is missing, skip cleanup
    if (keepTemp || !tempDirs || !tempDirs.root) {
      return { 
        success: true, 
        kept: true,
        ...rest
      };
    }
    
    try {
      this.info(`Cleaning up temporary directory: ${tempDirs.root}`);
      
      // Remove the root temporary directory and all its contents
      await fs.remove(tempDirs.root);
      
      this.info(`Successfully removed temporary directory: ${tempDirs.root}`);
      
      return { 
        success: true, 
        kept: false,
        ...rest
      };
    } catch (error) {
      this.error(`Failed to remove temporary directory: ${error.message}`);
      
      return { 
        success: false, 
        error: `Failed to remove temporary directory: ${error.message}`,
        kept: true,
        ...rest
      };
    }
  }
}();
