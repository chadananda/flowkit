#!/usr/bin/env node
/**
 * Article Writer CLI - Example app using Flowlite
 * 
 * Usage: article-writer [options]
 */
import dotenv from 'dotenv';
dotenv.config();
import { program } from 'commander';
import { generateArticle, articleWriterFlow } from './article-writer.flow.js';
import { LogLevel } from 'flowlite';
import chalk from 'chalk';
import figlet from 'figlet';
import { createInterface } from 'readline';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// CLI configuration
const version = '1.0.0';
const rl = createInterface({ input: process.stdin, output: process.stdout });

// Display ASCII art title with gradient coloring
const displayTitle = () => {
  console.log(''); // Add some spacing
  
  try {
    const title = figlet.textSync('ArticleWriter', { font: 'Standard' });
    const lines = title.split('\n');
    
    // Create a gradient effect from blue to purple
    lines.forEach((line, i) => {
      const ratio = i / lines.length;
      const r = Math.floor(50 + ratio * 100);
      const g = Math.floor(100 - ratio * 50);
      const b = Math.floor(200 - ratio * 50);
      console.log(chalk.rgb(r, g, b)(line));
    });
  } catch (error) {
    // Fallback if figlet fails
    console.log(chalk.bold.blue('=== ArticleWriter ==='));
  }
  
  console.log('\n' + chalk.bold.cyan('✨ Powered by Flowlite ✨') + '\n');
  console.log(chalk.italic.gray('Generate high-quality articles with AI assistance\n'));
};

// Display help information
const displayHelp = () => {
  console.log(chalk.bold.underline('\nUsage:'));
  console.log('  article-writer [options]\n');
  
  console.log(chalk.bold.underline('Options:'));
  console.log(`  ${chalk.green('-h, --help')}        Display this help message`);
  console.log(`  ${chalk.green('-v, --version')}     Display version information`);
  console.log(`  ${chalk.green('--title')}           Set article title`);
  console.log(`  ${chalk.green('--topic')}           Set article topic`);
  console.log(`  ${chalk.green('--audience')}        Set target audience`);
  console.log(`  ${chalk.green('--keywords')}        Set keywords (comma-separated)`);
  console.log(`  ${chalk.green('--tone')}            Set tone (Informative, Conversational, Professional)`);
  console.log(`  ${chalk.green('--wordCount')}       Set word count\n`);
  
  console.log(chalk.bold.underline('Examples:'));
  console.log(`  ${chalk.blue('article-writer')}`);
  console.log(`  ${chalk.blue('article-writer --title "AI in Healthcare" --topic "Medical AI" --keywords "AI,healthcare,medicine"')}\n`);
  
  console.log(chalk.bold.underline('Environment Variables:'));
  console.log(`  ${chalk.yellow('OPENAI_API_KEY')}       Required for LLM calls`);
  console.log(`  ${chalk.yellow('PERPLEXITY_API_KEY')}   Optional for research (fallback to LLM if not provided)`);
  console.log(`  ${chalk.yellow('DEFAULT_MODEL')}        Default LLM model (default: gpt-4)`);
  console.log(`  ${chalk.yellow('DEFAULT_TEMPERATURE')}  Default temperature (default: 0.7)`);
  console.log(`  ${chalk.yellow('OUTPUT_DIR')}           Custom output directory\n`);
};

// Get article details in interactive mode
const getArticleDetails = async () => {
  console.log(chalk.bold.cyan('📝 Article Writer - Interactive Mode\n'));
  const title = await rl.question(chalk.bold('Title: '));
  const topic = await rl.question(chalk.bold('Topic: '));
  const audience = await rl.question(chalk.bold('Target audience') + chalk.gray(' (default: General readers): ')) || 'General readers';
  const keywords = (await rl.question(chalk.bold('Keywords') + chalk.gray(' (comma-separated): '))).split(',').map(k => k.trim()).filter(Boolean);
  const tone = await rl.question(chalk.bold('Tone') + chalk.gray(' (Informative, Conversational, Professional): ')) || 'Informative';
  const wordCount = parseInt(await rl.question(chalk.bold('Word count') + chalk.gray(' (default: 800): '))) || 800;
  rl.close();
  return { title, topic, audience, keywords, tone, wordCount };
};

// Setup CLI program
program
  .name('article-writer')
  .description('Generate high-quality articles with AI assistance')
  .version(version)
  .option('--title <title>', 'Article title')
  .option('--topic <topic>', 'Article topic')
  .option('--audience <audience>', 'Target audience')
  .option('--keywords <keywords>', 'Keywords (comma-separated)')
  .option('--tone <tone>', 'Tone (Informative, Conversational, Professional)')
  .option('--wordCount <count>', 'Word count')
  .helpOption('-h, --help', 'Display help information');

// Main function
async function main() {
  try {
    program.parse(process.argv);
    const options = program.opts();
    
    // Display help if no arguments or help flag
    if (process.argv.length <= 2 || options.help) {
      displayTitle();
      displayHelp();
      process.exit(0);
    }
    
    // Display version if version flag
    if (options.version) {
      console.log(`v${version}`);
      process.exit(0);
    }
    
    // Convert CLI options to article details if any options provided
    if (Object.keys(options).length > 0 && options.title) {
      const details = {
        title: options.title,
        topic: options.topic || options.title,
        audience: options.audience || 'General readers',
        keywords: options.keywords ? options.keywords.split(',').map(k => k.trim()) : [],
        tone: options.tone || 'Informative',
        wordCount: options.wordCount ? parseInt(options.wordCount) : 800
      };
      
      displayTitle();
      await generateArticle(details);
      process.exit(0);
    }
    
    // Interactive mode
    displayTitle();
    const details = await getArticleDetails();
    await generateArticle(details);
  } catch (error) {
    console.error(chalk.bold.red(`❌ Error: ${error.message}`));
    process.exit(1);
  }
}

// Run the CLI
main();
