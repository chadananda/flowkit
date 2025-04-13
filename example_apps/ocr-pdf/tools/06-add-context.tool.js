/**
 * 06-add-context.tool.js - Add semantic context tags to markdown files
 * 
 * This tool enhances the markdown by adding semantic context tags for:
 * - Entity and reference disambiguation
 * - Merging split paragraphs across pages
 * - Adding page position references
 * 
 * Tag Types:
 * - Page numbers: <pg num="10" />
 * - PDF positions: <pdf pg="3" />
 * - Entity disambiguation: <ctx data="Hussein Khan, the leader of the rebellion" />
 * - Location references: <ctx data="Isfahan" />
 * - Temporal references: <ctx data="June 12, 1845" />
 */
import { LLMTool } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

export const addContextTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'addContext',
      description: 'Add semantic context tags to markdown files',
      input: [
        { name: 'ocrResults', description: 'Array of OCR results for each page' },
        { name: 'reconciledPages', description: 'Array of reconciled page results' },
        { name: 'initialContext', description: 'Initial context information about the document' },
        { name: 'tempDirs', description: 'Temporary directories for processing' }
      ],
      output: [
        { name: 'enhancedPages', description: 'Array of pages with enhanced context' }
      ]
    });
  }

  async execute({ ocrResults, reconciledPages, initialContext, tempDirs, ...rest }) {
    if (!reconciledPages || !Array.isArray(reconciledPages)) {
      return { 
        error: 'Invalid reconciled pages: must be an array',
        ...rest
      };
    }

    if (!initialContext) {
      return { 
        error: 'Initial context is required',
        ...rest
      };
    }

    if (!tempDirs) {
      return { 
        error: 'Temporary directories are required',
        ...rest
      };
    }

    try {
      // Get API key from environment variables
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      
      if (!anthropicApiKey) {
        return { 
          error: 'ANTHROPIC_API_KEY environment variable is required',
          ...rest
        };
      }

      // Initialize Claude client
      const anthropic = new Anthropic({
        apiKey: anthropicApiKey
      });

      // Create output directory for enhanced markdown
      const enhancedDir = path.join(tempDirs.markdownPages);
      await fs.ensureDir(enhancedDir);

      // Process each reconciled page
      const enhancedPromises = reconciledPages.map(async (page) => {
        try {
          if (!page.success || !page.reconciled) {
            return {
              ...page,
              enhanced: false,
              enhancementError: 'Page was not successfully reconciled'
            };
          }

          // Read the reconciled text
          const reconciledText = await fs.readFile(page.reconciledTextFilePath, 'utf8');
          
          // Get adjacent pages for context (if available)
          const prevPageNum = page.pageNumber - 1;
          const nextPageNum = page.pageNumber + 1;
          
          let prevPageText = '';
          let nextPageText = '';
          
          // Find previous page
          const prevPage = reconciledPages.find(p => p.pageNumber === prevPageNum && p.reconciled);
          if (prevPage) {
            prevPageText = await fs.readFile(prevPage.reconciledTextFilePath, 'utf8');
          }
          
          // Find next page
          const nextPage = reconciledPages.find(p => p.pageNumber === nextPageNum && p.reconciled);
          if (nextPage) {
            nextPageText = await fs.readFile(nextPage.reconciledTextFilePath, 'utf8');
          }
          
          // Create the prompt for Claude
          const prompt = this.createContextEnhancementPrompt(
            reconciledText, 
            prevPageText, 
            nextPageText, 
            page.pageNumber, 
            initialContext
          );
          
          // Call Claude to enhance the text with context tags
          const response = await anthropic.messages.create({
            model: 'claude-3-7-sonnet',
            max_tokens: 4000,
            messages: [
              { role: 'user', content: prompt }
            ],
            temperature: 0.2
          });

          // Extract the enhanced text
          const enhancedText = response.content[0].text;
          
          // Save the enhanced text to a file
          const enhancedFilePath = path.join(enhancedDir, `page_${page.pageNumber}.md`);
          await fs.writeFile(enhancedFilePath, enhancedText);
          
          // Return the updated page object
          return {
            ...page,
            enhanced: true,
            enhancedTextFilePath: enhancedFilePath,
            enhancementMetadata: {
              model: 'claude-3-7-sonnet',
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          return {
            ...page,
            enhanced: false,
            enhancementError: error.message
          };
        }
      });

      // Wait for all pages to be processed
      const enhancedPages = await Promise.all(enhancedPromises);
      
      return {
        enhancedPages,
        success: true,
        ...rest
      };
    } catch (error) {
      return {
        error: `Context enhancement failed: ${error.message}`,
        success: false,
        ...rest
      };
    }
  }

  /**
   * Creates a prompt for Claude to enhance text with context tags
   * @param {string} text - The reconciled text to enhance
   * @param {string} prevPageText - Text from the previous page
   * @param {string} nextPageText - Text from the next page
   * @param {number} pageNumber - The current page number
   * @param {object} initialContext - Initial context information
   * @returns {string} - The prompt for Claude
   */
  createContextEnhancementPrompt(text, prevPageText, nextPageText, pageNumber, initialContext) {
    return `
You are an expert document enhancer. I'm going to provide you with text from page ${pageNumber} of a document, along with text from adjacent pages and context information about the document.

Your task is to enhance the text by adding semantic context tags for:
1. Entity and reference disambiguation
2. Merging split paragraphs across pages
3. Adding page position references

Here are the tag types you should use:
- Page numbers: <pg num="10" />
- PDF positions: <pdf pg="3" />
- Entity disambiguation: <ctx data="Hussein Khan, the leader of the rebellion" />
- Location references: <ctx data="Isfahan" />
- Temporal references: <ctx data="June 12, 1845" />

Document Context Information:
${JSON.stringify(initialContext, null, 2)}

Previous Page Text:
${prevPageText || 'No previous page available'}

Current Page Text (Page ${pageNumber}):
${text}

Next Page Text:
${nextPageText || 'No next page available'}

Please enhance the current page text with appropriate context tags. Make sure to:
1. Add page number tags at the beginning of the text
2. Identify entities, locations, and temporal references and add context tags
3. Check for paragraphs that might be split across pages and handle them appropriately
4. Preserve the original text structure and formatting

Return ONLY the enhanced text with tags, no explanations or comments.
`;
  }
}();
