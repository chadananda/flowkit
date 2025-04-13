/**
 * 06-generate-output.tool.js - Generate markdown and PDF output from processed pages
 * 
 * This tool takes the processed OCR and context results and generates:
 * 1. A structured markdown file with text and context information
 * 2. A searchable PDF with the extracted text
 */
import { Tool } from '../../../flowlite.js';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs-extra';
import path from 'path';

export const generateOutputTool = new class extends Tool {
  constructor() {
    super({
      name: 'generateOutput',
      description: 'Generate markdown and PDF output from processed pages',
      input: [
        { name: 'pageResults', description: 'Array of processed page results' },
        { name: 'inputPath', description: 'Path to input PDF' },
        { name: 'outputPath', description: 'Path to output PDF' },
        { name: 'tempDirs', description: 'Temporary directories for processing' }
      ],
      output: [
        { name: 'outputPath', description: 'Path to output PDF' },
        { name: 'markdownPath', description: 'Path to markdown output' }
      ]
    });
  }

  async execute({ reconciledPages, pageResults, inputPath, outputPath, tempDirs, ...rest }) {
    try {
      // Use reconciled pages if available, otherwise use page results
      const pagesToUse = reconciledPages || pageResults || [];

      if (!inputPath) {
        return { 
          error: 'Input path is required',
          ...rest
        };
      }

      if (!outputPath) {
        return { 
          error: 'Output path is required',
          ...rest
        };
      }

      // Generate markdown output
      const markdownPath = outputPath.replace(/\.pdf$/i, '.md');
      let markdownContent = `# ${path.basename(inputPath, '.pdf')}\n\n`;
      
      // Sort pages by page number
      const sortedPages = [...pagesToUse].sort((a, b) => 
        (a.pageNumber || 0) - (b.pageNumber || 0)
      );
      
      for (const page of sortedPages) {
        if (!page || !page.pageNumber) continue;
        
        markdownContent += `## Page ${page.pageNumber}\n\n`;
        
        if (page.reconciled) {
          // Add reconciled text
          try {
            const reconciledText = await fs.readFile(page.reconciledTextFilePath, 'utf8');
            markdownContent += `### Reconciled Text\n\n\`\`\`\n${reconciledText}\n\`\`\`\n\n`;
          } catch (error) {
            markdownContent += `### Reconciled Text\n\nError reading reconciled text: ${error.message}\n\n`;
          }
        } else if (page.ocrResult && page.ocrResult.textFilePath) {
          // Add OCR text if reconciled text is not available
          try {
            const ocrText = await fs.readFile(page.ocrResult.textFilePath, 'utf8');
            markdownContent += `### OCR Text\n\n\`\`\`\n${ocrText}\n\`\`\`\n\n`;
          } catch (error) {
            markdownContent += `### OCR Text\n\nError reading OCR text: ${error.message}\n\n`;
          }
        }
        
        // Add context information
        if (page.contextResult && page.contextResult.contextResult) {
          markdownContent += `### Context\n\n`;
          markdownContent += `Document Type: ${page.contextResult.contextResult.documentType || 'Unknown'}\n\n`;
          
          // Add summary if available
          if (page.contextResult.contextResult.summary) {
            markdownContent += `#### Summary\n\n${page.contextResult.contextResult.summary}\n\n`;
          }
          
          // Add entities if available
          if (page.contextResult.contextResult.entities && page.contextResult.contextResult.entities.length > 0) {
            markdownContent += `#### Entities\n\n`;
            for (const entity of page.contextResult.contextResult.entities) {
              markdownContent += `- **${entity.type}**: ${entity.value}\n`;
            }
            markdownContent += '\n';
          }
          
          // Add key facts if available
          if (page.contextResult.contextResult.key_facts && page.contextResult.contextResult.key_facts.length > 0) {
            markdownContent += `#### Key Facts\n\n`;
            for (const fact of page.contextResult.contextResult.key_facts) {
              markdownContent += `- ${fact}\n`;
            }
            markdownContent += '\n';
          }
        }
        
        markdownContent += '---\n\n';
      }
      
      // Write the markdown file
      await fs.writeFile(markdownPath, markdownContent);
      
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      
      // Add a page for each successfully processed page
      for (const page of sortedPages) {
        if (!page || !page.pageNumber) continue;
        
        // Get the text to use
        let textToUse = '';
        let textSource = '';
        
        if (page.reconciled && page.reconciledTextFilePath) {
          try {
            textToUse = await fs.readFile(page.reconciledTextFilePath, 'utf8');
            textSource = 'Reconciled';
          } catch (error) {
            // Fall back to OCR text
            if (page.ocrResult && page.ocrResult.textFilePath) {
              try {
                textToUse = await fs.readFile(page.ocrResult.textFilePath, 'utf8');
                textSource = 'OCR';
              } catch (error) {
                textToUse = `Error reading text: ${error.message}`;
                textSource = 'Error';
              }
            }
          }
        } else if (page.ocrResult && page.ocrResult.textFilePath) {
          try {
            textToUse = await fs.readFile(page.ocrResult.textFilePath, 'utf8');
            textSource = 'OCR';
          } catch (error) {
            textToUse = `Error reading text: ${error.message}`;
            textSource = 'Error';
          }
        }
        
        const pdfPage = pdfDoc.addPage();
        const { width, height } = pdfPage.getSize();
        
        // Add the text to the page
        pdfPage.drawText(`Page ${page.pageNumber} (${textSource})`, {
          x: 50,
          y: height - 50,
          size: 20
        });
        
        // Add a simplified version of the text (first 1000 characters)
        const truncatedText = textToUse.length > 1000 ? textToUse.substring(0, 1000) + '...' : textToUse;
        pdfPage.drawText(truncatedText, {
          x: 50,
          y: height - 100,
          size: 10,
          maxWidth: width - 100
        });
      }
      
      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);
      
      return { 
        success: true,
        outputPath,
        markdownPath
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Error generating output: ${error.message}` 
      };
    }
  }
}();
