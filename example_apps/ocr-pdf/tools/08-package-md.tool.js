/**
 * 08-package-md.tool.js - Package markdown content into ZIP archive
 * 
 * This tool packages all markdown content, embedded images, and context
 * information into a ZIP archive for easy distribution and use.
 */
import { Tool } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';

export const packageMDTool = new class extends Tool {
  constructor() {
    super({
      name: 'packageMD',
      description: 'Package markdown content into ZIP archive',
      input: [
        { name: 'enhancedPages', description: 'Array of pages with enhanced context' },
        { name: 'initialContext', description: 'Initial context information about the document' },
        { name: 'inputPath', description: 'Path to original PDF file' },
        { name: 'outputPath', description: 'Path to output PDF file' },
        { name: 'tempDirs', description: 'Temporary directories for processing' }
      ],
      output: [
        { name: 'zipPath', description: 'Path to ZIP archive with markdown content' }
      ]
    });
  }

  async execute({ enhancedPages, initialContext, inputPath, outputPath, tempDirs, ...rest }) {
    if (!enhancedPages || !Array.isArray(enhancedPages)) {
      return { 
        error: 'Invalid enhanced pages: must be an array',
        ...rest
      };
    }

    if (!initialContext) {
      return { 
        error: 'Initial context is required',
        ...rest
      };
    }

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

    if (!tempDirs) {
      return { 
        error: 'Temporary directories are required',
        ...rest
      };
    }

    try {
      // Create output directory for ZIP
      const zipDir = path.join(tempDirs.finalOutput, 'zip');
      await fs.ensureDir(zipDir);

      // Create a directory for the markdown content
      const mdContentDir = path.join(zipDir, 'md_content');
      await fs.ensureDir(mdContentDir);
      
      // Create directories for pages, images, and context
      const pagesDir = path.join(mdContentDir, 'pages');
      const imagesDir = path.join(mdContentDir, 'images');
      const contextDir = path.join(mdContentDir, 'context');
      
      await fs.ensureDir(pagesDir);
      await fs.ensureDir(imagesDir);
      await fs.ensureDir(contextDir);
      
      // Copy enhanced pages to the pages directory
      for (const page of enhancedPages) {
        if (page.enhanced && page.enhancedTextFilePath) {
          const destPath = path.join(pagesDir, `page_${page.pageNumber}.md`);
          await fs.copy(page.enhancedTextFilePath, destPath);
        }
      }
      
      // Save context information to the context directory
      const contextPath = path.join(contextDir, 'context.json');
      await fs.writeFile(contextPath, JSON.stringify(initialContext, null, 2));
      
      // Create a README.md file
      const readmePath = path.join(mdContentDir, 'README.md');
      const readmeContent = this.generateReadme(path.basename(inputPath, '.pdf'), enhancedPages);
      await fs.writeFile(readmePath, readmeContent);
      
      // Create a combined markdown file with all pages
      const combinedPath = path.join(mdContentDir, 'combined.md');
      const combinedContent = await this.generateCombinedMarkdown(enhancedPages);
      await fs.writeFile(combinedPath, combinedContent);
      
      // Create the ZIP archive
      const zipPath = outputPath.replace(/\.pdf$/i, '.zip');
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });
      
      // Pipe the archive to the output file
      archive.pipe(output);
      
      // Add the markdown content directory to the archive
      archive.directory(mdContentDir, false);
      
      // Finalize the archive
      await archive.finalize();
      
      return {
        zipPath,
        success: true,
        ...rest
      };
    } catch (error) {
      return {
        error: `Packaging markdown failed: ${error.message}`,
        success: false,
        ...rest
      };
    }
  }

  /**
   * Generate README.md content
   * @param {string} documentName - The name of the document
   * @param {Array} enhancedPages - The array of enhanced pages
   * @returns {string} - The README.md content
   */
  generateReadme(documentName, enhancedPages) {
    const successfulPages = enhancedPages.filter(page => page.enhanced).length;
    const totalPages = enhancedPages.length;
    
    return `# ${documentName}

## Document Information

This package contains the processed markdown content for "${documentName}".

## Contents

- **pages/**: Individual markdown files for each page
- **images/**: Images extracted from the document
- **context/**: Context information about the document
- **combined.md**: All pages combined into a single markdown file

## Processing Summary

- Total Pages: ${totalPages}
- Successfully Processed: ${successfulPages}
- Processing Date: ${new Date().toISOString().split('T')[0]}

## Usage

The markdown files in this package include semantic context tags that provide additional information about entities, locations, and temporal references in the document. These tags can be used for enhanced search and navigation.

### Tag Types

- Page numbers: \`<pg num="10" />\`
- PDF positions: \`<pdf pg="3" />\`
- Entity disambiguation: \`<ctx data="Hussein Khan, the leader of the rebellion" />\`
- Location references: \`<ctx data="Isfahan" />\`
- Temporal references: \`<ctx data="June 12, 1845" />\`

## License

This processed content is subject to the same licensing terms as the original document.
`;
  }

  /**
   * Generate combined markdown content from all enhanced pages
   * @param {Array} enhancedPages - The array of enhanced pages
   * @returns {string} - The combined markdown content
   */
  async generateCombinedMarkdown(enhancedPages) {
    try {
      // Sort pages by page number
      const sortedPages = [...enhancedPages]
        .filter(page => page.enhanced && page.enhancedTextFilePath)
        .sort((a, b) => a.pageNumber - b.pageNumber);
      
      // Combine all pages
      let combinedContent = '';
      
      for (const page of sortedPages) {
        const pageContent = await fs.readFile(page.enhancedTextFilePath, 'utf8');
        combinedContent += `\n\n## Page ${page.pageNumber}\n\n${pageContent}`;
      }
      
      return combinedContent.trim();
    } catch (error) {
      console.error(`Error generating combined markdown: ${error.message}`);
      return '# Error generating combined markdown';
    }
  }
}();
