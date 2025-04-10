# Flowlite

A lightweight, composable JavaScript framework for building LLM-powered agent flows.

## Overview

Flowlite is a modern JavaScript framework that makes it easy to build structured, chainable workflows for LLM-powered agents. It provides a clean, concise syntax for defining complex flows while maintaining readability and flexibility.

Key features:
- **Simple, chainable API** - Build flows with minimal code
- **Built-in LLM tools** - Structured LLM calls with retry logic and validation
- **Memory management** - Store and retrieve data across interactions
- **Tool registry** - Register and compose reusable tools
- **Parallel execution** - Run tasks concurrently for efficiency
- **Branching logic** - Create conditional paths based on results

## Installation

```bash
npm install flowlite
```

## Hello World Example

Let's start with a simple "hello world" example:

```js
import { Flow } from 'flowlite';

// Define a simple greeter function
const greet = (state) => {
  console.log(`Hello, ${state.name || 'World'}!`);
  return { greeted: true };
};

// Create and run a flow
const flow = Flow.start(greet);
flow.run({ name: 'Flowlite' });
// Output: Hello, Flowlite!
```

## Basic Concepts

### Nodes and Flows

The core building blocks of Flowlite are **Nodes** (units of work) and **Flows** (sequences of nodes):

```js
import { Node, Flow } from 'flowlite';

// Create nodes
const fetchData = new Node('fetchData', async (state) => {
  const data = await fetch(`https://api.example.com/data/${state.id}`);
  return { data: await data.json() };
});

const processData = new Node('processData', (state) => {
  return { 
    processed: state.data.map(item => item.value * 2),
    status: 'complete'
  };
});

// Create and run a flow
const dataFlow = Flow.start(fetchData)
  .next(processData);

dataFlow.run({ id: '12345' });
```

### Branching Logic

Flows can branch based on the output of nodes:

```js
import { Flow } from 'flowlite';

const analyzeInput = (state) => {
  if (state.text.includes('question')) return 'question';
  if (state.text.includes('request')) return 'request';
  return 'statement';
};

const handleQuestion = (state) => {
  return { response: `To answer your question: ${state.text}` };
};

const handleRequest = (state) => {
  return { response: `I'll process your request: ${state.text}` };
};

const handleStatement = (state) => {
  return { response: `I acknowledge your statement: ${state.text}` };
};

const conversationFlow = Flow.start(analyzeInput)
  .on('question', handleQuestion)
  .on('request', handleRequest)
  .on('statement', handleStatement);

const result = await conversationFlow.run({ 
  text: 'Can you answer a question for me?' 
});
console.log(result.response);
// Output: To answer your question: Can you answer a question for me?
```

## Working with LLMs

Flowlite includes built-in tools for working with LLMs:

```js
import { Flow } from 'flowlite';
import { callLLM, promptTemplate } from 'flowlite/tools';

const generateResponse = async (state) => {
  const prompt = promptTemplate(
    'You are a helpful assistant. User: {{userInput}}',
    { userInput: state.input }
  );
  
  const response = await callLLM({
    prompt,
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 500
  });
  
  return { response };
};

const chatFlow = Flow.start(generateResponse);
const result = await chatFlow.run({ input: 'Tell me a joke about programming' });
console.log(result.response);
```

## Memory Management

Flowlite provides memory tools for maintaining state across interactions:

```js
import { Flow } from 'flowlite';
import { createMemoryStore } from 'flowlite/memory';

// Create a memory store
const memory = createMemoryStore();

const rememberName = (state) => {
  memory('userName', state.name);
  return { remembered: true };
};

const greetWithMemory = (state) => {
  const name = memory('userName') || 'stranger';
  return { greeting: `Hello again, ${name}!` };
};

// First flow to store the name
const storeFlow = Flow.start(rememberName);
await storeFlow.run({ name: 'Alice' });

// Later flow to retrieve and use the name
const retrieveFlow = Flow.start(greetWithMemory);
const result = await retrieveFlow.run({});
console.log(result.greeting); // Output: Hello again, Alice!
```

## Tool Registry and Planning

Flowlite allows you to register tools and use them in your flows:

```js
import { Flow, registerTool } from 'flowlite';

// Register a simple hello world tool
const helloWorldTool = registerTool(
  (name = 'World') => `Hello, ${name}!`,
  {
    name: 'helloWorld',
    description: 'Greets a person or the world',
    parameters: ['name?']
  }
);

// Use the tool in a flow
const plannerFlow = Flow.start((state) => {
  // The planner can decide which tool to use
  if (state.needsGreeting) {
    return { 
      result: helloWorldTool(state.name),
      toolUsed: 'helloWorld'
    };
  }
  return { result: 'No greeting needed', toolUsed: 'none' };
});

const result = await plannerFlow.run({ 
  needsGreeting: true, 
  name: 'Flowlite User' 
});

console.log(result);
// Output: { result: 'Hello, Flowlite User!', toolUsed: 'helloWorld' }
```

## Parallel Execution

Run multiple tasks in parallel:

```js
import { Flow } from 'flowlite';

const fetchUserData = async (state) => {
  const response = await fetch(`/api/users/${state.userId}`);
  return { userData: await response.json() };
};

const fetchUserPosts = async (state) => {
  const response = await fetch(`/api/users/${state.userId}/posts`);
  return { userPosts: await response.json() };
};

const combineResults = (state) => {
  return {
    user: {
      ...state.userData,
      posts: state.userPosts
    }
  };
};

const userFlow = Flow.start()
  .all([fetchUserData, fetchUserPosts])
  .next(combineResults);

const result = await userFlow.run({ userId: '12345' });
console.log(result.user);
```

## Complete Example: Weather Assistant

Here's a more complete example that demonstrates several Flowlite features:

```js
import { Flow, registerTool } from 'flowlite';
import { callLLM, promptTemplate, jsonParser } from 'flowlite/tools';
import { createMemoryStore } from 'flowlite/memory';

// Create a memory store
const memory = createMemoryStore();

// Register tools
const getWeather = registerTool(
  async (location) => {
    const response = await fetch(`https://api.weather.com/${location}`);
    return await response.json();
  },
  {
    name: 'getWeather',
    description: 'Get weather data for a location',
    parameters: ['location']
  }
);

// Define flow nodes
const parseRequest = async (state) => {
  const prompt = promptTemplate(
    'Extract the location from this weather request: "{{request}}"',
    { request: state.input }
  );
  
  const response = await callLLM({
    prompt,
    schema: { location: 'string' }
  });
  
  return { location: response.location };
};

const fetchWeatherData = async (state) => {
  const weatherData = await getWeather(state.location);
  memory('lastLocation', state.location);
  return { weatherData };
};

const generateResponse = async (state) => {
  const prompt = promptTemplate(
    'Create a friendly weather report for {{location}} based on this data: {{data}}',
    { 
      location: state.location,
      data: JSON.stringify(state.weatherData)
    }
  );
  
  const response = await callLLM({ prompt });
  return { response };
};

// Create the weather flow
const weatherFlow = Flow.start(parseRequest)
  .next(fetchWeatherData)
  .next(generateResponse);

// Run the flow
const result = await weatherFlow.run({ 
  input: "What's the weather like in San Francisco today?" 
});

console.log(result.response);
```

## Documentation

For more detailed documentation, examples, and API reference, visit our [documentation site](https://flowlite.dev/docs).

## Example Applications

Flowlite includes several example applications to demonstrate its capabilities:

### Article Writer

A CLI tool for generating high-quality articles with AI assistance. Features include:
- Research-based article generation
- SEO and copywriting quality checks
- Fancy CLI interface with ASCII art and colors
- Structured workflow using Flowlite's Flow API

To try it out:
```bash
cd example_apps/article-writer
npm install
npm start
```

See the [Article Writer README](./example_apps/article-writer/README.md) for more details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request at https://github.com/chadananda/flowlite/pulls

## License

MIT
