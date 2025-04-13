# Flowlite Development Guide

This guide provides best practices and patterns for developing with the Flowlite framework, including how to create tools using primitives and build ultra-compact flows.

## Table of Contents

- [Tool Primitive Architecture](#tool-primitive-architecture)
- [Core Concepts](#core-concepts)
- [Ultra-Compact Flow Development](#ultra-compact-flow-development)
- [Tool-Centric Chaining](#tool-centric-chaining)
- [Building a Complete CLI Application](#building-a-complete-cli-application)
- [Advanced Patterns](#advanced-patterns)
- [Logging and Monitoring](#logging-and-monitoring)
- [Secure Credential Management](#secure-credential-management)
- [State Management](#state-management)

## Tool Primitive Architecture

Flowlite's power comes from its robust tool primitives and inheritance model. The framework provides specialized base classes that handle common functionality, allowing you to focus on your tool's unique logic.

```ditaa
+------------------------+
|        Tool            |
|------------------------|
| + name                 |
| + description          |
| + input                |
| + output               |
| + execute()            |
| + call()               |
| + asFunction()         |
| + withApiKey()         |
| + withOptions()        |
| + then()               |
| + branch()             |
| + switch()             |
| + catch()              |
+------------------------+
           ^
           |
           |
+------------------------+     +------------------------+
|       LLMTool          |     |       APITool          |
|------------------------|     |------------------------|
| + provider             |     | + baseUrl             |
| + model                |     | + fetchWithApiKey()   |
| + temperature          |     | + handleApiError()    |
| + maxTokens            |     | + withRetry()         |
| + retries              |     | + withRateLimit()     |
| + validateJSON         |     | + withTimeout()       |
| + repairJSON           |     |                       |
| + rateLimit            |     |                       |
+------------------------+     +------------------------+
```

### Why Use Tool Primitives?

The tool primitive approach provides several key advantages:

1. **Reduced Boilerplate**: Base classes handle common functionality like error handling, retries, and validation
2. **Consistent Behavior**: All tools inherit the same core capabilities and interfaces
3. **Advanced Features Built-in**: Rate limiting, JSON validation, error handling, and retry mechanisms come standard
4. **Separation of Concerns**: Focus on your tool's unique logic, not infrastructure code
5. **Maintainability**: Changes to base classes automatically benefit all derived tools
6. **Testability**: Base classes can be tested independently of specific tool implementations

### Tool Creation Best Practices

When creating tools in Flowlite, always follow these guidelines:

1. **Always Extend Base Classes**: Never create standalone tools; always extend from `Tool`, `LLMTool`, or `APITool`
2. **Leverage Built-in Features**: Take advantage of the features provided by base classes
3. **Clear Input/Output Definitions**: Define clear input parameters and output schemas
4. **Focused Responsibility**: Each tool should do one thing well
5. **Error Handling**: Let base classes handle common errors, only add custom error handling when needed
6. **Validation**: Use schema validation for structured outputs
7. **Documentation**: Document your tool's behavior and requirements

Here's how to choose which base class to extend:

- **Tool**: For general-purpose tools with custom logic
- **LLMTool**: For AI-powered tools using large language models
- **APITool**: For tools that interact with external APIs

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

Tools are the building blocks of flows. Flowlite provides a powerful class-based architecture for creating tools through inheritance:

```javascript
import { LLMTool, param, ParamType } from 'flowlite';

// Class-based Tool using inheritance from LLMTool primitive
class SentimentAnalysisTool extends LLMTool {
  constructor() {
    super({
      name: 'analyzeSentiment',
      description: 'Analyzes the sentiment of text',
      input: [
        param('text', ParamType.STRING, 'Text to analyze')
      ],
      // Leverage built-in features of the LLMTool primitive
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      temperature: 0.3,
      retries: 3,
      validateJSON: true,
      repairJSON: true
    });
  }
  
  async execute({ text }) {
    // The LLMTool primitive handles:
    // - API key validation
    // - Rate limiting
    // - Retries with exponential backoff
    // - JSON validation and repair
    // - Error handling
    
    return await this.call({
      prompt: `Analyze sentiment: ${text}\nRespond as JSON: sentiment, score`,
      format: 'json',
      schema: {
        type: 'object',
        required: ['sentiment', 'score'],
        properties: {
          sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
          score: { type: 'number', minimum: -1, maximum: 1 }
        }
      }
    });
  }
}

// Create an instance of the tool
export const sentimentTool = new SentimentAnalysisTool();
```

#### Choosing the Right Tool Primitive

Flowlite provides three main tool primitives, each designed for specific use cases:

1. **Tool**: The base class for all tools. Use this for general-purpose tools with custom logic.

   ```javascript
   class TextProcessingTool extends Tool {
     constructor() {
       super({
         name: 'textProcessor',
         description: 'Processes text in various ways'
       });
     }
     
     execute({ text, operation = 'uppercase' }) {
       // Your custom logic here
       return { result: text.toUpperCase() };
     }
   }
   ```

2. **LLMTool**: Specialized for working with Large Language Models. Provides features like:
   - JSON validation and repair
   - Rate limiting and throttling
   - Exponential backoff for retries
   - Schema validation for structured outputs

   ```javascript
   class SummarizeTool extends LLMTool {
     constructor() {
       super({ 
         name: 'summarize',
         validateJSON: true,
         repairJSON: true
       });
     }
     
     async execute({ text, length = 'short' }) {
       return await this.call({
         prompt: `Summarize in ${length} length: ${text}`,
         format: 'json'
       });
     }
   }
   ```

3. **APITool**: Designed for working with external APIs. Provides features like:
   - API key management
   - Error handling and response processing
   - Automatic retries for transient failures
   - Timeout management

   ```javascript
   class WeatherTool extends APITool {
     constructor() {
       super({
         name: 'getWeather',
         retries: 3
       });
       this.withApiKey('WEATHER_API_KEY');
     }
     
     async execute({ location }) {
       const response = await this.fetchWithApiKey(
         `https://api.weather.com/current?location=${encodeURIComponent(location)}`
       );
       return await response.json();
     }
   }
   ```

#### Advanced Tool Features

The tool primitives provide advanced features that you should leverage:

1. **Rate Limiting**: Prevent API quota issues
   ```javascript
   super({
     rateLimit: {
       openai: { tokensPerMinute: 10000, requestsPerMinute: 60 },
       anthropic: { tokensPerMinute: 10000, requestsPerMinute: 20 }
     }
   });
   ```

2. **JSON Validation**: Ensure structured outputs
   ```javascript
   return await this.call({
     prompt: `Extract entities from: ${text}`,
     format: 'json',
     schema: {
       type: 'object',
       required: ['entities'],
       properties: {
         entities: { type: 'array', items: { type: 'string' } }
       }
     }
   });
   ```

3. **Custom Retry Logic**: Handle specific error conditions
   ```javascript
   return await this.call({
     prompt: `Process this: ${input}`,
     retryCondition: (error, attempt) => {
       if (error.message.includes('rate limit')) {
         return attempt < 10; // Retry rate limits up to 10 times
       }
       return attempt < 3; // Only retry other errors up to 3 times
     }
   });
   ```

4. **Error Handling**: Customize error responses
   ```javascript
   super({
     errorHandling: {
       retryableErrors: ['rate_limit', 'server_error'],
       nonRetryableErrors: ['invalid_api_key', 'content_policy_violation'],
       fallbackProvider: 'anthropic'  // Fallback provider if primary fails
     }
   });
   ```

## Tool-Centric Chaining

Flowlite now supports a tool-centric approach with chainable operations, inspired by JavaScript Promises. This approach offers a more intuitive and flexible way to build flows.

### Chainable Tool API

Tools can now be chained together using methods like:

```javascript
import { Tool } from 'flowlite';

// Create tools
const textProcessor = new Tool({ name: 'textProcessor' })
  .withExecute(async ({ text }) => {
    return { processed: text.toUpperCase() };
  });

const sentimentAnalyzer = new Tool({ name: 'sentimentAnalyzer' })
  .withExecute(async ({ processed }) => {
    const score = processed.includes('GOOD') ? 1 : -1;
    return { sentiment: score > 0 ? 'positive' : 'negative', score };
  });

// Chain tools together
const chain = textProcessor
  .then(sentimentAnalyzer)
  .catch(error => {
    console.error('Error:', error);
    return { error: error.message };
  });

// Run the chain
const result = await chain.call({ text: 'This is good!' });
console.log(result); // { processed: 'THIS IS GOOD!', sentiment: 'positive', score: 1 }
```

### Conditional Branching

The `branch()` method allows for conditional execution paths:

```javascript
// Create formatters for different sentiments
const positiveFormatter = new Tool({ name: 'positiveFormatter' })
  .withExecute(async (input) => {
    return { message: `😊 Positive: ${input.processed}` };
  });

const negativeFormatter = new Tool({ name: 'negativeFormatter' })
  .withExecute(async (input) => {
    return { message: `😢 Negative: ${input.processed}` };
  });

// Create a chain with branching
const chain = textProcessor
  .then(sentimentAnalyzer)
  .branch(
    (input) => input.sentiment === 'positive',
    positiveFormatter,
    negativeFormatter
  );

// Run the chain
const result = await chain.call({ text: 'This is good!' });
console.log(result.message); // 😊 Positive: THIS IS GOOD!
```

### Switch-Case Branching

The `switch()` method provides multi-path branching:

```javascript
// Create specialized formatters
const uppercaseFormatter = new Tool({ name: 'uppercaseFormatter' })
  .withExecute(async (input) => ({
    message: `UPPERCASE: ${input.result}`
  }));

const lowercaseFormatter = new Tool({ name: 'lowercaseFormatter' })
  .withExecute(async (input) => ({
    message: `lowercase: ${input.result}`
  }));

// Create a switch chain
const switchChain = textProcessor
  .switch('operation', {
    'uppercase': uppercaseFormatter,
    'lowercase': lowercaseFormatter
  }, defaultFormatter);

// Run with different operations
const result = await switchChain.call({
  text: 'Testing the switch functionality',
  operation: 'uppercase'
});
```

### Non-Linear Navigation with Flow Registry

For complex non-linear flows, use the `FlowRegistry`:

```javascript
import { flowRegistry, Tool } from 'flowlite';

// Register segments
flowRegistry.createSegment('start', startTool);
flowRegistry.createSegment('process', processTool);
flowRegistry.createSegment('format', formatTool);

// Create a tool with goto
const router = new Tool({ name: 'router' })
  .withExecute(async (input) => {
    if (input.needsProcessing) {
      return { _goto: 'process' };
    } else {
      return { _goto: 'format' };
    }
  });

// Execute the flow starting from 'start'
const result = await flowRegistry.execute('start', { input: 'hello' });
```

### Converting Between Approaches

Flowlite maintains backward compatibility with conversion methods:

```javascript
// Convert a Flow to a tool chain
const toolChain = myFlow.toToolChain();

// Create a Flow from a tool chain
const newFlow = Flow.fromToolChain(toolChain, {
  name: 'convertedFlow',
  description: 'A flow created from a tool chain'
});
```

## Ultra-Compact Flow Development

Flowlite supports an ultra-compact development style that minimizes boilerplate while maintaining readability and power.

### One-Step Tool Definition

Define and instantiate tools in a single step using anonymous class expressions:

```javascript
// Define and export tool directly as an instance
export const sentimentTool = new (class extends LLMTool {
  constructor() {
    super({ 
      name: 'analyzeSentiment', 
      description: 'Analyzes the sentiment of text',
      // Leverage built-in features of the LLMTool primitive
      temperature: 0.3,
      validateJSON: true,
      repairJSON: true,
      retries: 3,
      rateLimit: {
        openai: { tokensPerMinute: 10000, requestsPerMinute: 60 }
      }
    });
  }
  
  async execute({ text }) {
    // The LLMTool primitive handles all the complex operations
    return await this.call({
      prompt: `Analyze sentiment: ${text}\nRespond as JSON: sentiment, score`,
      format: 'json',
      schema: {
        type: 'object',
        required: ['sentiment', 'score'],
        properties: {
          sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
          score: { type: 'number', minimum: -1, maximum: 1 }
        }
      }
    });
  }
})();
```

### Concise Flow Definitions

Create minimal flow definitions that focus solely on the sequence of operations, using tool primitives for the heavy lifting:

```javascript
// Ultra-compact flow definition
export const analyzeFlow = Flow.create({
  name: 'analyze',
  description: 'Analyzes text for sentiment and entities',
  input: [param('text', ParamType.STRING, 'Text to analyze')],
  output: [param('analysis', ParamType.OBJECT, 'Analysis results')],
  apiKeys: [apiKey('openai', 'OpenAI API Key', 'OPENAI_API_KEY')]
})
.next(async ({ text }) => {
  // Get sentiment and entities in parallel
  // Each tool handles its own error handling, retries, and validation
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

Here's a complete example of an ultra-compact flow file that leverages tool primitives:

```javascript
/**
 * Text Analysis Flow - Ultra-compact implementation
 */

import { Flow, LLMTool, param, ParamType, apiKey } from 'flowlite';

// ===== Tools =====

// Define and export tools directly as instances
export const sentimentTool = new (class extends LLMTool {
  constructor() {
    super({ 
      name: 'analyzeSentiment', 
      description: 'Analyzes the sentiment of text',
      // Leverage built-in features of the LLMTool primitive
      temperature: 0.3,
      validateJSON: true,
      repairJSON: true,
      retries: 3,
      rateLimit: {
        openai: { tokensPerMinute: 10000, requestsPerMinute: 60 }
      }
    });
  }
  
  async execute({ text }) {
    // The LLMTool primitive handles all the complex operations
    return await this.call({
      prompt: `Analyze sentiment: ${text}\nRespond as JSON: sentiment, score`,
      format: 'json',
      schema: {
        type: 'object',
        required: ['sentiment', 'score'],
        properties: {
          sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
          score: { type: 'number', minimum: -1, maximum: 1 }
        }
      }
    });
  }
})();

export const entityTool = new (class extends LLMTool {
  constructor() {
    super({ 
      name: 'extractEntities', 
      description: 'Extracts entities from text',
      // Leverage built-in features of the LLMTool primitive
      temperature: 0.2,
      validateJSON: true,
      repairJSON: true,
      retries: 2
    });
  }
  
  async execute({ text }) {
    // The LLMTool primitive handles all the complex operations
    return await this.call({
      prompt: `Extract entities from: ${text}\nRespond as JSON array`,
      format: 'json',
      schema: {
        type: 'object',
        required: ['entities'],
        properties: {
          entities: { 
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    });
  }
})();

// ===== Flow =====

// Ultra-compact flow definition
export const analyzeFlow = Flow.create({
  name: 'analyze',
  description: 'Analyzes text for sentiment and entities',
  input: [param('text', ParamType.STRING, 'Text to analyze')],
  output: [param('analysis', ParamType.OBJECT, 'Analysis results')],
  apiKeys: [apiKey('openai', 'OpenAI API Key', 'OPENAI_API_KEY')]
})
.next(async ({ text }) => {
  // Get sentiment and entities in parallel
  // Each tool handles its own error handling, retries, and validation
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
})();
```

```javascript
// src/tools/entity.tool.js
import { LLMTool } from 'flowlite';

export const entityTool = new (class extends LLMTool {
  constructor() {
    super({
      name: 'extractEntities',
      description: 'Extracts entities from text',
      temperature: 0.2
    });
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

### 6. Testing Setup

**IMPORTANT: All CLI applications must include comprehensive test suites for each tool and flow.**

Create a test directory with separate test files for tools and flows. Each tool should be individually tested to ensure proper functionality.

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

### 7. Test Coverage Guidelines

When creating tests for CLI applications, ensure:

1. **All tools are individually tested** - Each tool should have its own test suite with tests for:
   - Normal operation with various inputs
   - Edge cases and boundary conditions
   - Error handling and recovery

2. **Flows are tested as integrated units** - Test the complete flow to ensure tools work together correctly:
   - Mock individual tool responses for deterministic testing
   - Test the flow's error handling capabilities
   - Verify correct state transformations between steps

3. **CLI interface is tested** - Test the command-line interface functionality:
   - Command-line argument parsing
   - Input validation
   - Output formatting

4. **Test coverage targets** - Aim for at least 80% test coverage for:
   - All tool implementations
   - Flow logic
   - CLI interface code

This comprehensive testing approach ensures that your CLI application is robust, reliable, and maintainable.

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

## Secure Credential Management

Flowlite CLI applications should follow a standardized approach to credential management that balances security and usability.

### Core Principles

1. **Security First**:
   - Never hardcode API keys in application code
   - Use secure storage options (system keychain, encrypted local storage)
   - Provide multiple fallback mechanisms

2. **User Experience**:
   - Minimal output during normal operation
   - Only show detailed credential checking information when necessary
   - Allow users to manage existing credentials easily

3. **Standardized Implementation**:
   - Use a multi-layered approach to find credentials (env vars → .env files → system keychain → interactive prompting)
   - Consistent CLI options across all applications
   - Clear help output showing required vs optional keys

### Implementation Guide

1. **Required Dependencies**:

```javascript
// package.json dependencies
{
  "dependencies": {
    "commander": "^11.1.0",
    "dotenv": "^16.5.0",
    "inquirer": "^9.2.12",
    "keytar": "^7.9.0"
  }
}
```

2. **Credential Management Functions**:

```javascript
// Initialize credentials storage
const initCredentialsStorage = async () => {
  try {
    // Try to use keytar (system keychain)
    try {
      await keytar.findCredentials('test');
      return;
    } catch (error) {
      // Keytar not available, use local storage
      try {
        const localStorePath = path.join(__dirname, '.credentials.json');
        try {
          const data = await fs.readFile(localStorePath, 'utf8');
          localStore = JSON.parse(data);
        } catch (err) {
          // File doesn't exist or is invalid, create new store
          localStore = {};
          await fs.writeFile(localStorePath, JSON.stringify(localStore), 'utf8');
        }
      } catch (fsError) {
        console.error('Failed to initialize local credential storage:', fsError.message);
        localStore = {};
      }
    }
  } catch (error) {
    console.error('Failed to initialize credential storage:', error.message);
  }
};

// Get credential from various sources
const getCredential = async (key, verbose = false) => {
  // First check environment variables
  if (process.env[key]) {
    if (verbose) console.log(`${chalk.green('✓')} Found ${key} in environment variables`);
    return process.env[key];
  }
  
  // Then check system keychain
  try {
    const credential = await keytar.getPassword(SERVICE_NAME, key);
    if (credential) {
      if (verbose) console.log(`${chalk.green('✓')} Found ${key} in system keychain`);
      return credential;
    }
  } catch (error) {
    // Keytar not available, check local store
    if (localStore && localStore[key]) {
      if (verbose) console.log(`${chalk.green('✓')} Found ${key} in local storage`);
      return localStore[key];
    }
  }
  
  if (verbose) console.log(`${chalk.yellow('!')} ${key} not found in any storage`);
  return null;
};

// Prompt for credential with option to keep existing value
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

// Main credential management function
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
      const isOptional = secret === 'EXAMPLE_OPTIONAL_KEY'; // Mark optional keys
      console.log(`  ${isOptional ? chalk.yellow('○') : chalk.green('●')} ${secret}${isOptional ? ' (optional)' : ''}`);
    }
    console.log('');
  }
  
  // First, check all keys to see if any are missing
  const keyStatus = {};
  for (const secret of requiredSecrets) {
    const isOptional = secret === 'EXAMPLE_OPTIONAL_KEY'; // Define which keys are optional
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
    // Only show a summary if we're in verbose mode
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
  
  // If we're forcing secrets or missing some, prompt for each one
  if (options.interactive) {
    for (const secret of requiredSecrets) {
      const isOptional = secret === 'EXAMPLE_OPTIONAL_KEY';
      const existingValue = keyStatus[secret].value;
      
      // Skip optional keys that are missing if not forcing
      if (!options.forceSecrets && isOptional && !existingValue) {
        continue;
      }
      
      // Prompt for the key with appropriate description
      const value = await promptForCredential(secret, getKeyDescription(secret), existingValue);
      
      if (value) {
        process.env[secret] = value;
        result.credentials[secret] = value;
        
        if (!existingValue) {
          result.available.push(secret);
          const index = result.missing.indexOf(secret);
          if (index !== -1) {
            result.missing.splice(index, 1);
          }
        }
      }
    }
  }
  
  return result;
};
```

3. **CLI Integration**:

```javascript
// Set up command line options
program
  .name('my-cli-app')
  .description('My Flowlite CLI App')
  .version('1.0.0')
  .option('--force-secrets', 'Force prompt for API keys, even if they exist')
  .option('--gen-env', 'Generate .env-example file')
  .helpOption('-h, --help', 'Display help information');

// Main function
async function main() {
  try {
    // Handle --help flag manually to ensure async displayHelp works
    if (process.argv.includes('-h') || process.argv.includes('--help')) {
      await displayHelp();
      process.exit(0);
    }
    
    program.parse(process.argv);
    const options = program.opts();
    
    // Display version if version flag
    if (options.version) {
      console.log(`v${version}`);
      process.exit(0);
    }
    
    // Generate .env-example if requested
    if (options.genEnv) {
      displayTitle();
      await generateEnvExample(requiredSecrets, path.join(__dirname, '.env-example'));
      console.log(chalk.green(`✅ Generated .env-example file with required API keys`));
      process.exit(0);
    }
    
    // Display title
    displayTitle();
    
    // First, load credentials and set environment variables
    // This will prompt for any missing required API keys
    const credentialStatus = await manageCredentials(requiredSecrets, { 
      interactive: true, 
      setEnv: true,
      forceSecrets: options.forceSecrets,
      // Only show verbose output if forcing secrets
      verbose: options.forceSecrets
    });
    
    // Run your application logic here
    // ...
  } catch (error) {
    console.error(chalk.bold.red(`❌ Error: ${error.message}`));
    process.exit(1);
  }
}
```

4. **Help Output**:

```javascript
// Display help information
const displayHelp = async () => {
  displayTitle();
  
  console.log(chalk.bold.underline('\nUsage:'));
  console.log('  my-cli-app [options]\n');
  
  console.log(chalk.bold.underline('Options:'));
  console.log(`  -h, --help           Show this help information`);
  console.log(`  -v, --version        Show version number`);
  console.log(`  --force-secrets      Force prompt for API keys, even if they exist`);
  console.log(`  --gen-env            Generate .env-example file\n`);
  
  console.log(chalk.bold.underline('Required API Keys:'));
  console.log(`  ${chalk.green('●')} ${chalk.yellow('OPENAI_API_KEY')}        Required for LLM functionality`);
  console.log(`  ${chalk.yellow('○')} ${chalk.yellow('OPTIONAL_API_KEY')}      Optional for enhanced features\n`);
  
  console.log(chalk.bold.underline('How It Works:'));
  console.log(`  [Include a brief description of how your application works]\n`);
};
```

### Key User Experience Features

1. **Minimal Output During Normal Operation**:
   - When all required keys are available, no credential checking information is displayed
   - Only show detailed credential information when keys are missing or when using `--force-secrets`
   - Focus on the application's primary functionality

2. **Interactive Credential Management**:
   - When using `--force-secrets`, users can review all their API keys
   - For each key, users can choose to keep or update the existing value
   - New keys are securely saved for future use

3. **Clear Help Information**:
   - Help output clearly shows which keys are required vs optional
   - Includes a description of how the application works
   - Documents all available CLI options

4. **Parameter Guidance**:
   - Always show required parameters when the app launches without sufficient arguments
   - Provide clear, concise descriptions of each required and optional parameter
   - Include examples of how to use the parameters
   - Direct users to the help command for more detailed information

### Example Parameter Guidance

When a user runs an application without required parameters, show a clear error message and parameter guide:

```javascript
if (args.length < requiredArgCount) {
  console.log(chalk.red('Error: Missing required arguments'));
  console.log(chalk.yellow('\nRequired parameters:'));
  console.log(`  ${chalk.cyan('<input-file>')}    Path to the input file`);
  console.log(`  ${chalk.cyan('<output-file>')}   Path where the output will be saved\n`);
  console.log(`For more information, use ${chalk.green('--help')}\n`);
  process.exit(1);
}
```

For applications with optional parameters, show both required and optional parameters:

```javascript
if (!options.requiredParam) {
  console.log(chalk.red('Error: Missing required parameter'));
  console.log(chalk.yellow('\nRequired parameter:'));
  console.log(`  ${chalk.cyan('--required-param <value>')}    Description of required parameter\n`);
  console.log(chalk.yellow('Optional parameters:'));
  console.log(`  ${chalk.cyan('--optional-param1 <value>')}    Description of optional parameter 1`);
  console.log(`  ${chalk.cyan('--optional-param2 <value>')}    Description of optional parameter 2`);
  console.log(`\nFor more information, use ${chalk.green('--help')}\n`);
  process.exit(1);
}
```

### Parameter Validation

Always validate user input to ensure it meets the requirements:

```javascript
validate: async (input) => {
  if (!input.trim()) return 'This field is required';
  
  // Check if file exists
  try {
    const fullPath = path.resolve(input);
    await fs.access(fullPath);
    return true;
  } catch (error) {
    return `File not found: ${input}`;
  }
}
```

For numeric inputs:

```javascript
validate: (input) => {
  const num = parseInt(input);
  if (isNaN(num)) return 'Please enter a valid number';
  if (num < 1) return 'Number must be greater than 0';
  return true;
}
```

### Interactive Parameter Prompting

When a user runs an application without required parameters, instead of just showing an error message, prompt for them interactively:

```javascript
// Prompt for required parameters
const promptForParameters = async () => {
  const questions = [
    {
      type: 'input',
      name: 'requiredParam1',
      message: 'Enter the required parameter 1:',
      validate: (input) => {
        if (!input.trim()) return 'This parameter is required';
        return true;
      }
    },
    {
      type: 'input',
      name: 'requiredParam2',
      message: 'Enter the required parameter 2:',
      validate: (input) => {
        if (!input.trim()) return 'This parameter is required';
        return true;
      }
    }
  ];

  return inquirer.prompt(questions);
};

// In your main function
let param1, param2;

// Check if we have the required command line arguments
if (program.args.length >= 2) {
  param1 = program.args[0];
  param2 = program.args[1];
} else {
  // If not, prompt for them interactively
  console.log(chalk.yellow('Missing required parameters. Please enter them below:'));
  const params = await promptForParameters();
  param1 = params.requiredParam1;
  param2 = params.requiredParam2;
}
```

For applications with optional parameters, provide defaults or prompt for them as needed:

```javascript
// For command-line applications with options
if (nonUtilityOptions.length > 0) {
  // Command-line mode with options
  let details = {
    requiredParam: options.requiredParam,
    optionalParam1: options.optionalParam1,
    optionalParam2: options.optionalParam2
  };
  
  // Prompt for any missing required parameters
  if (!details.requiredParam) {
    const { requiredParam } = await inquirer.prompt([{
      type: 'input',
      name: 'requiredParam',
      message: 'Enter the required parameter:',
      validate: input => input.trim() ? true : 'This parameter is required'
    }]);
    details.requiredParam = requiredParam;
  }
  
  // Set defaults for missing optional parameters
  details.optionalParam1 = details.optionalParam1 || 'Default value 1';
  details.optionalParam2 = details.optionalParam2 || 'Default value 2';
  
  // Continue with application logic
}
```

### Example Implementation

For reference implementations, see the following example apps:
- `example_apps/article-writer` - Article generation with OpenAI and Perplexity
- `example_apps/ocr-pdf` - PDF OCR processing with multiple engines

These examples demonstrate the standardized approach to credential management with minimal output during normal operation and interactive parameter prompting.

## State Management

### State Accumulation Model

Flowlite uses a **state accumulation model** for managing data between flow nodes. Understanding this model is crucial for building effective flows:

```javascript
// Flow with multiple nodes contributing to state
const flow = Flow.create()
  .next(() => {
    // First node returns only part1
    return { part1: 'value1' };
  })
  .next(state => {
    // Second node can access part1 from state
    console.log(state.part1); // 'value1'
    // And returns only part2
    return { part2: 'value2' };
  })
  .next(state => {
    // Third node can access both part1 and part2
    console.log(state.part1, state.part2); // 'value1' 'value2'
    // And returns only part3
    return { part3: 'value3' };
  });

// Run the flow with an initial state
const result = await flow.run({ initial: 'initialValue' });
console.log(result);
// Output: { initial: 'initialValue', part1: 'value1', part2: 'value2', part3: 'value3' }
```

#### How State Accumulation Works

1. **Initial State**: The flow begins with an initial state object passed to `flow.run()`
2. **Node Execution**: Each node function receives the current accumulated state as its input parameter
3. **Return Values**: Nodes return an object containing only their specific contributions to the state
4. **State Merging**: The Flow engine merges each node's return value into the accumulated state using `{ ...state, ...nodeResult }`
5. **Final State**: The final state contains the initial state plus all accumulated node contributions

This model has several important implications:

- **Focused Responsibility**: Nodes only need to return the specific state properties they're responsible for
- **Progressive Accumulation**: Each node has access to all previously accumulated state
- **Immutable Updates**: The original state is never modified; instead, a new state is created at each step
- **Automatic Merging**: The Flow engine handles merging state automatically, reducing boilerplate

#### State Management Best Practices

1. **Return Only What You Change**: Nodes should only return the specific properties they modify or add
2. **Avoid Returning Undefined**: Always return an object, even if empty `{}`
3. **Use Destructuring for Clarity**: When accessing state, destructure to make dependencies clear:
   ```javascript
   .next(({ part1, part2 }) => {
     // This clearly shows which parts of state you're using
     return { combined: `${part1} and ${part2}` };
   })
   ```
4. **Avoid Side Effects**: Treat the state as immutable; don't modify it directly
5. **Consistent Property Names**: Use consistent property names across nodes for clarity
