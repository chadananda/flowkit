#!/usr/bin/env node
/**
 * OCR PDF CLI - Example app using Flowlite
 * 
 * Usage: node index.js ./input.pdf ./output.pdf
 */
import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import { fileURLToPath } from 'url';
import { processPDF, ocrPDFFlow } from './ocr-pdf.flow.js';
import { LogLevel } from 'flowlite';
import chalk from 'chalk';
import figlet from 'figlet';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Display ASCII art title
const displayTitle = () => {
  console.log(''); // Add some spacing
  
  try {
    const title = figlet.textSync('OCR PDF', { font: 'Standard' });
    const lines = title.split('\n');
    
    // Create a gradient effect
    lines.forEach((line, i) => {
      const ratio = i / lines.length;
      const r = Math.floor(50 + ratio * 150);
      const g = Math.floor(100 + ratio * 50);
      const b = Math.floor(200 - ratio * 50);
      console.log(chalk.rgb(r, g, b)(line));
    });
  } catch (error) {
    // Fallback if figlet fails
    console.log(chalk.bold.blue('=== OCR PDF ==='));
  }
  
  console.log('\n' + chalk.bold.cyan('✨ Powered by Flowlite ✨') + '\n');
  console.log(chalk.italic.gray('Extract and process text from PDF documents\n'));
};

// Display help information
const displayHelp = () => {
  console.log(chalk.bold.underline('\nUsage:'));
  console.log('  ocr-pdf <input-pdf> <output-pdf>\n');
  
  console.log(chalk.bold.underline('Examples:'));
  console.log(`  ${chalk.blue('ocr-pdf ./document.pdf ./document-ocr.pdf')}\n`);
  
  console.log(chalk.bold.underline('Environment Variables:'));
  console.log(`  ${chalk.yellow('GOOGLE_CLOUD_VISION_KEY')}  Optional for Google Vision OCR`);
  console.log(`  ${chalk.yellow('ABBYY_API_KEY')}           Optional for ABBYY OCR`);
  console.log(`  ${chalk.yellow('ANTHROPIC_API_KEY')}       Optional for Claude reconciliation\n`);
};

// Get command line arguments
const args = process.argv.slice(2);

// Main function to run the OCR PDF process
async function main() {
  try {
    // Set log level based on DEBUG environment variable
    if (process.env.DEBUG) {
      ocrPDFFlow.setLogLevel(LogLevel.DEBUG);
    }
    
    displayTitle();
    
    if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
      displayHelp();
      process.exit(1);
    }

    const inputPath = path.resolve(args[0]);
    const outputPath = path.resolve(args[1]);
    
    ocrPDFFlow.info(`Processing PDF: ${inputPath}`);
    ocrPDFFlow.info(`Output will be saved to: ${outputPath}`);
    
    const result = await processPDF(inputPath, outputPath);
    
    if (result.mergedPDF) {
      ocrPDFFlow.info(chalk.green(`[DONE] Wrote ${result.pageCount} pages to ${result.outputPath}`));
    } else {
      ocrPDFFlow.error('Failed to process PDF');
    }
  } catch (error) {
    ocrPDFFlow.error(`Error processing PDF: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();
