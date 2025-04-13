/**
 * setup.tool.js - Creates directories for OCR processing
 * 
 * This tool creates the necessary directory structure for OCR processing,
 * including temporary directories for raw pages, OCR results, and output.
 */
import { Tool, param, ParamType } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import { temporaryDirectory } from 'tempy';

/**
 * Setup Tool - Creates temporary working directories for processing
 */
export const setupTool = new class extends Tool {
  constructor() {
    super({
      name: 'setup',
      description: 'Create temporary working directories for processing',
      input: [
        param('inputPath', ParamType.STRING, 'Path to input PDF file')
      ]
    });
  }
  
  async execute(state) {
    const { inputPath, ...rest } = state;
    
    try {
      if (!inputPath) {
        return { 
          error: 'Input path is required',
          setupComplete: false
        };
      }
      
      this.info(`Setting up temporary directories for ${inputPath}`);
      
      // Create a unique temporary directory
      const tempDir = temporaryDirectory();
      
      // Create subdirectories for different processing stages
      const dirs = {
        root: tempDir,
        rawPages: path.join(tempDir, 'raw_pages'),
        ocrResults: path.join(tempDir, 'ocr_results'),
        jsonResults: path.join(tempDir, 'json_results'),
        reconciledResults: path.join(tempDir, 'reconciled_results'),
        markdownPages: path.join(tempDir, 'md_pages'),
        finalOutput: path.join(tempDir, 'output')
      };
      
      // Create all directories
      for (const dir of Object.values(dirs)) {
        await fs.ensureDir(dir);
      }
      
      this.info(`Created temporary directories at ${tempDir}`);
      
      // Return only the new state properties to be merged with existing state
      return { 
        tempDirs: dirs,
        fileName: path.basename(inputPath, '.pdf'),
        setupComplete: true
      };
    } catch (error) {
      this.error(`Setup failed: ${error.message}`);
      return { 
        error: error.message,
        setupComplete: false
      };
    }
  }
}();
