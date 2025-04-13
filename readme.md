# Flowlite

A lightweight, composable JavaScript framework for building AI-powered tools and flows with minimal boilerplate.

## Overview

Flowlite is a modern JavaScript framework that makes it easy to build powerful AI tools and chain them into structured workflows. Unlike traditional frameworks that focus primarily on flow orchestration, Flowlite's power comes from its robust tool primitives and inheritance model, with flows simply handling the orchestration.

```ditaa
+------------------------+       +------------------------+       +------------------------+
| Tool Primitives        |       | Tool Composition       |       | Flow Orchestration     |
|                        |       |                        |       |                        |
| - Tool (base class)    |<----->| - Tool inheritance     |<----->| - Flow.create         |
| - LLMTool              |       | - Tool composition     |       | - next() & on()       |
| - APITool              |       | - Tool chaining        |       | - Parallel execution   |
+------------------------+       +------------------------+       +------------------------+
        ^                                  ^                               ^
        |                                  |                               |
        v                                  v                               v
+------------------------+       +------------------------+       +------------------------+
| Advanced Features      |       | Developer Experience   |       | Error Handling        |
|                        |       |                        |       |                        |
| - Rate limiting        |       | - Self-documenting     |       | - Automatic retries   |
| - Throttling           |       | - Input/output schemas |       | - Exponential backoff |
| - JSON validation      |       | - API key management   |       | - Fallback strategies |
+------------------------+       +------------------------+       +------------------------+
```

## Why Flowlite?

The real power of Flowlite lies in its **tool primitives** and **inheritance model**:

1. **Self-Describing Tools**: Tools define their inputs, outputs, API keys, and metadata, making them self-documenting and composable.

2. **Specialized Primitives**: Built-in primitives for common operations (LLM calls, API requests, memory management) eliminate boilerplate code.

3. **Inheritance-Based Design**: Extend base tool classes to create specialized tools with minimal code.

4. **Smart Defaults**: Robust defaults for error handling, retry logic, and validation mean less code for common patterns.

5. **Flow Orchestration**: Flows simply handle the chaining of tools, with the complexity encapsulated in the tools themselves.

## Key Features

- **Powerful Tool Primitives** - Specialized base classes for common operations:
  - `LLMTool`: Built-in retry logic, JSON validation, rate limiting, and schema validation
  - `APITool`: Automatic retries, error handling, and response processing
  - `Tool`: Base class with logging, statistics, and metadata

- **Minimal Boilerplate** - Create complex AI tools with just a few lines of code

- **Self-Documenting Design** - Tools declare their inputs, outputs, and requirements

- **Advanced Error Handling** - Built-in retry logic, exponential backoff, and rate limiting

- **Composable Architecture** - Chain tools together into complex workflows

- **Developer Experience** - Clean, chainable API with intelligent defaults

- **Tool-Centric Chaining** - Intuitive Promise-like chaining of tools:
  - `then()`: Sequential chaining of tools
  - `branch()`: Conditional branching based on results
  - `switch()`: Switch-case branching for multiple paths
  - `catch()`: Error handling for robust flows

- **Non-Linear Navigation** - Complex flow patterns with named segments and goto operations

## LLM Tool Example

Here's how easy it is to create a powerful LLM tool with Flowlite:

```js
import { LLMTool, param, ParamType } from 'flowlite';

// Create a summarization tool with just a few lines of code
const summarize = new class extends LLMTool {
  constructor() {
    super({
      name: 'summarize',
      description: 'Summarizes text content',
      input: [
        param('text', ParamType.STRING, 'Text to summarize'),
        param('length', ParamType.STRING, 'Desired summary length', true)
      ],
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      // Smart defaults for error handling and validation
      retries: 3,
      validateJSON: true,
      repairJSON: true
    });
  }
  
  async execute({ text, length = 'short' }) {
    // The LLMTool base class handles:
    // - API key validation
    // - Rate limiting
    // - Retries with exponential backoff
    // - JSON validation and repair
    // - Error handling
    
    const result = await this.call({
      prompt: `Summarize the following text in a ${length} summary:\n\n${text}`,
      format: 'json', // Request JSON output
      // Schema for validation
      schema: {
        type: 'object',
        required: ['summary'],
        properties: {
          summary: { type: 'string' },
          key_points: { type: 'array', items: { type: 'string' } }
        }
      }
    });
    
    return result;
  }
}();

// Use the tool
const result = await summarize.call({
  text: "Lorem ipsum dolor sit amet...",
  length: "medium"
});

console.log(result.summary);
```

## Chaining Tools with Flows

Once you have powerful tools, you can chain them together into flows:

```js
import { Flow } from 'flowlite';
import { getWeather, summarize, translateText } from './my-tools.js';

// Create a weather report flow
const weatherReportFlow = Flow.create({ 
  name: 'weatherReport',
  description: 'Generate a weather report in any language'
})
  .next(async ({ city, language }) => {
    // Get the weather data
    const weatherData = await getWeather.call({ location: city });
    
    // Create a detailed report
    const report = await summarize.call({
      text: `Weather report for ${city}: Temperature is ${weatherData.temperature}°F with ${weatherData.conditions}.`,
      length: 'medium'
    });
    
    // Translate if needed
    if (language && language.toLowerCase() !== 'english') {
      const translated = await translateText.call({
        text: report.summary,
        targetLanguage: language
      });
      return { report: translated, original: report.summary, weatherData };
    }
    
    return { report: report.summary, weatherData };
  });

// Run the flow
const result = await weatherReportFlow.run({ 
  city: 'Tokyo', 
  language: 'Japanese' 
});

console.log(result.report);
```

## Tool-Centric Chaining (New!)

The new tool-centric approach allows for more intuitive and flexible chaining:

```js
import { getWeather, summarize, translateText } from './my-tools.js';

// Create a weather report chain
const weatherReportChain = getWeather
  .then(async ({ location, temperature, conditions }) => {
    return {
      location,
      temperature,
      conditions,
      text: `Weather report for ${location}: Temperature is ${temperature}°F with ${conditions}.`
    };
  })
  .then(summarize)
  .branch(
    ({ language }) => language && language.toLowerCase() !== 'english',
    translateText,
    async (input) => input // Pass through if no translation needed
  );

// Run the chain
const result = await weatherReportChain.call({ 
  location: 'Tokyo', 
  language: 'Japanese' 
});

console.log(result.translated || result.summary);
```

## Advanced LLM Tool Features

The `LLMTool` class comes with powerful features built-in:

### JSON Validation and Repair

```js
const jsonTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'extractEntities',
      validateJSON: true,   // Validate JSON structure
      repairJSON: true,     // Attempt to repair malformed JSON
      validateSchema: true  // Validate against schema
    });
  }
  
  async execute({ text }) {
    return await this.call({
      prompt: `Extract entities from: ${text}`,
      format: {  // JSON schema for validation
        type: 'object',
        required: ['entities'],
        properties: {
          entities: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'type'],
              properties: {
                name: { type: 'string' },
                type: { type: 'string' }
              }
            }
          }
        }
      }
    });
  }
}();
```

### Rate Limiting and Throttling

```js
const chatTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'chat',
      // Rate limiting configuration
      rateLimit: {
        openai: { tokensPerMinute: 10000, requestsPerMinute: 60 },
        anthropic: { tokensPerMinute: 10000, requestsPerMinute: 20 }
      }
    });
  }
}();
```

### Custom Retry Logic

```js
const robustTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'robustTool',
      retries: 5,
      useExponentialBackoff: true,
      maxRetryDelay: 30000 // 30 seconds
    });
  }
  
  async execute({ input }) {
    return await this.call({
      prompt: `Process this: ${input}`,
      retryCondition: (error, attempt, lastResponse) => {
        // Custom retry logic
        if (error.message.includes('content policy')) {
          return false; // Don't retry content policy violations
        }
        return attempt < 3; // Only retry other errors up to 3 times
      }
    });
  }
}();
```

## State Management in Flows

Flowlite uses a **state accumulation model** for managing data between flow nodes:

1. Each node function receives the current state as its input parameter
2. Nodes return an object containing only the new or modified state properties
3. The Flow engine merges these return values into the accumulated state
4. The final state contains the initial state plus all node contributions

```js
// Example of state accumulation in Flowlite
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

This accumulation model allows nodes to focus only on their specific contributions to the state, making flows more modular and easier to reason about.

## Documentation

For more detailed documentation and examples, see:
- [Tool Primitives Documentation](./docs/tools.md) - Built-in tool classes and their features
- [Flow API Documentation](./docs/flows.md) - Flow creation and orchestration
- [Tool Chaining Guide](./REFACTORING.md) - Guide to the new tool-centric approach
- [Example Applications](./example_apps/) - Complete applications built with Flowlite

## Example Applications

Flowlite includes several example applications to demonstrate its capabilities:

### OCR-PDF Tool

A modular OCR processing tool for PDF documents using AI vision models:
- Uses Mistral AI and Claude for advanced OCR and context extraction
- Demonstrates how to build complex tools by extending LLMTool
- Shows how to handle rate limiting and retries for AI APIs

See the [OCR-PDF README](./example_apps/ocr-pdf/README.md) for more details.

### Article Writer

A CLI tool for generating high-quality articles with AI assistance:
- Research-based article generation
- SEO and copywriting quality checks
- Demonstrates tool composition and flow orchestration

See the [Article Writer README](./example_apps/article-writer/README.md) for more details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

MIT
