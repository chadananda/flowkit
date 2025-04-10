# Flowlite Development Guide

This guide provides best practices and patterns for developing with the Flowlite framework, including how to create ultra-compact flows and complete CLI applications.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Ultra-Compact Flow Development](#ultra-compact-flow-development)
- [Building a Complete CLI Application](#building-a-complete-cli-application)
- [Advanced Patterns](#advanced-patterns)
- [Logging and Monitoring](#logging-and-monitoring)

## Core Concepts

### Flows

Flows are the central concept in Flowlite. A flow is a sequence of steps (nodes) that process data and transform state.

```javascript
import { Flow } from 'flowlite';

// Create a simple flow
const myFlow = Flow.create({ name: 'myFlow', description: 'A simple flow example' })
  .start(initialStep)
  .next(processData)
  .next(generateOutput);

// Run the flow with initial state
const result = await myFlow.run({ input: 'Hello, world!' });
```

### Tools

Tools are the building blocks of flows. Flowlite provides a powerful class-based architecture for creating tools:

```javascript
import { LLMTool, param, ParamType } from 'flowlite';

// Class-based Tool using inheritance
class SentimentAnalysisTool extends LLMTool {
  constructor() {
    super({
      name: 'analyzeSentiment',
      description: 'Analyzes the sentiment of text',
      temperature: 0.3
    });
  }
  
  async execute({ text }) {
    this.prompt = `Analyze sentiment: ${text}\nRespond as JSON: sentiment, score`;
    return super.execute({ text });
  }
  
  processResponse(response) {
    return JSON.parse(response.replace(/```json|```/g, '').trim());
  }
}
```

## Ultra-Compact Flow Development

Flowlite supports an ultra-compact development style that minimizes boilerplate while maintaining readability and power.

### One-Step Tool Definition

Define and instantiate tools in a single step using anonymous class expressions:

```javascript
// Define and export tool directly as an instance
export const sentimentTool = new (class extends LLMTool {
  constructor() {
    super({ name: 'analyzeSentiment', temperature: 0.3 });
  }
  
  async execute({ text }) {
    this.prompt = `Analyze sentiment: ${text}\nRespond as JSON: sentiment, score`;
    return super.execute({ text });
  }
  
  processResponse(response) {
    return JSON.parse(response.replace(/```json|```/g, '').trim());
  }
})();
```

### Concise Flow Definitions

Create minimal flow definitions that focus solely on the sequence of operations:

```javascript
// Ultra-compact flow definition
export const analyzeFlow = Flow.create({
  name: 'analyze',
  input: [param('text', ParamType.STRING, 'Text to analyze')],
  output: [param('analysis', ParamType.OBJECT, 'Analysis results')]
})
.next(async ({ text }) => {
  // Get sentiment
  const sentiment = await sentimentTool.call({ text });
  
  // Get entities (using ternary for conditional logic)
  const entities = text.length > 100 
    ? await entityTool.call({ text }) 
    : { entities: [] };
  
  // Return combined results
  return { analysis: { ...sentiment, ...entities } };
});

// One-liner export for simple usage
export const analyze = text => analyzeFlow.run({ text });
```

### Flow Composition

Compose flows by directly using other flows as functions:

```javascript
// In summarize.flow.js
export const summarize = text => summarizeFlow.run({ text });

// In research.flow.js
import { summarize } from './summarize.flow.js';

// Later in the flow
const summary = await summarize(combinedResearch);
return { research: summary };
```

### Complete Example: Ultra-Compact Flow File

Here's a complete example of an ultra-compact flow file:

```javascript
/**
 * Text Analysis Flow - Ultra-compact implementation
 */

import { Flow, LLMTool, param, ParamType, apiKey } from 'flowlite';

// ===== Tools =====

// Define and export tools directly as instances
export const sentimentTool = new (class extends LLMTool {
  constructor() {
    super({ name: 'analyzeSentiment', temperature: 0.3 });
  }
  
  async execute({ text }) {
    this.prompt = `Analyze sentiment: ${text}\nRespond as JSON: sentiment, score`;
    return super.execute({ text });
  }
  
  processResponse(response) {
    return JSON.parse(response.replace(/```json|```/g, '').trim());
  }
})();

export const entityTool = new (class extends LLMTool {
  constructor() {
    super({ name: 'extractEntities', temperature: 0.2 });
  }
  
  async execute({ text }) {
    this.prompt = `Extract entities from: ${text}\nRespond as JSON array`;
    return super.execute({ text });
  }
  
  processResponse(response) {
    return { entities: JSON.parse(response.replace(/```json|```/g, '').trim()) };
  }
})();

// ===== Flow =====

// Ultra-compact flow definition
export const analyzeFlow = Flow.create({
  name: 'analyze',
  input: [param('text', ParamType.STRING, 'Text to analyze')],
  output: [param('analysis', ParamType.OBJECT, 'Analysis results')],
  apiKeys: [apiKey('openai', 'OpenAI API Key', 'OPENAI_API_KEY')]
})
.next(async ({ text }) => {
  // Get sentiment and entities in parallel
  const [sentiment, entities] = await Promise.all([
    sentimentTool.call({ text }),
    entityTool.call({ text })
  ]);
  
  // Return combined results
  return { analysis: { ...sentiment, ...entities } };
});

// One-liner export for simple usage
export const analyze = text => analyzeFlow.run({ text });
```

## Building a Complete CLI Application

This section provides a comprehensive guide to building a complete CLI application using Flowlite.

### Project Structure

```
my-flow-app/
├── src/
│   ├── tools/
│   │   ├── sentiment.tool.js
│   │   └── entity.tool.js
│   ├── flows/
│   │   └── analyze.flow.js
│   ├── cli.js
│   └── index.js
├── tests/
│   ├── tools.test.js
│   └── flows.test.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

### 1. Package.json Setup

```json
{
  "name": "text-analyzer",
  "version": "1.0.0",
  "description": "A CLI tool for analyzing text using Flowlite",
  "main": "src/index.js",
  "type": "module",
  "bin": {
    "analyze": "src/cli.js"
  },
  "scripts": {
    "start": "node src/cli.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^11.1.0",
    "dotenv": "^16.3.1",
    "figlet": "^1.7.0",
    "flowlite": "^1.0.0",
    "ora": "^7.0.1"
  },
  "devDependencies": {
    "vitest": "^0.34.6"
  }
}
```

### 2. Environment Variables Setup

Create a `.env.example` file with required API keys:

```
# API Keys
OPENAI_API_KEY=your_openai_api_key_here
SERPER_API_KEY=your_serper_api_key_here

# Configuration
LOG_LEVEL=INFO
```

### 3. Tool Implementation

Create tools in the `src/tools` directory:

```javascript
// src/tools/sentiment.tool.js
import { LLMTool } from 'flowlite';

export const sentimentTool = new (class extends LLMTool {
  constructor() {
    super({ name: 'analyzeSentiment', temperature: 0.3 });
  }
  
  async execute({ text }) {
    this.prompt = `Analyze sentiment: ${text}\nRespond as JSON: sentiment, score`;
    return super.execute({ text });
  }
  
  processResponse(response) {
    return JSON.parse(response.replace(/```json|```/g, '').trim());
  }
})();
```

```javascript
// src/tools/entity.tool.js
import { LLMTool } from 'flowlite';

export const entityTool = new (class extends LLMTool {
  constructor() {
    super({ name: 'extractEntities', temperature: 0.2 });
  }
  
  async execute({ text }) {
    this.prompt = `Extract entities from: ${text}\nRespond as JSON array`;
    return super.execute({ text });
  }
  
  processResponse(response) {
    return { entities: JSON.parse(response.replace(/```json|```/g, '').trim()) };
  }
})();
```

### 4. Flow Implementation

Create the flow in the `src/flows` directory:

```javascript
// src/flows/analyze.flow.js
import { Flow, param, ParamType, apiKey } from 'flowlite';
import { sentimentTool } from '../tools/sentiment.tool.js';
import { entityTool } from '../tools/entity.tool.js';

// Ultra-compact flow definition
export const analyzeFlow = Flow.create({
  name: 'analyze',
  input: [param('text', ParamType.STRING, 'Text to analyze')],
  output: [param('analysis', ParamType.OBJECT, 'Analysis results')],
  apiKeys: [apiKey('openai', 'OpenAI API Key', 'OPENAI_API_KEY')]
})
.next(async ({ text }) => {
  // Get sentiment and entities in parallel
  const [sentiment, entities] = await Promise.all([
    sentimentTool.call({ text }),
    entityTool.call({ text })
  ]);
  
  // Return combined results
  return { analysis: { ...sentiment, ...entities } };
});

// One-liner export for simple usage
export const analyze = text => analyzeFlow.run({ text });
```

### 5. CLI Implementation

Create the CLI interface:

```javascript
#!/usr/bin/env node
// src/cli.js
import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';
import dotenv from 'dotenv';
import { analyze } from './flows/analyze.flow.js';

// Load environment variables
dotenv.config();

// Display ASCII art title with gradient
const displayTitle = () => {
  try {
    const title = figlet.textSync('Text Analyzer', { font: 'Standard' });
    const lines = title.split('\n');
    
    lines.forEach((line, i) => {
      // Create a blue to cyan gradient
      const ratio = i / lines.length;
      const r = Math.floor(30 + ratio * 0);
      const g = Math.floor(144 + ratio * 70);
      const b = Math.floor(255 - ratio * 50);
      console.log(chalk.rgb(r, g, b)(line));
    });
  } catch (error) {
    console.log(chalk.bold.blue('=== Text Analyzer ==='));
  }
  console.log('\n' + chalk.bold.cyan('✨ Powered by Flowlite ✨') + '\n');
};

// Setup CLI program
const program = new Command()
  .name('analyze')
  .description('Analyze text for sentiment and entities')
  .version('1.0.0')
  .option('-f, --file <path>', 'Path to text file to analyze')
  .option('-t, --text <text>', 'Text to analyze')
  .option('-v, --verbose', 'Enable verbose output')
  .helpOption('-h, --help', 'Display help information');

// Main function
const main = async () => {
  displayTitle();
  
  program.parse(process.argv);
  const options = program.opts();
  
  // Validate input
  if (!options.text && !options.file) {
    console.log(chalk.yellow('No text provided. Use --text or --file option.'));
    program.help();
    return;
  }
  
  let text = options.text;
  
  // If file is provided, read it
  if (options.file) {
    try {
      const fs = await import('fs');
      text = fs.readFileSync(options.file, 'utf8');
      console.log(chalk.green(`✅ File loaded: ${options.file}`));
    } catch (error) {
      console.error(chalk.red(`❌ Error reading file: ${error.message}`));
      process.exit(1);
    }
  }
  
  // Validate API keys
  if (!process.env.OPENAI_API_KEY) {
    console.error(chalk.red('❌ Missing OPENAI_API_KEY in environment variables'));
    console.log(chalk.yellow('Create a .env file based on .env.example'));
    process.exit(1);
  }
  
  // Analyze text
  const spinner = ora('Analyzing text...').start();
  try {
    const result = await analyze(text);
    spinner.succeed('Analysis complete');
    
    // Display results
    console.log('\n' + chalk.bold.blue('=== Analysis Results ===') + '\n');
    console.log(chalk.bold('Sentiment:'), getSentimentEmoji(result.analysis.sentiment), result.analysis.sentiment);
    console.log(chalk.bold('Score:'), getScoreColor(result.analysis.score)(result.analysis.score));
    
    console.log(chalk.bold('\nEntities:'));
    if (result.analysis.entities.length === 0) {
      console.log(chalk.gray('  No entities found'));
    } else {
      result.analysis.entities.forEach(entity => {
        console.log(`  ${chalk.cyan('•')} ${entity}`);
      });
    }
    
    // Show verbose output if requested
    if (options.verbose) {
      console.log('\n' + chalk.bold.blue('=== Raw Analysis Data ==='));
      console.log(result.analysis);
    }
    
  } catch (error) {
    spinner.fail('Analysis failed');
    console.error(chalk.red(`❌ Error: ${error.message}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
};

// Helper functions
const getSentimentEmoji = (sentiment) => {
  const map = {
    positive: chalk.green('😊'),
    negative: chalk.red('😞'),
    neutral: chalk.yellow('😐')
  };
  return map[sentiment] || chalk.gray('❓');
};

const getScoreColor = (score) => {
  if (score > 0.5) return chalk.green;
  if (score > 0) return chalk.greenBright;
  if (score === 0) return chalk.yellow;
  if (score > -0.5) return chalk.redBright;
  return chalk.red;
};

// Run the CLI
main().catch(error => {
  console.error(chalk.red(`❌ Unhandled error: ${error.message}`));
  process.exit(1);
});
```

### 6. Main Entry Point

Create the main entry point:

```javascript
// src/index.js
import { analyze } from './flows/analyze.flow.js';

export { analyze };
```

### 7. Test Implementation

Create tests for tools and flows:

```javascript
// tests/tools.test.js
import { describe, it, expect } from 'vitest';
import { sentimentTool } from '../src/tools/sentiment.tool.js';
import { entityTool } from '../src/tools/entity.tool.js';

describe('Sentiment Tool', () => {
  it('should analyze positive sentiment', async () => {
    const result = await sentimentTool.call({ 
      text: 'I love this product, it works great!' 
    });
    
    expect(result.sentiment).toBe('positive');
    expect(result.score).toBeGreaterThan(0);
  });
  
  it('should analyze negative sentiment', async () => {
    const result = await sentimentTool.call({ 
      text: 'This is terrible, I hate it.' 
    });
    
    expect(result.sentiment).toBe('negative');
    expect(result.score).toBeLessThan(0);
  });
});

describe('Entity Tool', () => {
  it('should extract entities from text', async () => {
    const result = await entityTool.call({ 
      text: 'Apple released a new iPhone in California yesterday.' 
    });
    
    expect(result.entities).toBeInstanceOf(Array);
    expect(result.entities).toContain('Apple');
    expect(result.entities).toContain('iPhone');
    expect(result.entities).toContain('California');
  });
});
```

```javascript
// tests/flows.test.js
import { describe, it, expect } from 'vitest';
import { analyze } from '../src/flows/analyze.flow.js';

describe('Analyze Flow', () => {
  it('should analyze text and return sentiment and entities', async () => {
    const result = await analyze(
      'Apple is an amazing company that makes great products.'
    );
    
    expect(result.analysis).toBeDefined();
    expect(result.analysis.sentiment).toBeDefined();
    expect(result.analysis.score).toBeDefined();
    expect(result.analysis.entities).toBeInstanceOf(Array);
    expect(result.analysis.entities).toContain('Apple');
  });
});
```

### 8. README.md

Create a README for your application:

```markdown
# Text Analyzer

A powerful CLI tool for analyzing text sentiment and extracting entities using Flowlite.

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/text-analyzer.git
cd text-analyzer

# Install dependencies
npm install

# Link the CLI globally (optional)
npm link
```

## Configuration

Create a `.env` file based on the `.env.example` template:

```bash
cp .env.example .env
```

Edit the `.env` file and add your API keys:

```
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

```bash
# Analyze text directly
analyze --text "Apple is an amazing company that makes great products."

# Analyze text from a file
analyze --file path/to/text.txt

# Show verbose output
analyze --text "Your text here" --verbose

# Show help
analyze --help
```

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## License

MIT
```

## Advanced Patterns

### Flow Control and Branching

Flowlite supports conditional branching using the `.on()` method or with ternary operators for ultra-compact implementations:

```javascript
// Using .on() for explicit branching
export const routingFlow = Flow.create({ name: 'router' })
  .next(async ({ query }) => {
    if (query.includes('weather')) return 'weather';
    if (query.includes('news')) return 'news';
    return 'unknown';
  })
  .on('weather', weatherTool)
  .on('news', newsTool)
  .on('unknown', defaultTool);

// Using ternary operators for compact branching
export const compactRoutingFlow = Flow.create({ name: 'router' })
  .next(async ({ query }) => {
    // Determine intent
    const intent = query.includes('weather') ? 'weather' : 
                  query.includes('news') ? 'news' : 'unknown';
    
    // Call appropriate tool based on intent
    return intent === 'weather' ? weatherTool.call({ query }) :
           intent === 'news' ? newsTool.call({ query }) :
           defaultTool.call({ query });
  });
```

### Parallel Processing

For operations that can run independently, use Promise.all for parallel execution:

```javascript
export const parallelFlow = Flow.create({ name: 'parallel' })
  .next(async ({ userId }) => {
    // Run multiple operations in parallel
    const [profile, posts, friends] = await Promise.all([
      profileTool.call({ userId }),
      postsTool.call({ userId }),
      friendsTool.call({ userId })
    ]);
    
    // Combine results
    return { 
      user: { 
        ...profile,
        posts,
        friends
      }
    };
  });
```

### Error Handling

Implement robust error handling in your flows:

```javascript
export const robustFlow = Flow.create({ name: 'robust' })
  .next(async ({ query }) => {
    try {
      const result = await searchTool.call({ query });
      return { success: true, result };
    } catch (error) {
      console.error(`Search failed: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        fallbackResult: await fallbackTool.call({ query })
      };
    }
  })
  .next(async (state) => {
    // Handle success or failure
    if (!state.success) {
      console.log(`Using fallback result for: ${state.error}`);
      return { result: state.fallbackResult };
    }
    return state;
  });
```

## Logging and Monitoring

### Comprehensive Logging

Flowlite provides built-in logging capabilities:

```javascript
import { Flow, LLMTool, LogLevel } from 'flowlite';

// Set log level at flow creation
export const loggingFlow = Flow.create({ 
  name: 'logging',
  logLevel: process.env.NODE_ENV === 'production' 
    ? LogLevel.ERROR 
    : LogLevel.DEBUG
})
.next(async (state) => {
  // Log at different levels
  loggingFlow.trace('Detailed tracing information');
  loggingFlow.debug('Debugging information', { state });
  loggingFlow.info('Processing started');
  loggingFlow.warn('Potential issue detected');
  loggingFlow.error('An error occurred', { error: 'details' });
  
  return state;
});

// Tool with logging
export const loggingTool = new (class extends LLMTool {
  constructor() {
    super({ 
      name: 'loggingTool',
      logLevel: LogLevel.DEBUG
    });
  }
  
  async execute(state) {
    this.debug('Tool execution started', { input: state });
    
    try {
      // Tool logic
      const result = await this.processData(state);
      
      this.info('Tool execution completed', { 
        executionTime: '100ms',
        outputSize: JSON.stringify(result).length
      });
      
      return result;
    } catch (error) {
      this.error('Tool execution failed', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
})();
```

### Performance Monitoring

Track performance metrics for your flows and tools:

```javascript
// Get performance statistics
const flow = Flow.create({ name: 'performanceFlow' });

// Run the flow multiple times
await flow.run({ query: 'data1' });
await flow.run({ query: 'data2' });

// Get statistics
const stats = flow.getStats();
console.log(`Total executions: ${stats.executionCount}`);
console.log(`Average execution time: ${stats.averageExecutionTime}ms`);
console.log(`Error rate: ${stats.errorRate * 100}%`);

// Reset statistics
flow.resetStats();
```

This guide provides a comprehensive overview of how to develop with Flowlite, from basic concepts to advanced patterns and complete CLI applications. Follow these guidelines to create elegant, powerful, and maintainable flows.
