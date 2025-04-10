# Flowlite Development Guide

This guide provides best practices and patterns for developing with the Flowlite framework.

## Core Concepts

### Flows

Flows are the central concept in Flowlite. A flow is a sequence of steps (nodes) that process data and transform state.

```javascript
import { Flow } from 'flowlite';

// Create a simple flow
const myFlow = Flow.start(initialStep)
  .next(processData)
  .next(generateOutput);

// Run the flow with initial state
const result = await myFlow.run({ input: 'Hello, world!' });
```

### Nodes

Nodes are the building blocks of flows. Each node is a function that:
1. Receives the current state
2. Performs some operation
3. Returns a new state or modifications to the existing state

```javascript
// Simple node function
const greet = (state) => {
  return { 
    ...state,
    greeting: `Hello, ${state.name || 'world'}!` 
  };
};
```

### Branching

Flowlite supports conditional branching based on the output of nodes:

```javascript
const analyzeIntent = (state) => {
  if (state.query.includes('weather')) return 'weather';
  if (state.query.includes('news')) return 'news';
  return 'unknown';
};

const flow = Flow.start(analyzeIntent)
  .on('weather', getWeatherInfo)
  .on('news', getNewsUpdates)
  .on('unknown', handleUnknownIntent);
```

### Parallel Execution

For operations that can run independently, use parallel execution:

```javascript
const flow = Flow.start()
  .all([fetchUserData, fetchUserPreferences, fetchRecommendations])
  .next(combineResults);
```

## CLI Tool Styling Guidelines

When creating CLI tools for Flowlite applications, follow these guidelines to ensure a consistent, professional look and feel across all tools:

### 1. Visual Identity

- **ASCII Art Title**: Use figlet for creating ASCII art titles with a gradient color effect
- **Color Scheme**: Use a consistent color scheme with chalk:
  - Blue/Cyan: Primary actions, titles, and progress indicators
  - Green: Success messages and confirmations
  - Yellow: Warnings and metrics
  - Red: Errors and critical messages
  - Gray: Secondary information and default values
- **Emoji**: Use emoji sparingly to highlight key actions (🔍, ✅, 📝, etc.)

### 2. Code Structure

- **Separate Core Logic**: Keep the core application logic separate from the CLI interface
  - `article-writer.js`: Core implementation (terse, focused on the workflow)
  - `cli.js`: CLI interface (handling arguments, displaying help, etc.)
- **Terse Implementation**: Follow the project's preference for compact code:
  - No empty lines inside functions
  - Use modern JavaScript features (arrow functions, destructuring, etc.)
  - Use method chaining for Flow construction
  - Prefer inline exports

### 3. CLI Interface

- **Commander**: Use the commander package for parsing command-line arguments
- **Help Screen**: Include a comprehensive help screen with:
  - Usage information
  - Available options with descriptions
  - Examples of common usage patterns
  - Environment variables and their purpose
- **Interactive Mode**: Provide an interactive mode when no arguments are provided
- **Error Handling**: Gracefully handle errors with clear, colorful error messages

### 4. Testing

- **Test Mode**: Include a test mode that bypasses external API calls
- **Unit Tests**: Write comprehensive unit tests with vitest
- **Mock External Dependencies**: Mock all external dependencies in tests

### Example Implementation

```javascript
// cli.js
import chalk from 'chalk';
import figlet from 'figlet';
import { Command } from 'commander';

// ASCII art title with gradient coloring
const displayTitle = () => {
  console.log('');
  try {
    const title = figlet.textSync('ToolName', { font: 'Standard' });
    const lines = title.split('\n');
    lines.forEach((line, i) => {
      const ratio = i / lines.length;
      const r = Math.floor(50 + ratio * 100);
      const g = Math.floor(100 - ratio * 50);
      const b = Math.floor(200 - ratio * 50);
      console.log(chalk.rgb(r, g, b)(line));
    });
  } catch (error) {
    console.log(chalk.bold.blue('=== ToolName ==='));
  }
  console.log('\n' + chalk.bold.cyan('✨ Powered by Flowlite ✨') + '\n');
};

// Setup CLI program
const program = new Command()
  .name('tool-name')
  .description('Tool description')
  .version('1.0.0')
  .option('-o, --option <value>', 'Option description')
  .helpOption('-h, --help', 'Display help information');

// Main function
async function main() {
  try {
    program.parse(process.argv);
    // CLI implementation
  } catch (error) {
    console.error(chalk.bold.red(`❌ Error: ${error.message}`));
    process.exit(1);
  }
}

main();
```

By following these guidelines, you'll create CLI tools that are not only functional but also provide a delightful user experience with a consistent look and feel across all Flowlite applications.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Getting Started](#getting-started)
3. [Creating and Using Tools](#creating-and-using-tools)
4. [Building Flows](#building-flows)
5. [Flow Control and Branching](#flow-control-and-branching)
6. [Working with LLMs](#working-with-llms)
7. [Memory Management](#memory-management)
8. [Advanced Techniques](#advanced-techniques)
9. [Best Practices](#best-practices)
10. [Complete Examples](#complete-examples)

## Core Concepts

Flowlite is built around a few key concepts:

- **Nodes**: Units of work that process state and return results
- **Flows**: Sequences of nodes that define a workflow
- **Tools**: Reusable functions with metadata for use in flows
- **State**: Shared data that flows between nodes

The framework uses a chainable API to create readable, maintainable workflows.

## Getting Started

### Installation

```bash
npm install flowlite
```

### Basic Usage

```javascript
import { Flow } from 'flowlite';

// Define a simple function
const greet = (state) => {
  console.log(`Hello, ${state.name || 'World'}!`);
  return { greeted: true };
};

// Create and run a flow
const flow = Flow.start(greet);
flow.run({ name: 'Flowlite' });
// Output: Hello, Flowlite!
```

## Creating and Using Tools

### Registering a Tool

Tools are functions with metadata that describe their purpose and parameters.

```javascript
import { registerTool } from 'flowlite';

// Create a simple tool
const fetchData = registerTool(
  async (url) => {
    const response = await fetch(url);
    return await response.json();
  },
  {
    name: 'fetchData',
    description: 'Fetch data from a URL',
    parameters: ['url']
  }
);

// Use the tool directly
const data = await fetchData('https://api.example.com/data');
```

### Tool Metadata

Tool metadata should include:

- **name**: A unique identifier for the tool
- **description**: What the tool does
- **parameters**: Array of parameter names (append '?' for optional parameters)

Optional parameters should be marked with a question mark:

```javascript
parameters: ['required', 'optional?']
```

### Built-in Tools

Flowlite provides several built-in tools:

#### LLM Tools

```javascript
import { callLLM, promptTemplate } from 'flowlite/tools';

// Call an LLM with structured parameters
const response = await callLLM({
  prompt: 'Summarize the following text: ' + text,
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 500,
  retries: 2
});

// Use a template with variable substitution
const prompt = promptTemplate(
  'Hello, {{name}}! Welcome to {{service}}.',
  { name: 'User', service: 'Flowlite' }
);
// Result: "Hello, User! Welcome to Flowlite."
```

#### Data Processing Tools

```javascript
import { jsonParser, textChunker } from 'flowlite/tools';

// Extract JSON from text
const json = jsonParser('Here is some data: {"key": "value"}');
// Result: { key: 'value' }

// Split text into chunks
const chunks = textChunker(longText, { 
  maxChunkSize: 1000, 
  overlap: 200 
});
```

#### Memory Tools

```javascript
import { createMemoryStore, createConversationMemory } from 'flowlite/memory';

// Create a simple key-value store
const memory = createMemoryStore();
memory('key', 'value');
const value = memory('key'); // 'value'

// Create conversation memory
const conversation = createConversationMemory();
conversation.addMessage('user', 'Hello');
conversation.addMessage('assistant', 'Hi there!');
const messages = conversation.getMessages();
```

## Building Flows

### Creating a Flow

```javascript
import { Flow, Node } from 'flowlite';

// Create nodes
const fetchData = new Node('fetchData', async (state) => {
  const response = await fetch(`https://api.example.com/data/${state.id}`);
  return { data: await response.json() };
});

const processData = new Node('processData', (state) => {
  return { 
    processed: state.data.map(item => item.value * 2),
    status: 'complete'
  };
});

// Create a flow
const dataFlow = Flow.start(fetchData)
  .next(processData);

// Run the flow
const result = await dataFlow.run({ id: '12345' });
console.log(result.processed); // Processed data
console.log(result.status);    // 'complete'
```

### State Management

Each node receives the current state and can return an object that will be merged with the state:

```javascript
const addCounter = (state) => {
  return { counter: (state.counter || 0) + 1 };
};

const logCounter = (state) => {
  console.log(`Counter: ${state.counter}`);
  return {}; // Return empty object to maintain state
};

const flow = Flow.start(addCounter)
  .next(addCounter)
  .next(logCounter);

flow.run({}); // Output: "Counter: 2"
```

## Flow Control and Branching

### Conditional Branching with .on()

```javascript
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
// result.response: "To answer your question: Can you answer a question for me?"
```

### LLM-Based Branching with .onPrompt()

```javascript
const checkQuality = (state) => {
  return { content: state.draft, score: Math.random() * 100 };
};

const publishContent = (state) => {
  console.log('Publishing high-quality content');
  return { status: 'published' };
};

const reviseContent = (state) => {
  console.log('Content needs revision');
  return { status: 'needs_revision' };
};

const contentFlow = Flow.start(checkQuality)
  .onPrompt(
    // Prompt to evaluate content quality
    `Is the content of sufficient quality to publish?
    The content should be well-written, accurate, and engaging.
    Consider the score, where higher is better.`,
    publishContent,  // Execute if LLM returns true
    reviseContent    // Execute if LLM returns false
  );

const result = await contentFlow.run({ draft: 'Sample content...' });
```

### Parallel Execution with .all()

```javascript
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
```

## Working with LLMs

### Basic LLM Calls

```javascript
import { callLLM } from 'flowlite/tools';

const generateResponse = async (state) => {
  const response = await callLLM({
    prompt: `Generate a response to: ${state.input}`,
    model: 'gpt-4',
    temperature: 0.7
  });
  
  return { response };
};

const flow = Flow.start(generateResponse);
const result = await flow.run({ input: 'Tell me about Flowlite' });
```

### Structured Output with Schema

```javascript
const analyzeText = async (state) => {
  const result = await callLLM({
    prompt: `Analyze the sentiment and extract key entities from: ${state.text}`,
    schema: {
      sentiment: 'string',
      score: 'number',
      entities: 'array'
    }
  });
  
  return { analysis: result };
};
```

### Using Prompt Templates

```javascript
import { promptTemplate } from 'flowlite/tools';

const generatePersonalizedEmail = async (state) => {
  const prompt = promptTemplate(
    `Write an email to {{name}} about {{topic}}.
    Tone: {{tone}}
    Include: {{include}}`,
    {
      name: state.recipient,
      topic: state.subject,
      tone: state.tone || 'professional',
      include: state.points.join(', ')
    }
  );
  
  const email = await callLLM({ prompt });
  return { email };
};
```

## Memory Management

### Using Memory Store

```javascript
import { createMemoryStore } from 'flowlite/memory';

// Create a memory store
const memory = createMemoryStore();

const rememberPreference = (state) => {
  memory('preference', state.preference);
  return { remembered: true };
};

const usePreference = (state) => {
  const preference = memory('preference');
  return { 
    message: `Using your preference: ${preference}`,
    preference
  };
};

// First flow stores the preference
const storeFlow = Flow.start(rememberPreference);
await storeFlow.run({ preference: 'dark mode' });

// Later flow uses the stored preference
const retrieveFlow = Flow.start(usePreference);
const result = await retrieveFlow.run({});
// result.message: "Using your preference: dark mode"
```

### Conversation Memory

```javascript
import { createConversationMemory } from 'flowlite/memory';

// Create conversation memory
const conversation = createConversationMemory({ maxMessages: 10 });

const addUserMessage = (state) => {
  conversation.addMessage('user', state.message);
  return { added: true };
};

const generateResponse = async (state) => {
  // Get recent conversation history
  const history = conversation.getMessages()
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');
  
  const prompt = `
  Conversation history:
  ${history}
  
  Generate a response to the user's last message.
  `;
  
  const response = await callLLM({ prompt });
  conversation.addMessage('assistant', response);
  
  return { response };
};

const chatFlow = Flow.start(addUserMessage)
  .next(generateResponse);

await chatFlow.run({ message: 'Hello!' });
```

## Advanced Techniques

### AI-Generated Flow Planning

```javascript
import { Flow, registerTool } from 'flowlite';

// Register tools
const searchTool = registerTool(/* ... */);
const analyzeTool = registerTool(/* ... */);
const generateTool = registerTool(/* ... */);

// Create a planning flow
const planningFlow = Flow.start()
  .tools([searchTool, analyzeTool, generateTool])
  .plan("Create a workflow that searches for information, analyzes the results, and generates a report");

// Run the flow to see the plan
await planningFlow.run({});
```

### Custom Node Creation

```javascript
import { Node } from 'flowlite';

// Create a node with custom behavior
const retryNode = new Node('retryOperation', async (state) => {
  const maxAttempts = state.maxAttempts || 3;
  let attempts = 0;
  let error;
  
  while (attempts < maxAttempts) {
    try {
      const result = await state.operation();
      return { result, attempts: attempts + 1, success: true };
    } catch (err) {
      error = err;
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }
  
  return { 
    error: error.message, 
    attempts, 
    success: false 
  };
});

// Use the custom node in a flow
const flow = Flow.start()
  .next(state => ({
    operation: async () => {
      // Some operation that might fail
      if (Math.random() < 0.7) throw new Error('Random failure');
      return 'Success!';
    },
    maxAttempts: 5
  }))
  .next(retryNode)
  .next(state => {
    if (state.success) {
      console.log(`Succeeded after ${state.attempts} attempts: ${state.result}`);
    } else {
      console.log(`Failed after ${state.attempts} attempts: ${state.error}`);
    }
    return state;
  });

await flow.run({});
```

## Best Practices

### State Management

1. **Keep state immutable**: Always return new objects, don't modify the input state
2. **Use descriptive property names**: Make state properties self-documenting
3. **Validate state**: Check that required properties exist before using them

```javascript
const processData = (state) => {
  // Validate required state
  if (!state.data) {
    return { error: 'Missing required data' };
  }
  
  // Return new state, don't modify input
  return {
    ...state,
    processed: state.data.map(item => transformItem(item))
  };
};
```

### Error Handling

1. **Use try/catch blocks**: Handle errors gracefully in async operations
2. **Return error information in state**: Make errors part of the flow
3. **Consider retry logic**: For operations that might fail temporarily

```javascript
const fetchWithErrorHandling = async (state) => {
  try {
    const response = await fetch(state.url);
    if (!response.ok) {
      return { 
        error: `API returned ${response.status}`,
        success: false
      };
    }
    const data = await response.json();
    return { data, success: true };
  } catch (error) {
    return { 
      error: error.message,
      success: false
    };
  }
};

const handleResult = (state) => {
  if (!state.success) {
    console.error(`Operation failed: ${state.error}`);
    return { status: 'failed', reason: state.error };
  }
  
  // Process successful result
  return { status: 'success', result: processData(state.data) };
};

const flow = Flow.start(fetchWithErrorHandling)
  .next(handleResult);
```

### Modularity

1. **Create reusable nodes**: Design nodes that can be used in multiple flows
2. **Use tools for common operations**: Register frequently used functions as tools
3. **Compose flows**: Build complex flows from simpler ones

```javascript
// Reusable authentication node
const authenticate = new Node('authenticate', async (state) => {
  // Authentication logic
  return { authenticated: true, token: 'abc123' };
});

// Reusable data fetching node
const fetchData = new Node('fetchData', async (state) => {
  // Fetch data using authentication token
  return { data: [/* fetched data */] };
});

// Create flows that reuse these nodes
const userFlow = Flow.start(authenticate)
  .next(fetchData)
  .next(processUserData);

const adminFlow = Flow.start(authenticate)
  .next(fetchData)
  .next(processAdminData);
```

## Complete Examples

### Conversational Agent

```javascript
import { Flow, registerTool } from 'flowlite';
import { callLLM, promptTemplate } from 'flowlite/tools';
import { createConversationMemory, createMemoryStore } from 'flowlite/memory';

// Create memory stores
const memory = createMemoryStore();
const conversation = createConversationMemory({ maxMessages: 10 });

// Register tools
const searchTool = registerTool(
  async (query) => {
    // Search implementation
    return `Results for: ${query}`;
  },
  {
    name: 'search',
    description: 'Search for information',
    parameters: ['query']
  }
);

const calculateTool = registerTool(
  (expression) => {
    // Safe calculation
    return `Result: ${eval(expression)}`;
  },
  {
    name: 'calculate',
    description: 'Calculate a mathematical expression',
    parameters: ['expression']
  }
);

// Flow nodes
const analyzeMessage = async (state) => {
  // Add message to history
  conversation.addMessage('user', state.message);
  
  // Get conversation context
  const history = conversation.getMessages(5)
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');
  
  // Analyze the message
  const prompt = promptTemplate(`
    Conversation history:
    {{history}}
    
    Based on the user's message, determine if I should:
    1. Search for information
    2. Calculate something
    3. Just respond directly
    
    User message: {{message}}
    
    Respond in JSON format:
    {
      "action": "search" | "calculate" | "respond",
      "query": "search query or calculation" (if applicable)
    }
  `, { history, message: state.message });
  
  const analysis = await callLLM({
    prompt,
    schema: {
      action: 'string',
      query: 'string?'
    }
  });
  
  return { ...state, analysis };
};

const executeAction = async (state) => {
  const { analysis } = state;
  let response;
  
  switch (analysis.action) {
    case 'search':
      response = await searchTool(analysis.query);
      break;
    case 'calculate':
      response = calculateTool(analysis.query);
      break;
    case 'respond':
      // Generate a direct response
      const prompt = `
        Conversation history:
        ${conversation.getMessages(5)
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n')}
        
        Respond to the user's message: ${state.message}
      `;
      response = await callLLM({ prompt });
      break;
  }
  
  // Add response to conversation history
  conversation.addMessage('assistant', response);
  
  return { ...state, response };
};

// Create the flow
const chatFlow = Flow.start(analyzeMessage)
  .next(executeAction);

// Example usage
const result = await chatFlow.run({ message: "What's the weather like in Paris?" });
console.log(result.response);
```

### Article Generator

```javascript
import { Flow, registerTool } from 'flowlite';
import { callLLM, promptTemplate } from 'flowlite/tools';

// Register tools
const researchTool = registerTool(
  async (topic) => {
    // Research implementation
    return `Research data about ${topic}`;
  },
  {
    name: 'research',
    description: 'Research a topic',
    parameters: ['topic']
  }
);

const writeTool = registerTool(
  async (prompt) => {
    // Writing implementation using an LLM
    return await callLLM({ prompt });
  },
  {
    name: 'write',
    description: 'Generate written content',
    parameters: ['prompt']
  }
);

const editTool = registerTool(
  async (content, instructions) => {
    // Editing implementation
    const prompt = `Edit the following content according to these instructions:
    
    Instructions: ${instructions}
    
    Content:
    ${content}`;
    
    return await callLLM({ prompt });
  },
  {
    name: 'edit',
    description: 'Edit content based on instructions',
    parameters: ['content', 'instructions']
  }
);

// Flow nodes
const planArticle = async (state) => {
  const prompt = `
    Create a detailed outline for an article about: ${state.topic}
    Target audience: ${state.audience}
    
    Include:
    1. A compelling headline
    2. 3-5 key sections
    3. Key points for each section
  `;
  
  const outline = await callLLM({ prompt });
  return { ...state, outline };
};

const researchTopic = async (state) => {
  const research = await researchTool(state.topic);
  return { ...state, research };
};

const writeFirstDraft = async (state) => {
  const prompt = `
    Write an article based on this outline:
    ${state.outline}
    
    And using this research:
    ${state.research}
    
    Target audience: ${state.audience}
  `;
  
  const firstDraft = await writeTool(prompt);
  return { ...state, firstDraft };
};

const editForClarity = async (state) => {
  const editedDraft = await editTool(
    state.firstDraft,
    "Improve clarity and readability. Simplify complex sentences and ensure smooth transitions between paragraphs."
  );
  
  return { ...state, editedDraft };
};

const optimizeForSEO = async (state) => {
  const seoOptimized = await editTool(
    state.editedDraft,
    `Optimize for SEO using these keywords: ${state.keywords.join(', ')}`
  );
  
  return { ...state, finalDraft: seoOptimized };
};

const reviewQuality = async (state) => {
  const prompt = `
    Review this article for quality:
    ${state.finalDraft}
    
    Evaluate:
    1. Overall quality (1-10)
    2. Accuracy
    3. Engagement
    4. SEO effectiveness
    
    Respond in JSON format:
    {
      "score": number,
      "feedback": "detailed feedback"
    }
  `;
  
  const review = await callLLM({
    prompt,
    schema: {
      score: 'number',
      feedback: 'string'
    }
  });
  
  return { ...state, review };
};

// Create the flow with conditional branching
const articleFlow = Flow.start(planArticle)
  .next(researchTopic)
  .next(writeFirstDraft)
  .next(editForClarity)
  .next(optimizeForSEO)
  .next(reviewQuality)
  .onPrompt(
    "Based on the review score and feedback, is this article ready to publish? It should have a score of at least 8 and no major issues mentioned in the feedback.",
    // If quality is good (true branch)
    (state) => ({ ...state, status: 'ready', message: 'Article is ready to publish' }),
    // If quality needs improvement (false branch)
    async (state) => {
      const revisedDraft = await editTool(
        state.finalDraft,
        `Revise this article based on the following feedback: ${state.review.feedback}`
      );
      return { ...state, finalDraft: revisedDraft, status: 'revised', message: 'Article has been revised' };
    }
  );

// Example usage
const result = await articleFlow.run({
  topic: "The Future of AI",
  audience: "Technology enthusiasts",
  keywords: ["artificial intelligence", "machine learning", "future tech"]
});

console.log(result.status); // 'ready' or 'revised'
console.log(result.message);
console.log(result.finalDraft); // The final article
```

## Conclusion

Flowlite provides a powerful yet simple framework for building LLM-powered agent flows. By combining nodes, flows, tools, and state management, you can create sophisticated applications that leverage the capabilities of large language models.

This guide covers the essentials of working with Flowlite, but the framework is designed to be flexible and extensible. As you become more familiar with it, you can create increasingly complex and powerful applications.

For more examples and detailed API documentation, refer to the other files in the Flowlite repository.
