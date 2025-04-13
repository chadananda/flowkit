# Flowlite Tool Primitives Documentation

This document provides detailed information about Flowlite's tool primitives, their inheritance model, and advanced features.

## Table of Contents

1. [Tool Inheritance Model](#tool-inheritance-model)
2. [Base Tool Class](#base-tool-class)
3. [LLMTool Class](#llmtool-class)
4. [APITool Class](#apitool-class)
5. [Advanced Features](#advanced-features)
   - [Rate Limiting](#rate-limiting)
   - [JSON Validation](#json-validation)
   - [Error Handling](#error-handling)
   - [Retry Mechanisms](#retry-mechanisms)
6. [Creating Custom Tools](#creating-custom-tools)
7. [Tool Composition Patterns](#tool-composition-patterns)
8. [Best Practices](#best-practices)

## Tool Inheritance Model

Flowlite's power comes from its robust inheritance model for tools:

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

## Base Tool Class

The `Tool` class is the foundation of all tools in Flowlite.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Unique identifier for the tool |
| `description` | string | Human-readable description |
| `input` | array | Array of input parameter definitions |
| `output` | object | Schema for the tool's output |
| `apiKeys` | object | API keys required by the tool |
| `options` | object | Additional configuration options |
| `stats` | object | Execution statistics |

### Methods

| Method | Description |
|--------|-------------|
| `constructor(config)` | Creates a new tool with the specified configuration |
| `execute(input)` | Core method that implements the tool's functionality |
| `call(input)` | Wrapper around execute that handles validation and statistics |
| `asFunction()` | Returns a function wrapper for the tool |
| `withApiKey(key, value)` | Sets an API key for the tool |
| `withOptions(options)` | Sets additional options for the tool |
| `setLogLevel(level)` | Sets the logging level for the tool |
| `getStats()` | Returns execution statistics |
| `resetStats()` | Resets execution statistics |

### Example

```js
import { Tool, param, ParamType } from 'flowlite';

const greetingTool = new class extends Tool {
  constructor() {
    super({
      name: 'greeting',
      description: 'Generates a greeting message',
      input: [
        param('name', ParamType.STRING, 'Name to greet'),
        param('formal', ParamType.BOOLEAN, 'Whether to use formal greeting', true)
      ]
    });
  }
  
  execute({ name, formal = false }) {
    const greeting = formal ? 'Hello' : 'Hi';
    return { message: `${greeting}, ${name}!` };
  }
}();

// Usage
const result = await greetingTool.call({ name: 'World', formal: true });
console.log(result.message); // "Hello, World!"
```

## LLMTool Class

The `LLMTool` class extends the base `Tool` class with features specifically designed for working with Large Language Models.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `provider` | string | LLM provider (e.g., 'openai', 'anthropic') |
| `model` | string | Model to use (e.g., 'gpt-4', 'claude-3') |
| `temperature` | number | Temperature setting for generation |
| `maxTokens` | number | Maximum tokens to generate |
| `retries` | number | Number of retry attempts |
| `validateJSON` | boolean | Whether to validate JSON responses |
| `repairJSON` | boolean | Whether to attempt to repair malformed JSON |
| `rateLimit` | object | Rate limiting configuration |

### Methods

| Method | Description |
|--------|-------------|
| `call(options)` | Makes an LLM API call with the given options |
| `withProvider(provider)` | Sets the LLM provider |
| `withModel(model)` | Sets the model to use |
| `withTemperature(temp)` | Sets the temperature |
| `withMaxTokens(tokens)` | Sets the maximum tokens |
| `withRetries(count)` | Sets the number of retries |
| `withRateLimit(config)` | Sets rate limiting configuration |
| `validateResponse(response, schema)` | Validates a response against a schema |
| `repairJSONResponse(response)` | Attempts to repair malformed JSON |

### Example

```js
import { LLMTool, param, ParamType } from 'flowlite';

const summarizer = new class extends LLMTool {
  constructor() {
    super({
      name: 'summarize',
      description: 'Summarizes text content',
      input: [
        param('text', ParamType.STRING, 'Text to summarize'),
        param('length', ParamType.STRING, 'Desired length', true)
      ],
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      retries: 3,
      validateJSON: true,
      repairJSON: true
    });
  }
  
  async execute({ text, length = 'short' }) {
    return await this.call({
      prompt: `Summarize the following text in a ${length} summary:\n\n${text}`,
      format: 'json',
      schema: {
        type: 'object',
        required: ['summary'],
        properties: {
          summary: { type: 'string' },
          key_points: { type: 'array', items: { type: 'string' } }
        }
      }
    });
  }
}();

// Usage
const result = await summarizer.call({
  text: "Lorem ipsum dolor sit amet...",
  length: "medium"
});
```

## APITool Class

The `APITool` class extends the base `Tool` class with features for working with external APIs.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `baseUrl` | string | Base URL for API requests |
| `headers` | object | Default headers for requests |
| `timeout` | number | Request timeout in milliseconds |
| `retries` | number | Number of retry attempts |
| `retryDelay` | number | Delay between retries in milliseconds |

### Methods

| Method | Description |
|--------|-------------|
| `fetchWithApiKey(url, options)` | Makes an API request with API key |
| `handleApiError(error)` | Handles API-specific errors |
| `withBaseUrl(url)` | Sets the base URL |
| `withHeaders(headers)` | Sets default headers |
| `withTimeout(timeout)` | Sets the request timeout |
| `withRetry(config)` | Sets retry configuration |

### Example

```js
import { APITool, param, ParamType } from 'flowlite';

const weatherTool = new class extends APITool {
  constructor() {
    super({
      name: 'getWeather',
      description: 'Gets weather data for a location',
      input: [
        param('location', ParamType.STRING, 'City to check weather for')
      ],
      retries: 3,
      retryDelay: 1000
    });
    this.withApiKey('WEATHER_API_KEY');
  }
  
  async execute({ location }) {
    const encodedLocation = encodeURIComponent(location);
    const response = await this.fetchWithApiKey(
      `https://api.weather.example.com/current?location=${encodedLocation}`
    );
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      temperature: data.current.temperature,
      conditions: data.current.conditions,
      city: data.location.name
    };
  }
}();

// Usage
const weather = await weatherTool.call({ location: 'San Francisco' });
```

## Advanced Features

### Rate Limiting

Flowlite's `LLMTool` includes sophisticated rate limiting to prevent API quota issues:

```js
const chatTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'chat',
      // Provider-specific rate limits
      rateLimit: {
        openai: { 
          tokensPerMinute: 10000,  // Token rate limit
          requestsPerMinute: 60    // Request rate limit
        },
        anthropic: { 
          tokensPerMinute: 10000, 
          requestsPerMinute: 20 
        }
      },
      // Global rate limit fallback
      globalRateLimit: {
        tokensPerMinute: 5000,
        requestsPerMinute: 30
      }
    });
  }
  
  async execute({ message }) {
    return await this.call({
      prompt: message,
      // Override rate limits for specific calls
      rateLimit: {
        tokensPerMinute: 2000,
        requestsPerMinute: 10
      }
    });
  }
}();
```

Rate limiting features include:

- Provider-specific limits
- Token and request-based limiting
- Automatic queuing of requests
- Exponential backoff for rate limit errors
- Priority-based execution

### JSON Validation

Flowlite's `LLMTool` includes robust JSON validation and repair:

```js
const entityExtractor = new class extends LLMTool {
  constructor() {
    super({
      name: 'extractEntities',
      validateJSON: true,   // Enable JSON validation
      repairJSON: true,     // Enable JSON repair
      validateSchema: true  // Enable schema validation
    });
  }
  
  async execute({ text }) {
    return await this.call({
      prompt: `Extract entities from: ${text}`,
      format: 'json',
      schema: {
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

JSON validation features include:

- Automatic JSON extraction from text responses
- Schema validation using JSON Schema
- Intelligent JSON repair for malformed responses
- Custom validation functions
- Fallback strategies for invalid responses

### Error Handling

Flowlite tools include comprehensive error handling:

```js
const robustTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'robustTool',
      // Error handling configuration
      errorHandling: {
        retryableErrors: ['rate_limit', 'server_error', 'connection_error'],
        nonRetryableErrors: ['invalid_api_key', 'content_policy_violation'],
        fallbackProvider: 'anthropic',  // Fallback provider if primary fails
        errorCallback: (error, attempt) => {
          console.error(`Error on attempt ${attempt}:`, error);
        }
      }
    });
  }
}();
```

Error handling features include:

- Categorized error types
- Provider-specific error handling
- Automatic fallback to alternative providers
- Custom error callbacks
- Detailed error logging

### Retry Mechanisms

Flowlite tools include sophisticated retry logic:

```js
const reliableTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'reliableTool',
      // Retry configuration
      retries: 5,                    // Maximum retry attempts
      useExponentialBackoff: true,   // Use exponential backoff
      initialRetryDelay: 1000,       // Initial delay in ms
      maxRetryDelay: 30000,          // Maximum delay in ms
      jitter: true                   // Add randomness to retry delays
    });
  }
  
  async execute({ input }) {
    return await this.call({
      prompt: `Process this: ${input}`,
      // Custom retry condition
      retryCondition: (error, attempt, lastResponse) => {
        if (error.message.includes('content policy')) {
          return false; // Don't retry content policy violations
        }
        if (error.message.includes('rate limit')) {
          return attempt < 10; // Retry rate limits up to 10 times
        }
        return attempt < 3; // Only retry other errors up to 3 times
      }
    });
  }
}();
```

Retry features include:

- Configurable retry attempts
- Exponential backoff with jitter
- Custom retry conditions
- Different strategies for different error types
- Automatic retry for transient errors

## Creating Custom Tools

### Basic Tool Creation

The simplest way to create a custom tool is to extend the base `Tool` class:

```js
import { Tool, param, ParamType } from 'flowlite';

export class TextProcessingTool extends Tool {
  constructor() {
    super({
      name: 'textProcessor',
      description: 'Processes text in various ways',
      input: [
        param('text', ParamType.STRING, 'Text to process'),
        param('operation', ParamType.STRING, 'Operation to perform', true)
      ]
    });
  }
  
  execute({ text, operation = 'uppercase' }) {
    switch (operation.toLowerCase()) {
      case 'uppercase':
        return { result: text.toUpperCase() };
      case 'lowercase':
        return { result: text.toLowerCase() };
      case 'reverse':
        return { result: text.split('').reverse().join('') };
      case 'count':
        return { result: text.length };
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}

// Create an instance
export const textProcessor = new TextProcessingTool();
```

### LLM Tool Creation

For LLM-powered tools, extend the `LLMTool` class:

```js
import { LLMTool, param, ParamType } from 'flowlite';

export class SentimentAnalyzer extends LLMTool {
  constructor() {
    super({
      name: 'analyzeSentiment',
      description: 'Analyzes the sentiment of text',
      input: [
        param('text', ParamType.STRING, 'Text to analyze')
      ],
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      validateJSON: true
    });
  }
  
  async execute({ text }) {
    return await this.call({
      prompt: `Analyze the sentiment of the following text. Return a JSON object with 'sentiment' (positive, negative, or neutral) and 'confidence' (0-1):\n\n${text}`,
      format: 'json',
      schema: {
        type: 'object',
        required: ['sentiment', 'confidence'],
        properties: {
          sentiment: { 
            type: 'string',
            enum: ['positive', 'negative', 'neutral']
          },
          confidence: { 
            type: 'number',
            minimum: 0,
            maximum: 1
          }
        }
      }
    });
  }
}

// Create an instance
export const analyzeSentiment = new SentimentAnalyzer();
```

### API Tool Creation

For API-powered tools, extend the `APITool` class:

```js
import { APITool, param, ParamType } from 'flowlite';

export class StockPriceTool extends APITool {
  constructor() {
    super({
      name: 'getStockPrice',
      description: 'Gets the current stock price for a symbol',
      input: [
        param('symbol', ParamType.STRING, 'Stock symbol')
      ],
      retries: 3
    });
    this.withApiKey('STOCK_API_KEY');
    this.withBaseUrl('https://api.stocks.example.com');
  }
  
  async execute({ symbol }) {
    const response = await this.fetchWithApiKey(
      `/v1/price/${symbol.toUpperCase()}`
    );
    
    if (!response.ok) {
      throw new Error(`Stock API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      symbol: data.symbol,
      price: data.price,
      currency: data.currency,
      timestamp: data.timestamp
    };
  }
}

// Create an instance
export const getStockPrice = new StockPriceTool();
```

## Tool Composition Patterns

### Chaining Tools

Tools can be chained together to create complex workflows:

```js
import { Flow } from 'flowlite';
import { analyzeSentiment } from './sentiment-tool.js';
import { translateText } from './translate-tool.js';

// Create a flow that translates text and then analyzes sentiment
const analyzeForeignSentiment = Flow.create({
  name: 'analyzeForeignSentiment',
  description: 'Analyzes sentiment of text in any language'
})
.next(async ({ text, sourceLanguage }) => {
  // First translate to English if not already in English
  let englishText = text;
  if (sourceLanguage && sourceLanguage.toLowerCase() !== 'english') {
    const translated = await translateText.call({
      text,
      sourceLanguage,
      targetLanguage: 'english'
    });
    englishText = translated.text;
  }
  
  // Then analyze sentiment
  const sentiment = await analyzeSentiment.call({ text: englishText });
  
  return {
    originalText: text,
    englishText,
    sentiment: sentiment.sentiment,
    confidence: sentiment.confidence
  };
});
```

### Tool Composition

Tools can be composed to create more powerful tools:

```js
import { LLMTool, param, ParamType } from 'flowlite';
import { analyzeSentiment } from './sentiment-tool.js';
import { extractEntities } from './entity-tool.js';

// Create a composed tool that combines sentiment analysis and entity extraction
export class TextAnalyzer extends LLMTool {
  constructor() {
    super({
      name: 'analyzeText',
      description: 'Performs comprehensive text analysis',
      input: [
        param('text', ParamType.STRING, 'Text to analyze')
      ]
    });
  }
  
  async execute({ text }) {
    // Run both tools in parallel
    const [sentiment, entities] = await Promise.all([
      analyzeSentiment.call({ text }),
      extractEntities.call({ text })
    ]);
    
    // Combine the results
    return {
      sentiment: sentiment.sentiment,
      confidence: sentiment.confidence,
      entities: entities.entities,
      text
    };
  }
}

// Create an instance
export const analyzeText = new TextAnalyzer();
```

### Tool Factories

Create factory functions to generate specialized tools:

```js
import { LLMTool, param, ParamType } from 'flowlite';

// Factory function to create specialized LLM tools
export function createSpecializedLLMTool(name, description, prompt, outputSchema) {
  return new class extends LLMTool {
    constructor() {
      super({
        name,
        description,
        input: [
          param('text', ParamType.STRING, 'Input text')
        ],
        validateJSON: true,
        repairJSON: true
      });
    }
    
    async execute({ text }) {
      return await this.call({
        prompt: prompt.replace('{{text}}', text),
        format: 'json',
        schema: outputSchema
      });
    }
  }();
}

// Create specialized tools using the factory
export const summarizeTool = createSpecializedLLMTool(
  'summarize',
  'Summarizes text',
  'Summarize the following text:\n\n{{text}}',
  {
    type: 'object',
    required: ['summary'],
    properties: {
      summary: { type: 'string' }
    }
  }
);

export const categorizeTool = createSpecializedLLMTool(
  'categorize',
  'Categorizes text',
  'Categorize the following text:\n\n{{text}}',
  {
    type: 'object',
    required: ['category'],
    properties: {
      category: { type: 'string' }
    }
  }
);
```

## Best Practices

### Tool Design

1. **Single Responsibility**: Each tool should do one thing well
2. **Clear Inputs and Outputs**: Define clear input parameters and output schemas
3. **Descriptive Names**: Use descriptive names and documentation
4. **Error Handling**: Implement comprehensive error handling
5. **Validation**: Validate inputs and outputs

### Performance

1. **Caching**: Cache results for expensive operations
2. **Rate Limiting**: Implement rate limiting for API calls
3. **Parallel Execution**: Use Promise.all for parallel operations
4. **Retry Logic**: Implement smart retry logic for transient failures
5. **Timeouts**: Set appropriate timeouts for external calls

### Maintainability

1. **Inheritance**: Use inheritance for common functionality
2. **Composition**: Compose tools for complex operations
3. **Testing**: Write tests for each tool
4. **Documentation**: Document tool behavior and requirements
5. **Versioning**: Version tools appropriately

### Security

1. **API Key Management**: Securely manage API keys
2. **Input Validation**: Validate all inputs to prevent injection
3. **Output Sanitization**: Sanitize outputs to prevent XSS
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **Logging**: Log errors and suspicious activity
