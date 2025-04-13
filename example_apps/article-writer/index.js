#!/usr/bin/env node
/**
 * Article Writer CLI - Example app using Flowlite
 * 
 * Usage: article-writer [options]
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { program } from 'commander';
import { generateArticle, articleWriterFlow } from './article-writer.flow.js';
import chalk from 'chalk';
import figlet from 'figlet';
import inquirer from 'inquirer';
import { promises as fs } from 'fs';
import os from 'os';
import dotenv from 'dotenv';
dotenv.config();

// CLI configuration
const version = '1.0.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Determine if keytar is available (system keychain access)
let keytar;
try {
  const keytarModule = await import('keytar');
  keytar = keytarModule.default || keytarModule;
} catch (error) {
  console.log(chalk.yellow('System keychain access not available. Using fallback storage.'));
  keytar = null;
}

// Service name for keytar
const SERVICE_NAME = 'flowlite';

// Fallback storage location if keytar is not available
const CREDENTIALS_DIR = path.join(os.homedir(), '.flowlite');
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, 'credentials.json');

/**
 * Initialize credentials storage
 */
const initCredentialsStorage = async () => {
  if (!keytar) {
    try {
      await fs.mkdir(CREDENTIALS_DIR, { recursive: true });
      // Set restrictive permissions (read/write only for owner)
      await fs.chmod(CREDENTIALS_DIR, 0o700);
      
      // Create credentials file if it doesn't exist
      try {
        await fs.access(CREDENTIALS_FILE);
      } catch (error) {
        await fs.writeFile(CREDENTIALS_FILE, JSON.stringify({}), 'utf8');
        await fs.chmod(CREDENTIALS_FILE, 0o600);
      }
    } catch (error) {
      console.error(chalk.red(`Error initializing credentials storage: ${error.message}`));
    }
  }
};

/**
 * Load environment variables from .env file
 */
const loadEnvFile = () => {
  const envPath = path.join(__dirname, '.env');
  dotenv.config({ path: envPath });
};

/**
 * Get a credential from various sources in priority order
 * @param {string} key - The credential key
 * @param {boolean} verbose - Whether to show verbose output
 * @returns {Promise<string|null>} - The credential value or null if not found
 */
const getCredential = async (key, verbose = false) => {
  try {
    if (verbose) console.log(chalk.gray(`Checking for ${key}...`));
    
    // First check environment variables
    if (process.env[key]) {
      if (verbose) console.log(chalk.gray(`Found ${key} in environment variables`));
      return process.env[key];
    } else if (verbose) {
      console.log(chalk.gray(`${key} not found in environment variables`));
    }
    
    // Then check system keychain
    if (keytar) {
      if (verbose) console.log(chalk.gray(`Checking ${key} in system keychain...`));
      try {
        const value = await keytar.getPassword(SERVICE_NAME, key);
        if (value) {
          if (verbose) console.log(chalk.gray(`Found ${key} in system keychain`));
          return value;
        } else if (verbose) {
          console.log(chalk.gray(`${key} not found in system keychain`));
        }
      } catch (keytarError) {
        if (verbose) console.log(chalk.gray(`Error accessing keychain for ${key}: ${keytarError.message}`));
      }
    } else if (verbose) {
      console.log(chalk.gray(`Keytar not available, skipping system keychain check for ${key}`));
    }
    
    // Fall back to file storage
    if (verbose) console.log(chalk.gray(`Checking ${key} in local storage file...`));
    try {
      const data = JSON.parse(await fs.readFile(CREDENTIALS_FILE, 'utf8'));
      if (data[key]) {
        if (verbose) console.log(chalk.gray(`Found ${key} in local storage file`));
        return data[key];
      } else if (verbose) {
        console.log(chalk.gray(`${key} not found in local storage file`));
      }
    } catch (fileError) {
      if (verbose) console.log(chalk.gray(`Error reading local storage for ${key}: ${fileError.message}`));
    }
    
    // Not found in any source
    if (verbose) console.log(chalk.gray(`${key} not found in any source`));
    return null;
  } catch (error) {
    console.error(chalk.red(`Error retrieving credential: ${error.message}`));
    return null;
  }
};

/**
 * Save a credential to storage
 * @param {string} key - The credential key
 * @param {string} value - The credential value
 * @returns {Promise<boolean>} - True if saved successfully
 */
const saveCredential = async (key, value) => {
  try {
    console.log(chalk.gray(`Attempting to save ${key}...`));
    
    if (keytar) {
      console.log(chalk.gray(`Saving ${key} to system keychain...`));
      try {
        await keytar.setPassword(SERVICE_NAME, key, value);
        console.log(chalk.gray(`Successfully saved ${key} to system keychain`));
        return true;
      } catch (keytarError) {
        console.log(chalk.red(`Error saving to keychain: ${keytarError.message}`));
        // Fall back to file storage if keychain fails
        console.log(chalk.gray(`Falling back to file storage...`));
      }
    } else {
      console.log(chalk.gray(`Keytar not available, using file storage for ${key}`));
    }
    
    // Save to file storage
    try {
      console.log(chalk.gray(`Saving ${key} to local storage file...`));
      const data = JSON.parse(await fs.readFile(CREDENTIALS_FILE, 'utf8'));
      data[key] = value;
      await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(data), 'utf8');
      console.log(chalk.gray(`Successfully saved ${key} to local storage file`));
      return true;
    } catch (fileError) {
      console.log(chalk.red(`Error saving to file storage: ${fileError.message}`));
      return false;
    }
  } catch (error) {
    console.error(chalk.red(`Error saving credential: ${error.message}`));
    return false;
  }
};

/**
 * Prompt user for a credential interactively
 * @param {string} key - The credential key
 * @param {string} description - Description of the credential
 * @param {string|null} existingValue - Existing value if available
 * @returns {Promise<string|null>} - The credential value or null if skipped
 */
const promptForCredential = async (key, description, existingValue = null) => {
  if (existingValue) {
    console.log(chalk.cyan(`\n${description} (${key}) already exists.`));
    
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Would you like to:',
      choices: [
        { name: 'Keep existing value', value: 'keep' },
        { name: 'Update with new value', value: 'update' }
      ]
    }]);
    
    if (action === 'keep') {
      console.log(chalk.green(`✅ Keeping existing ${key}`));
      return existingValue;
    }
  } else {
    console.log(chalk.cyan(`\n${description} (${key}) is required.`));
  }
  
  const questions = [
    {
      type: 'password',
      name: 'value',
      message: `Enter your ${key}:`,
      mask: '*',
      validate: input => input ? true : `${key} is required`
    },
    {
      type: 'confirm',
      name: 'save',
      message: 'Would you like to save this key securely for future use?',
      default: true
    }
  ];
  
  const answers = await inquirer.prompt(questions);
  
  if (answers.save && answers.value) {
    const saved = await saveCredential(key, answers.value);
    if (saved) {
      console.log(chalk.green(`✅ ${key} saved successfully for future use`));
    } else {
      console.log(chalk.yellow(`⚠️ Could not save ${key}. It will be used for this session only.`));
    }
  } else if (answers.value) {
    console.log(chalk.yellow(`⚠️ ${key} will be used for this session only.`));
  }
  
  return answers.value;
};

/**
 * Manage credentials for the flow
 * @param {Array<string>} requiredSecrets - Array of required secret names
 * @param {Object} options - Options object
 * @returns {Promise<Object>} - Object with credentials
 */
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
      const isOptional = secret === 'PERPLEXITY_API_KEY'; // Example of an optional key
      console.log(`  ${isOptional ? chalk.yellow('○') : chalk.green('●')} ${secret}${isOptional ? ' (optional)' : ''}`);
    }
    console.log('');
  }
  
  // First, check all keys to see if any are missing
  const keyStatus = {};
  for (const secret of requiredSecrets) {
    const isOptional = secret === 'PERPLEXITY_API_KEY';
    const value = await getCredential(secret, verbose);
    keyStatus[secret] = { value, isOptional };
    
    if (value) {
      result.available.push(secret);
    } else if (!isOptional) {
      result.missing.push(secret);
    }
  }
  
  // If we're not forcing secrets and all required keys are available, we're done
  if (!options.forceSecrets && result.missing.length === 0) {
    // Only show a summary if there were issues or we're in verbose mode
    if (verbose) {
      console.log(chalk.green('✅ All required API keys are available.'));
    }
    
    // Set environment variables
    for (const secret of requiredSecrets) {
      if (keyStatus[secret].value) {
        process.env[secret] = keyStatus[secret].value;
        result.credentials[secret] = keyStatus[secret].value;
      }
    }
    
    return result;
  }
  
  // If we get here, we need to prompt for some keys or we're forcing secrets
  for (const secret of requiredSecrets) {
    const { value, isOptional } = keyStatus[secret];
    
    // Skip prompting if we have the value and we're not forcing secrets
    if (value && !options.forceSecrets) {
      if (verbose) console.log(chalk.green(`✅ Found ${secret}`));
      result.credentials[secret] = value;
      continue;
    }
    
    if (options.interactive) {
      // Prompt for keys in interactive mode
      const description = secret === 'OPENAI_API_KEY' 
        ? 'OpenAI API Key'
        : secret === 'PERPLEXITY_API_KEY'
          ? 'Perplexity API Key (optional)'
          : secret;
      
      // Show different message if forcing prompt for existing key
      if (value && options.forceSecrets) {
        console.log(chalk.yellow(`${secret} exists and --force-secrets was specified.`));
      }
          
      const newValue = await promptForCredential(secret, description, value);
      if (newValue) {
        result.credentials[secret] = newValue;
        if (!result.available.includes(secret)) {
          result.available.push(secret);
        }
        
        // Remove from missing if it was there
        const missingIndex = result.missing.indexOf(secret);
        if (missingIndex >= 0) {
          result.missing.splice(missingIndex, 1);
        }
      } else if (!isOptional && !result.missing.includes(secret)) {
        // Only add to missing if it's required and not provided
        result.missing.push(secret);
      }
    } else if (!isOptional && !result.missing.includes(secret)) {
      // Only add to missing if it's required
      result.missing.push(secret);
    }
  }
  
  // Set environment variables if requested
  if (options.setEnv) {
    for (const [key, value] of Object.entries(result.credentials)) {
      process.env[key] = value;
    }
  }
  
  // Summarize what we found
  if (result.missing.length > 0) {
    console.log(chalk.red(`⚠️ Missing required API keys: ${result.missing.join(', ')}`));
    if (!options.interactive) {
      console.log(chalk.yellow('Run with --interactive to be prompted for missing keys.'));
    }
  } else {
    console.log(chalk.green('✅ All required API keys are available.'));
  }
  console.log('');
  
  return result;
};

/**
 * Extract required API keys from a flow
 * @param {Flow} flow - The flow to extract secrets from
 * @returns {Array<string>} - Array of required secret names
 */
const extractRequiredSecrets = (flow) => {
  // For simplicity in this example app, we'll hardcode the required keys
  // In a real app, these would be extracted from the flow definition
  return ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY'];
};

/**
 * Generate a .env-example file with required API keys
 * @param {Array<string>} requiredSecrets - Array of required secret names
 * @param {string} outputPath - Path to write the .env-example file
 */
const generateEnvExample = async (requiredSecrets, outputPath) => {
  let content = '# API Keys\n';
  
  requiredSecrets.forEach(secret => {
    content += `${secret}=your_${secret.toLowerCase()}_here\n`;
  });
  
  await fs.writeFile(outputPath, content, 'utf8');
};

// Extract required secrets from the flow
const requiredSecrets = extractRequiredSecrets(articleWriterFlow);

/**
 * Display ASCII art title with gradient coloring
 */
const displayTitle = () => {
  const titleText = figlet.textSync('Article Writer', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
  
  // Split the title into lines
  const lines = titleText.split('\n');
  
  // Define gradient colors
  const colors = ['#ff0000', '#ff3300', '#ff6600', '#ff9900', '#ffcc00'];
  
  // Calculate color step
  const colorStep = colors.length / lines.length;
  
  // Print each line with gradient color
  lines.forEach((line, i) => {
    const colorIndex = Math.min(Math.floor(i * colorStep), colors.length - 1);
    console.log(chalk.hex(colors[colorIndex])(line));
  });
  
  console.log('\n' + chalk.bold('✨ Powered by Flowlite ✨') + '\n');
  console.log(chalk.italic.gray('Generate high-quality articles with AI assistance\n'));
  
  // Add a brief description of the flow
  console.log(chalk.bold('Article Writer creates well-researched, properly sourced articles'));
  console.log(chalk.gray('by deeply researching your topic and producing organized content'));
  console.log(chalk.gray('tailored to your specified audience, tone, and length.\n'));
};

// Display help information
const displayHelp = async () => {
  console.log(chalk.bold.cyan('\n📝 Article Writer CLI'));
  console.log(chalk.gray('Powered by Flowlite\n'));
  
  console.log(chalk.bold('Description:'));
  console.log('  Article Writer is a powerful tool that leverages AI to create well-researched,');
  console.log('  well-organized, and properly sourced articles on any topic.');
  console.log('');
  console.log('  ' + chalk.bold('How it works:'));
  console.log('  1. ' + chalk.yellow('Research Phase') + ' - Deeply researches the topic using multiple sources');
  console.log('     • Gathers comprehensive information on the topic');
  console.log('     • Identifies key concepts, trends, and expert opinions');
  console.log('     • Collects relevant statistics and data points');
  console.log('');
  console.log('  2. ' + chalk.yellow('Organization Phase') + ' - Creates a logical structure for the article');
  console.log('     • Develops a coherent outline with sections and subsections');
  console.log('     • Ensures a natural flow of information');
  console.log('     • Prioritizes content based on relevance and importance');
  console.log('');
  console.log('  3. ' + chalk.yellow('Writing Phase') + ' - Produces high-quality content');
  console.log('     • Writes clear, engaging prose in the specified tone');
  console.log('     • Incorporates research findings and data');
  console.log('     • Maintains the target audience perspective throughout');
  console.log('');
  console.log('  4. ' + chalk.yellow('Refinement Phase') + ' - Polishes the final output');
  console.log('     • Ensures proper citations and references');
  console.log('     • Optimizes for readability and engagement');
  console.log('     • Tailors content to match specified word count and style\n');
  
  console.log(chalk.bold('Usage:'));
  console.log('  article-writer [options]\n');
  
  console.log(chalk.bold('Options:'));
  console.log('  -h, --help        Display this help message');
  console.log('  -v, --version     Display version information');
  console.log('  --title           Set article title');
  console.log('  --topic           Set article topic');
  console.log('  --audience        Set target audience');
  console.log('  --keywords        Set keywords (comma-separated)');
  console.log('  --tone            Set tone (Informative, Conversational, Professional)');
  console.log('  --wordCount       Set word count');
  console.log('  --gen-env         Generate a .env-example file');
  console.log('  --force-secrets   Review and manage existing API keys\n');
  
  console.log(chalk.bold('Examples:'));
  console.log('  article-writer');
  console.log('  article-writer --title "AI in Healthcare" --topic "Medical AI" --keywords "AI,healthcare,medicine"');
  console.log('  article-writer --force-secrets                # Review and optionally update API keys\n');
  
  // Check for existing credentials
  await initCredentialsStorage();
  loadEnvFile();
  
  // Get status of required keys and their sources
  const keyStatus = {};
  for (const secret of requiredSecrets) {
    keyStatus[secret] = { available: false, source: null };
    
    // Check environment variables
    if (process.env[secret]) {
      keyStatus[secret].available = true;
      keyStatus[secret].source = 'environment variable';
      continue;
    }
    
    // Check system keychain
    if (keytar) {
      const value = await keytar.getPassword(SERVICE_NAME, secret);
      if (value) {
        keyStatus[secret].available = true;
        keyStatus[secret].source = 'system keychain';
        continue;
      }
    } 
    
    // Check local storage
    try {
      const data = JSON.parse(await fs.readFile(CREDENTIALS_FILE, 'utf8'));
      if (data[secret]) {
        keyStatus[secret].available = true;
        keyStatus[secret].source = 'local storage';
        continue;
      }
    } catch (error) {
      // Ignore errors reading local storage
    }
  }
  
  console.log(chalk.bold('┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold('│            Required API Keys                │'));
  console.log(chalk.bold('└─────────────────────────────────────────────┘'));
  
  for (const secret of requiredSecrets) {
    const isOptional = secret === 'PERPLEXITY_API_KEY';
    const status = keyStatus[secret];
    const marker = isOptional ? '○' : '●';
    
    if (status.available) {
      console.log(`  ${chalk.green(`${marker} ${chalk.bold(secret)}`)} (available from ${status.source})`);
    } else {
      console.log(`  ${chalk.yellow(`${marker} ${chalk.bold(secret)}${isOptional ? ' (optional, fallback available)' : ''}`)} (not found)`);
    }
  }
  console.log('');
  console.log(chalk.gray('  Missing keys will be prompted for interactively when running the app.'));
  console.log(chalk.gray('  Use --force-secrets to review and manage existing keys.\n'));
  
  console.log(chalk.bold.underline('Other Environment Variables:'));
  console.log(`  ${chalk.yellow('DEFAULT_MODEL')}        Default LLM model (default: gpt-4)`);
  console.log(`  ${chalk.yellow('DEFAULT_TEMPERATURE')}  Default temperature (default: 0.7)`);
  console.log(`  ${chalk.yellow('OUTPUT_DIR')}           Custom output directory\n`);
};

// Get article details in interactive mode
const getArticleDetails = async () => {
  const questions = [
    {
      type: 'input',
      name: 'title',
      message: 'Title:',
      validate: input => input ? true : 'Title is required'
    },
    {
      type: 'input',
      name: 'topic',
      message: 'Topic:',
      default: answers => answers.title
    },
    {
      type: 'input',
      name: 'audience',
      message: 'Target audience:',
      default: 'General readers'
    },
    {
      type: 'input',
      name: 'keywordsInput',
      message: 'Keywords (comma-separated):',
      default: ''
    },
    {
      type: 'list',
      name: 'tone',
      message: 'Tone:',
      choices: ['Informative', 'Conversational', 'Professional'],
      default: 'Informative'
    },
    {
      type: 'input',
      name: 'wordCount',
      message: 'Word count:',
      default: '800',
      validate: input => !isNaN(parseInt(input)) ? true : 'Please enter a number'
    }
  ];
  
  const answers = await inquirer.prompt(questions);
  
  return {
    title: answers.title,
    topic: answers.topic,
    audience: answers.audience,
    keywords: answers.keywordsInput.split(',').map(k => k.trim()).filter(Boolean),
    tone: answers.tone,
    wordCount: parseInt(answers.wordCount)
  };
};

// Setup CLI program
program
  .name('article-writer')
  .description('Generate high-quality articles with AI assistance')
  .version(version, '-v, --version', 'Output the current version')
  .option('--title <title>', 'Title of the article')
  .option('--topic <topic>', 'Main topic of the article')
  .option('--audience <audience>', 'Target audience')
  .option('--keywords <keywords>', 'Comma-separated keywords')
  .option('--tone <tone>', 'Writing tone (informative, persuasive, etc.)')
  .option('--word-count <count>', 'Target word count')
  .option('--force-secrets', 'Force prompt for API keys, even if they exist')
  .option('--gen-env', 'Generate .env-example file')
  .helpOption('-h, --help', 'Display help information')
  .allowUnknownOption(true) // Allow unknown options
  .showHelpAfterError(false) // Don't show help after error
  .exitOverride(); // Don't exit on error

// Main function
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
    
    // Check if we're in command-line mode (any options provided except utility ones)
    const nonUtilityOptions = Object.keys(options).filter(key => 
      !['version', 'genEnv', 'forceSecrets', 'help'].includes(key)
    );
    
    if (nonUtilityOptions.length > 0) {
      // Command-line mode
      let details = {
        title: options.title,
        topic: options.topic,
        audience: options.audience,
        keywords: options.keywords ? options.keywords.split(',').map(k => k.trim()) : [],
        tone: options.tone,
        wordCount: options.wordCount ? parseInt(options.wordCount) : undefined
      };
      
      // Prompt for any missing required parameters
      if (!details.title) {
        const { title } = await inquirer.prompt([{
          type: 'input',
          name: 'title',
          message: 'Enter the title of the article:',
          validate: input => input.trim() ? true : 'Title is required'
        }]);
        details.title = title;
      }
      
      // Set defaults for missing optional parameters
      details.topic = details.topic || details.title;
      details.audience = details.audience || 'General readers';
      details.tone = details.tone || 'Informative';
      details.wordCount = details.wordCount || 800;
      
      // If keywords are missing, prompt for them
      if (!details.keywords || details.keywords.length === 0) {
        const { keywords } = await inquirer.prompt([{
          type: 'input',
          name: 'keywords',
          message: 'Enter keywords (comma-separated, optional):',
          default: ''
        }]);
        
        details.keywords = keywords ? keywords.split(',').map(k => k.trim()) : [];
      }
      
      await generateArticle(details);
      process.exit(0);
    }
    
    // Interactive mode - run this when no specific options are provided
    console.log(chalk.bold.cyan('📝 Article Writer - Interactive Mode\n'));
    const details = await getArticleDetails();
    await generateArticle(details);
  } catch (error) {
    console.error(chalk.bold.red(`❌ Error: ${error.message}`));
    process.exit(1);
  }
}

// Run the CLI
main();
