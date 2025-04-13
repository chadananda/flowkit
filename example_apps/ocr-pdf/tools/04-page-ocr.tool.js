/**
 * 04-page-ocr.tool.js - Process pages with multiple OCR engines in parallel
 * 
 * This tool processes PDF pages through three different OCR engines in parallel:
 * 1. Google Cloud Vision
 * 2. ABBYY Cloud OCR
 * 3. Mistral AI Vision
 * 
 * It stores the results as JSON and generates initial markdown versions.
 */
import { Tool } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { createClient } from 'abbyy-ocr-ts';
import { MistralClient } from '@mistralai/mistralai';

export const pageOCRTool = new class extends Tool {
  constructor() {
    super({
      name: 'pageOCR',
      description: 'Process PDF pages with multiple OCR engines in parallel',
      input: [
        { name: 'pageFiles', description: 'Array of page files to process' },
        { name: 'tempDirs', description: 'Temporary directories for processing' },
        { name: 'initialContext', description: 'Initial context information about the document' }
      ],
      output: [
        { name: 'ocrResults', description: 'Array of OCR results for each page from multiple engines' }
      ]
    });
  }

  async execute(state) {
    const { pageFiles, tempDirs, initialContext } = state;
    
    if (!pageFiles || !Array.isArray(pageFiles)) {
      return { 
        error: 'Invalid page files: must be an array',
        pageOcrComplete: false
      };
    }

    if (!tempDirs) {
      return { 
        error: 'Temporary directories are required',
        pageOcrComplete: false
      };
    }

    try {
      // Get API keys from environment variables
      const googleCloudVisionKey = process.env.GOOGLE_CLOUD_VISION_KEY;
      const abbyyApiKey = process.env.ABBYY_API_KEY;
      const abbyyApplicationId = process.env.ABBYY_APPLICATION_ID;
      const mistralApiKey = process.env.MISTRAL_API_KEY;
      
      // Check for required API keys
      const missingKeys = [];
      if (!googleCloudVisionKey) missingKeys.push('GOOGLE_CLOUD_VISION_KEY');
      if (!abbyyApiKey) missingKeys.push('ABBYY_API_KEY');
      if (!abbyyApplicationId) missingKeys.push('ABBYY_APPLICATION_ID');
      if (!mistralApiKey) missingKeys.push('MISTRAL_API_KEY');
      
      if (missingKeys.length > 0) {
        return { 
          error: `Missing required API keys: ${missingKeys.join(', ')}`,
          pageOcrComplete: false
        };
      }

      // Initialize clients for each OCR engine
      const googleClient = new ImageAnnotatorClient({
        keyFilename: googleCloudVisionKey
      });
      
      const abbyyClient = createClient({
        applicationId: abbyyApplicationId,
        password: abbyyApiKey
      });
      
      const mistralClient = new MistralClient({
        apiKey: mistralApiKey
      });

      // Process each page with all OCR engines in parallel
      const pagePromises = pageFiles.map(async (pageFile) => {
        try {
          // Create output directories for this page
          const pageOcrDir = path.join(tempDirs.ocrResults, `page_${pageFile.pageNumber}`);
          const googleDir = path.join(pageOcrDir, 'google');
          const abbyyDir = path.join(pageOcrDir, 'abbyy');
          const mistralDir = path.join(pageOcrDir, 'mistral');
          
          await fs.ensureDir(googleDir);
          await fs.ensureDir(abbyyDir);
          await fs.ensureDir(mistralDir);
          
          // Process the page with all OCR engines in parallel
          const [googleResult, abbyyResult, mistralResult] = await Promise.all([
            this.processWithGoogleVision(pageFile, googleDir, googleClient),
            this.processWithAbbyy(pageFile, abbyyDir, abbyyClient),
            this.processWithMistral(pageFile, mistralDir, mistralClient)
          ]);
          
          // Generate initial markdown for each engine
          await this.generateMarkdown(pageFile, googleResult, abbyyResult, mistralResult, pageOcrDir);
          
          // Return the combined results
          return {
            pageNumber: pageFile.pageNumber,
            google: googleResult,
            abbyy: abbyyResult,
            mistral: mistralResult,
            success: googleResult.success || abbyyResult.success || mistralResult.success
          };
        } catch (error) {
          return {
            pageNumber: pageFile.pageNumber,
            error: error.message,
            success: false
          };
        }
      });
      
      const ocrResults = await Promise.all(pagePromises);
      
      // Check if any pages were successfully processed
      const anySuccess = ocrResults.some(result => result.success);
      
      // Return only the new state properties to be merged with existing state
      return { 
        ocrResults,
        success: anySuccess,
        pageOcrComplete: true
      };
    } catch (error) {
      return { 
        error: `Page OCR processing failed: ${error.message}`,
        pageOcrComplete: false
      };
    }
  }

  /**
   * Process a page with Google Cloud Vision
   * @param {object} pageFile - The page file to process
   * @param {string} outputDir - The output directory for results
   * @param {object} client - The Google Cloud Vision client
   * @returns {object} - The OCR result
   */
  async processWithGoogleVision(pageFile, outputDir, client) {
    try {
      // Run OCR on the image
      const [result] = await client.textDetection(pageFile.path);
      const detections = result.textAnnotations;
      const text = detections.length > 0 ? detections[0].description : '';
      
      // Save the OCR text to a file
      const textFilePath = path.join(outputDir, `text.txt`);
      await fs.writeFile(textFilePath, text);
      
      // Save the OCR JSON to a file
      const jsonFilePath = path.join(outputDir, `result.json`);
      await fs.writeFile(jsonFilePath, JSON.stringify(detections, null, 2));
      
      return {
        engine: 'google',
        textFilePath,
        jsonFilePath,
        success: true
      };
    } catch (error) {
      return {
        engine: 'google',
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Process a page with ABBYY Cloud OCR
   * @param {object} pageFile - The page file to process
   * @param {string} outputDir - The output directory for results
   * @param {object} client - The ABBYY Cloud OCR client
   * @returns {object} - The OCR result
   */
  async processWithAbbyy(pageFile, outputDir, client) {
    try {
      // Read the PDF file
      const fileContent = await fs.readFile(pageFile.path);
      
      // Process the file with ABBYY
      const task = await client.processImage({
        fileContent,
        exportFormats: {
          txtFile: true,
          xmlFile: true
        },
        language: 'English',
        profile: 'documentConversion'
      });
      
      // Wait for the task to complete
      const result = await task.waitForCompletion();
      
      // Download the results
      const txtResult = await result.downloadUrl('txtFile');
      const xmlResult = await result.downloadUrl('xmlFile');
      
      // Save the OCR text to a file
      const textFilePath = path.join(outputDir, `text.txt`);
      await fs.writeFile(textFilePath, txtResult);
      
      // Save the OCR XML to a file
      const xmlFilePath = path.join(outputDir, `result.xml`);
      await fs.writeFile(xmlFilePath, xmlResult);
      
      return {
        engine: 'abbyy',
        textFilePath,
        xmlFilePath,
        success: true
      };
    } catch (error) {
      return {
        engine: 'abbyy',
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Process a page with Mistral AI Vision
   * @param {object} pageFile - The page file to process
   * @param {string} outputDir - The output directory for results
   * @param {object} client - The Mistral AI client
   * @returns {object} - The OCR result
   */
  async processWithMistral(pageFile, outputDir, client) {
    try {
      // Convert PDF to base64
      const pdfBuffer = await fs.readFile(pageFile.path);
      const base64Pdf = pdfBuffer.toString('base64');
      
      // Create the prompt for Mistral
      const prompt = `Extract all the text from this PDF page. Return only the extracted text, no explanations or comments.`;
      
      // Call Mistral Vision API
      const response = await client.chat({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image: base64Pdf }
            ]
          }
        ],
        temperature: 0.0,
        max_tokens: 4000
      });
      
      // Extract the text from the response
      const text = response.choices[0].message.content;
      
      // Save the OCR text to a file
      const textFilePath = path.join(outputDir, `text.txt`);
      await fs.writeFile(textFilePath, text);
      
      // Save the OCR JSON to a file
      const jsonFilePath = path.join(outputDir, `result.json`);
      await fs.writeFile(jsonFilePath, JSON.stringify(response, null, 2));
      
      return {
        engine: 'mistral',
        textFilePath,
        jsonFilePath,
        success: true
      };
    } catch (error) {
      return {
        engine: 'mistral',
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Generate initial markdown for each page
   * @param {object} pageFile - The page file
   * @param {object} googleResult - The Google OCR result
   * @param {object} abbyyResult - The ABBYY OCR result
   * @param {object} mistralResult - The Mistral OCR result
   * @param {string} outputDir - The output directory
   */
  async generateMarkdown(pageFile, googleResult, abbyyResult, mistralResult, outputDir) {
    try {
      const mdDir = path.join(outputDir, 'md');
      await fs.ensureDir(mdDir);
      
      // Generate markdown for each engine
      if (googleResult.success) {
        const text = await fs.readFile(googleResult.textFilePath, 'utf8');
        const mdContent = `# Page ${pageFile.pageNumber} - Google OCR\n\n${text}`;
        await fs.writeFile(path.join(mdDir, 'google.md'), mdContent);
      }
      
      if (abbyyResult.success) {
        const text = await fs.readFile(abbyyResult.textFilePath, 'utf8');
        const mdContent = `# Page ${pageFile.pageNumber} - ABBYY OCR\n\n${text}`;
        await fs.writeFile(path.join(mdDir, 'abbyy.md'), mdContent);
      }
      
      if (mistralResult.success) {
        const text = await fs.readFile(mistralResult.textFilePath, 'utf8');
        const mdContent = `# Page ${pageFile.pageNumber} - Mistral OCR\n\n${text}`;
        await fs.writeFile(path.join(mdDir, 'mistral.md'), mdContent);
      }
      
      return true;
    } catch (error) {
      console.error(`Error generating markdown: ${error.message}`);
      return false;
    }
  }
}();
