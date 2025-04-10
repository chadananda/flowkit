# Flow Tools

This document provides an overview of the built-in tools available in the Flowlite framework. These tools are designed to simplify common tasks when building AI agent flows.

The tools are both good examples of how to build tools for FlowLite but also object primitives, which you can simply inherit from and override to build your own tools.

## Memory Management

### `memory`

A persistent memory store for saving and retrieving data across flow executions.

```javascript
import { tools } from './flowtools.js';

// Store a value
await tools.memory({ key: 'user_preference', value: 'dark_mode', action: 'set' });

// Retrieve a value
const preference = await tools.memory('user_preference');
// or
const preference = await tools.memory({ key: 'user_preference', action: 'get' });

// Delete a value
await tools.memory({ key: 'user_preference', action: 'delete' });

// Get all keys
const keys = await tools.memory({ action: 'keys' });

// Get all stored values
const allData = await tools.memory({ action: 'all' });

// Clear all memory
await tools.memory({ action: 'clear' });
```

## LLM Integration

### `llm`

Call an LLM with structured output parsing and validation.

```javascript
import { tools } from './flowtools.js';

// Simple text completion
const response = await tools.llm('Explain quantum computing in simple terms');

// Structured output with schema
const person = await tools.llm({
  prompt: 'Generate information about a fictional person',
  model: 'gpt-4',
  temperature: 0.8,
  schema: {
    name: 'string',
    age: 'number',
    occupation: 'string',
    hobbies: 'array'
  }
});

// With validation
const validatedResponse = await tools.llm({
  prompt: 'Generate a number between 1 and 10',
  schema: { number: 'number' },
  validate: (result) => result.number >= 1 && result.number <= 10
});
```

### `prompt`

Create a prompt from a template and variables.

```javascript
import { tools } from './flowtools.js';

// Simple template
const prompt = await tools.prompt({
  template: 'Hello {{name}}, welcome to {{service}}!',
  variables: { name: 'Alice', service: 'Flowlite' }
});
// Output: "Hello Alice, welcome to Flowlite!"

// Can also be used with just a string if no variables needed
const simplePrompt = await tools.prompt('Write a short poem about AI');
```

## Data Processing

### `json`

Extract and parse JSON from text, with fallback for errors.

```javascript
import { tools } from './flowtools.js';

// Parse JSON from a string
const data = await tools.json('{"name": "Alice", "age": 30}');

// Parse JSON embedded in text
const extractedData = await tools.json(`
  Here's the user data:
  \`\`\`json
  {"name": "Bob", "email": "bob@example.com"}
  \`\`\`
`);

// With fallback for error handling
const safeData = await tools.json({
  text: 'Invalid JSON',
  fallback: { error: 'Failed to parse' }
});
```

### `chunks`

Split text into overlapping chunks for processing.

```javascript
import { tools } from './flowtools.js';

// Split text with default settings (1000 chars, 200 char overlap)
const chunks = await tools.chunks(longText);

// With custom settings
const customChunks = await tools.chunks({
  text: longText,
  maxChunkSize: 500,
  overlap: 100
});
```

### `snapshot`

Create a deep copy snapshot of an object.

```javascript
import { tools } from './flowtools.js';

// Create a deep copy of state
const stateCopy = await tools.snapshot(state);
```

## Web and API Tools

### `fetch`

Fetch data from a URL with retry capability.

```javascript
import { tools } from './flowtools.js';

// Simple GET request
const data = await tools.fetch('https://api.example.com/data');

// POST request with options
const response = await tools.fetch({
  url: 'https://api.example.com/users',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer token123'
  },
  body: {
    name: 'Alice',
    email: 'alice@example.com'
  },
  responseType: 'json' // 'json', 'text', 'blob', or 'arrayBuffer'
});
```

## Creating Custom Tools

You can easily create custom tools by extending the base classes or using the `createTool` helper:

```javascript
import { createTool, Tool, APITool } from './flowtools.js';

// Simple function-based tool
const calculator = createTool(
  (input) => {
    const { a, b, operation = 'add' } = input;
    switch (operation) {
      case 'add': return a + b;
      case 'subtract': return a - b;
      case 'multiply': return a * b;
      case 'divide': return a / b;
      default: throw new Error(`Unknown operation: ${operation}`);
    }
  },
  {
    name: 'calculator',
    description: 'Perform basic arithmetic operations'
  }
);

// Class-based tool with more features
class WeatherTool extends APITool {
  constructor() {
    super({
      name: 'weather',
      description: 'Get weather information for a location',
      apiKeys: [{ name: 'WEATHER_API_KEY', description: 'API key for weather service' }]
    });
  }

  async execute({ location, units = 'metric' }) {
    return this.fetch({
      url: `https://api.weather.com/current?location=${encodeURIComponent(location)}&units=${units}`,
      headers: {
        'Authorization': `Bearer ${process.env.WEATHER_API_KEY}`
      }
    });
  }
}

// Usage
const weather = new WeatherTool();
const forecast = await weather.call({ location: 'New York' });
```
