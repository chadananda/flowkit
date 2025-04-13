#!/usr/bin/env node

/**
 * OCR-PDF CLI - Extract and process text from PDF documents
 * 
 * This CLI application uses multiple OCR engines to extract text from PDF documents,
 * reconciles the results using Claude AI, and generates both a searchable PDF/A and
 * structured Markdown output.
 */
import { program } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { LogLevel } from '../../../flowlite.js';
import { ocrPDFFlow } from './ocr-pdf.flow.js';

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(await fs.readFile(path.join(__dirname, 'package.json'), 'utf8'));
const version = packageJson.version;

// Define required API keys
const requiredSecrets = [
  'GOOGLE_CLOUD_VISION_KEY',
  'ANTHROPIC_API_KEY',
  'ABBYY_API_KEY',
  'ABBYY_APPLICATION_ID'
];

// Display ASCII art title
const displayTitle = () => {
  console.log(chalk.cyan(figlet.textSync('OCR PDF', { font: 'Standard' })));
  console.log('');
  console.log(chalk.yellow('✨ Powered by Flowlite ✨'));
  console.log('');
  console.log(chalk.white('Extract and process text from PDF documents'));
  console.log('');
};

// Initialize credentials storage
const initCredentialsStorage = async () => {
  // This is a placeholder for keytar initialization
  // In a real implementation, you would initialize keytar here
  return true;
};

// Load .env file if it exists
const loadEnvFile = () => {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    return true;
  }
  
  const envPathDir = path.join(__dirname, '.env');
  if (fs.existsSync(envPathDir)) {
    dotenv.config({ path: envPathDir });
    return true;
  }
  
  return false;
};

// Get credential from various sources
const getCredential = async (key, verbose = false) => {
  // First check environment variables
  if (process.env[key]) {
    if (verbose) console.log(chalk.green(`✓ Found ${key} in environment variables`));
    return process.env[key];
  }
  
  // Then check system keychain
  try {
    const keytar = await import('keytar');
    const service = 'flowlite-ocr-pdf';
    const value = await keytar.default.getPassword(service, key);
    if (value) {
      if (verbose) console.log(chalk.green(`✓ Found ${key} in system keychain`));
      return value;
    }
  } catch (error) {
    if (verbose) console.log(chalk.yellow(`⚠️ Keychain access not available: ${error.message}`));
  }
  
  // Finally check local storage (this is a simple implementation)
  try {
    const storageFile = path.join(__dirname, '.credentials.json');
    if (fs.existsSync(storageFile)) {
      const storage = JSON.parse(await fs.readFile(storageFile, 'utf8'));
      if (storage[key]) {
        if (verbose) console.log(chalk.green(`✓ Found ${key} in local storage`));
        return storage[key];
      }
    }
  } catch (error) {
    if (verbose) console.log(chalk.yellow(`⚠️ Local storage access failed: ${error.message}`));
  }
  
  if (verbose) console.log(chalk.yellow(`⚠️ ${key} not found in any source`));
  return null;
};

// Save credential to storage
const saveCredential = async (key, value) => {
  // First try to save to system keychain
  try {
    const keytar = await import('keytar');
    const service = 'flowlite-ocr-pdf';
    await keytar.default.setPassword(service, key, value);
    return true;
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Could not save to keychain: ${error.message}`));
  }
  
  // Fall back to local storage
  try {
    const storageFile = path.join(__dirname, '.credentials.json');
    let storage = {};
    
    if (fs.existsSync(storageFile)) {
      storage = JSON.parse(await fs.readFile(storageFile, 'utf8'));
    }
    
    storage[key] = value;
    await fs.writeFile(storageFile, JSON.stringify(storage, null, 2));
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ Could not save credential: ${error.message}`));
    return false;
  }
};

// Prompt for credential
const promptForCredential = async (key, description, existingValue = null) => {
  if (existingValue) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `${key} already exists. What would you like to do?`,
        choices: [
          { name: 'Keep existing value', value: 'keep' },
          { name: 'Update value', value: 'update' }
        ]
      }
    ]);
    
    if (action === 'keep') {
      return existingValue;
    }
  }
  
  const { value } = await inquirer.prompt([
    {
      type: 'password',
      name: 'value',
      message: `Enter ${description || key}:`,
      validate: (input) => input.trim() ? true : 'This field is required'
    }
  ]);
  
  const { save } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'save',
      message: 'Would you like to save this for future use?',
      default: true
    }
  ]);
  
  if (save) {
    await saveCredential(key, value);
  }
  
  return value;
};

// Manage credentials for the flow
const manageCredentials = async (requiredSecrets, options = {}) => {
  await initCredentialsStorage();
  loadEnvFile();
  
  const result = {
    credentials: {},
    missing: [],
    available: []
  };
  
  // Determine if we should show verbose output
  const verbose = options.forceSecrets || options.verbose;
  
  // Only show the header if we're in verbose mode or if we'll need to prompt for keys
  if (verbose) {
    console.log(chalk.cyan('Required API keys:'));
    for (const secret of requiredSecrets) {
      const isOptional = secret === 'GOOGLE_CLOUD_VISION_KEY' || 
                         secret === 'ABBYY_API_KEY' || 
                         secret === 'ABBYY_APPLICATION_ID'; // Optional keys
      console.log(`  ${isOptional ? chalk.yellow('○') : chalk.green('●')} ${secret}${isOptional ? ' (optional)' : ''}`);
    }
    console.log('');
  }
  
  // First, check all keys to see if any are missing
  const keyStatus = {};
  for (const secret of requiredSecrets) {
    const isOptional = secret === 'GOOGLE_CLOUD_VISION_KEY' || 
                       secret === 'ABBYY_API_KEY' || 
                       secret === 'ABBYY_APPLICATION_ID'; // Optional keys
    const value = await getCredential(secret, verbose);
    keyStatus[secret] = { value, isOptional };
    
    if (value) {
      result.available.push(secret);
    } else if (!isOptional) {
      result.missing.push(secret);
    }
  }
  
  // If we're not in interactive mode, just return the result
  if (!options.interactive) {
    return result;
  }
  
  // If we're forcing secrets or missing some, prompt for each one
  if (options.interactive) {
    for (const secret of requiredSecrets) {
      const isOptional = secret === 'GOOGLE_CLOUD_VISION_KEY' || 
                         secret === 'ABBYY_API_KEY' || 
                         secret === 'ABBYY_APPLICATION_ID'; // Optional keys
      const existingValue = keyStatus[secret].value;
      
      // Skip optional keys that are missing if not forcing
      if (!options.forceSecrets && isOptional && !existingValue) {
        continue;
      }
      
      // Prompt for the key
      let description;
      switch (secret) {
        case 'GOOGLE_CLOUD_VISION_KEY':
          description = 'Google Cloud Vision API Key (optional)';
          break;
        case 'ANTHROPIC_API_KEY':
          description = 'Anthropic API Key for Claude';
          break;
        case 'ABBYY_API_KEY':
          description = 'ABBYY Cloud OCR API Key (optional)';
          break;
        case 'ABBYY_APPLICATION_ID':
          description = 'ABBYY Cloud OCR Application ID (optional)';
          break;
        default:
          description = secret;
      }
      
      const value = await promptForCredential(secret, description, existingValue);
      
      // Set the environment variable for the current process
      if (options.setEnv) {
        process.env[secret] = value;
      }
      
      result.credentials[secret] = value;
    }
  }
  
  return result;
};

// Generate .env-example file
const generateEnvExample = async (requiredSecrets, outputPath) => {
  const content = requiredSecrets.map(secret => {
    const isOptional = secret === 'GOOGLE_CLOUD_VISION_KEY' || 
                       secret === 'ABBYY_API_KEY' || 
                       secret === 'ABBYY_APPLICATION_ID'; // Optional keys
    return `# ${isOptional ? 'Optional: ' : ''}${secret}=your-${secret.toLowerCase()}-here`;
  }).join('\n');
  
  await fs.writeFile(outputPath, content);
  return outputPath;
};

// Display help information
const displayHelp = async () => {
  displayTitle();
  
  console.log(chalk.bold.underline('\nUsage:'));
  console.log('  ocr-pdf <input-pdf> <output-pdf> [options]\n');
  
  console.log(chalk.bold.underline('Options:'));
  console.log(`  -h, --help           Show this help information`);
  console.log(`  -v, --version        Show version number`);
  console.log(`  --force-secrets      Force prompt for API keys, even if they exist`);
  console.log(`  --gen-env            Generate .env-example file`);
  console.log(`  --keep-temp          Keep temporary files after processing`);
  console.log(`  --debug              Enable debug logging\n`);
  
  console.log(chalk.bold.underline('Examples:'));
  console.log(`  ${chalk.blue('ocr-pdf ./document.pdf ./document-ocr.pdf')}`);
  console.log(`  ${chalk.blue('ocr-pdf ./document.pdf ./document-ocr.pdf --force-secrets')}\n`);
  
  console.log(chalk.bold.underline('Required API Keys:'));
  console.log(`  ${chalk.green('●')} ${chalk.yellow('ANTHROPIC_API_KEY')}       Required for Claude reconciliation`);
  console.log(`  ${chalk.yellow('○')} ${chalk.yellow('GOOGLE_CLOUD_VISION_KEY')}  Optional for Google Vision OCR`);
  console.log(`  ${chalk.yellow('○')} ${chalk.yellow('ABBYY_API_KEY')}           Optional for ABBYY Cloud OCR`);
  console.log(`  ${chalk.yellow('○')} ${chalk.yellow('ABBYY_APPLICATION_ID')}     Optional for ABBYY Cloud OCR\n`);
  
  console.log(chalk.bold.underline('How It Works:'));
  console.log(`  OCR PDF extracts text from PDF documents using multiple OCR engines:`);
  console.log(`  1. Uses Tesseract.js for basic OCR (always available)`);
  console.log(`  2. Uses Google Cloud Vision for enhanced OCR (if API key provided)`);
  console.log(`  3. Uses ABBYY Cloud OCR for professional-grade OCR (if API keys provided)`);
  console.log(`  4. Reconciles results using Claude to produce the best text`);
  console.log(`  5. Enhances markdown with semantic context tags`);
  console.log(`  6. Generates a searchable PDF/A with the extracted text`);
  console.log(`  7. Creates a structured Markdown ZIP archive with the same content\n`);
  
  console.log(chalk.bold.underline('Output Files:'));
  console.log(`  1. Searchable PDF/A document (specified output path)`);
  console.log(`  2. Markdown ZIP archive (same name as output PDF with .zip extension)\n`);
};

// Prompt for PDF paths
const promptForPDFPaths = async () => {
  const { inputPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'inputPath',
      message: 'Enter the path to the input PDF:',
      validate: (input) => {
        if (!input.trim()) return 'This field is required';
        if (!fs.existsSync(input)) return 'File does not exist';
        if (!input.toLowerCase().endsWith('.pdf')) return 'File must be a PDF';
        return true;
      }
    }
  ]);
  
  const { outputPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputPath',
      message: 'Enter the path for the output PDF:',
      default: () => {
        const parsedPath = path.parse(inputPath);
        return path.join(parsedPath.dir, `${parsedPath.name}-ocr${parsedPath.ext}`);
      },
      validate: (input) => {
        if (!input.trim()) return 'This field is required';
        if (!input.toLowerCase().endsWith('.pdf')) return 'File must be a PDF';
        return true;
      }
    }
  ]);
  
  return { inputPath, outputPath };
};

// Set up command line options
program
  .name('ocr-pdf')
  .description('Extract and process text from PDF documents')
  .version(version, '-v, --version', 'Output the current version')
  .option('--force-secrets', 'Force prompt for API keys, even if they exist')
  .option('--gen-env', 'Generate .env-example file')
  .option('--keep-temp', 'Keep temporary files after processing')
  .option('--debug', 'Enable debug logging')
  .helpOption('-h, --help', 'Display help information')
  .allowUnknownOption(true) // Allow unknown options
  .showHelpAfterError(false) // Don't show help after error
  .exitOverride(); // Don't exit on error

// Main function to run the OCR PDF process
async function main() {
  try {
    // Handle --help flag manually to ensure async displayHelp works
    if (process.argv.includes('-h') || process.argv.includes('--help')) {
      await displayHelp();
      process.exit(0);
    }
    
    // Display title first
    displayTitle();
    
    try {
      // Parse arguments but catch any errors
      program.parse(process.argv);
    } catch (error) {
      // Ignore commander errors, we'll handle arguments manually
    }
    
    const options = program.opts();
    
    // Display version if version flag
    if (options.version) {
      console.log(`v${version}`);
      process.exit(0);
    }
    
    // Generate .env-example if requested
    if (options.genEnv) {
      await generateEnvExample(requiredSecrets, path.join(__dirname, '.env-example'));
      console.log(chalk.green(`✅ Generated .env-example file with required API keys`));
      process.exit(0);
    }
    
    // First, load credentials and set environment variables
    // This will prompt for any missing required API keys
    const credentialStatus = await manageCredentials(requiredSecrets, { 
      interactive: true, 
      setEnv: true,
      forceSecrets: options.forceSecrets,
      // Only show verbose output if forcing secrets
      verbose: options.forceSecrets
    });
    
    // Set log level based on DEBUG environment variable or --debug flag
    if (process.env.DEBUG || options.debug) {
      ocrPDFFlow.setLogLevel(LogLevel.DEBUG);
    }

    // Get non-flag arguments (potential file paths)
    const nonFlagArgs = process.argv.slice(2).filter(arg => !arg.startsWith('-'));
    let inputPath, outputPath;
    
    // Check if we have the required command line arguments
    if (nonFlagArgs.length >= 2) {
      inputPath = path.resolve(nonFlagArgs[0]);
      outputPath = path.resolve(nonFlagArgs[1]);
    } else {
      // If not, prompt for them interactively
      console.log(chalk.yellow('Missing required parameters. Please enter them below:'));
      const paths = await promptForPDFPaths();
      inputPath = path.resolve(paths.inputPath);
      outputPath = path.resolve(paths.outputPath);
    }
    
    // Run the OCR PDF flow
    console.log(chalk.blue(`\nProcessing PDF: ${inputPath}`));
    console.log(chalk.blue(`Output PDF: ${outputPath}`));
    console.log(chalk.blue(`Output ZIP: ${outputPath.replace(/\.pdf$/i, '.zip')}`));
    console.log(chalk.yellow('\nThis may take several minutes depending on the size of the PDF...\n'));
    
    const result = await ocrPDFFlow.run({ 
      inputPath, 
      outputPath,
      keepTemp: options.keepTemp
    });
    
    if (result.success) {
      console.log(chalk.green(`\n✅ OCR processing completed successfully!`));
      console.log(chalk.green(`📄 Processed ${result.pageResults ? result.pageResults.length : 0} pages`));
      console.log(chalk.green(`📝 Searchable PDF saved to: ${outputPath}`));
      console.log(chalk.green(`📘 Markdown saved to: ${outputPath.replace(/\.pdf$/i, '.md')}`));
      
      if (result.tempDir) {
        console.log(chalk.green(`📁 Temporary files kept at: ${result.tempDir}`));
      }
    } else {
      console.error(chalk.red(`\n❌ OCR processing failed: ${result.error || 'Unknown error'}`));
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run the main function
main();
