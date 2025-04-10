/**
 * chat-agent.js - A conversational agent example using Flowkit
 * 
 * This example demonstrates how to build a conversational agent that:
 * 1. Maintains conversation history
 * 2. Uses tools based on user requests
 * 3. Has a persistent memory for user preferences
 */

import { Flow, registerTool } from '../../flowkit.js';
import { callLLM, promptTemplate, jsonParser } from '../../tools.js';
import { createMemoryStore, createConversationMemory } from '../../memory.js';
import readline from 'readline';

// Create memory stores
const memory = createMemoryStore();
const conversationHistory = createConversationMemory({ maxMessages: 10 });

// Register some useful tools
const searchTool = registerTool(
  async (query) => {
    // Simulate a search operation
    console.log(`🔍 Searching for: ${query}`);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    return `Here are the search results for "${query}": [Simulated search results]`;
  },
  {
    name: 'search',
    description: 'Search the web for information',
    parameters: ['query']
  }
);

const calculateTool = registerTool(
  (expression) => {
    try {
      // Simple and safe evaluation using Function constructor
      // Note: In a real application, you would want to use a proper math library
      const result = new Function(`return ${expression}`)();
      return `The result of ${expression} is ${result}`;
    } catch (error) {
      return `Sorry, I couldn't calculate "${expression}". Please check the format.`;
    }
  },
  {
    name: 'calculate',
    description: 'Calculate a mathematical expression',
    parameters: ['expression']
  }
);

const rememberPreferenceTool = registerTool(
  (key, value) => {
    memory(key, value);
    return `I'll remember that your ${key} is ${value}.`;
  },
  {
    name: 'rememberPreference',
    description: 'Remember a user preference',
    parameters: ['key', 'value']
  }
);

const getPreferenceTool = registerTool(
  (key) => {
    const value = memory(key);
    return value ? `Your ${key} is ${value}.` : `I don't know your ${key} yet.`;
  },
  {
    name: 'getPreference',
    description: 'Retrieve a user preference',
    parameters: ['key']
  }
);

// Create a node to analyze the user's message
const analyzeMessage = async (state) => {
  // Add the user message to conversation history
  conversationHistory.addMessage('user', state.message);
  
  // Get recent conversation history
  const recentMessages = conversationHistory.getMessages(5);
  const conversationContext = recentMessages.map(msg => 
    `${msg.role}: ${msg.content}`
  ).join('\n');
  
  // Create a prompt to analyze the message
  const prompt = promptTemplate(`
You are a helpful assistant with access to the following tools:

1. search - Search the web for information
   Parameters: [query]

2. calculate - Calculate a mathematical expression
   Parameters: [expression]

3. rememberPreference - Remember a user preference
   Parameters: [key, value]

4. getPreference - Retrieve a user preference
   Parameters: [key]

Recent conversation:
{{conversation}}

Based on the user's latest message, determine if you should use a tool or just respond directly.
If a tool should be used, specify which one and with what parameters.

Respond in the following JSON format:
{
  "shouldUseTool": true/false,
  "toolName": "name of the tool to use (if applicable)",
  "parameters": ["param1", "param2", ...] (if applicable),
  "reasoning": "brief explanation of your decision"
}
`, { conversation: conversationContext });

  // Call the LLM to analyze the message
  const analysis = await callLLM({
    prompt,
    schema: {
      shouldUseTool: 'boolean',
      toolName: 'string?',
      parameters: 'array?',
      reasoning: 'string'
    }
  });

  return {
    ...state,
    analysis
  };
};

// Create a node to execute the appropriate tool or generate a response
const executeToolOrRespond = async (state) => {
  const { analysis } = state;
  let responseText;
  
  if (analysis.shouldUseTool) {
    // Execute the chosen tool
    switch (analysis.toolName) {
      case 'search':
        responseText = await searchTool(...analysis.parameters);
        break;
      case 'calculate':
        responseText = calculateTool(...analysis.parameters);
        break;
      case 'rememberPreference':
        responseText = rememberPreferenceTool(...analysis.parameters);
        break;
      case 'getPreference':
        responseText = getPreferenceTool(...analysis.parameters);
        break;
      default:
        responseText = "I'm not sure how to help with that.";
    }
  } else {
    // Generate a direct response
    const prompt = promptTemplate(`
You are a helpful, friendly assistant. Respond to the user's message in a natural, conversational way.

Recent conversation:
{{conversation}}

User's message: {{message}}

Your response:
`, { 
      conversation: conversationHistory.getMessages(5).map(msg => 
        `${msg.role}: ${msg.content}`
      ).join('\n'),
      message: state.message
    });
    
    responseText = await callLLM({ prompt });
  }
  
  // Add the assistant's response to the conversation history
  conversationHistory.addMessage('assistant', responseText);
  
  return {
    ...state,
    response: responseText
  };
};

// Create the conversational agent flow
const chatFlow = Flow.start(analyzeMessage)
  .next(executeToolOrRespond);

// Create a CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("=== Flowkit Chat Agent ===");
console.log("Type 'exit' to quit\n");

const chat = () => {
  rl.question('You: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }
    
    try {
      const result = await chatFlow.run({ message: input });
      console.log(`Assistant: ${result.response}\n`);
    } catch (error) {
      console.error('Error:', error.message);
    }
    
    chat(); // Continue the conversation
  });
};

// Start the conversation
chat();
