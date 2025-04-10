/**
 * hello-world.js - A simple example demonstrating Flowkit's tool registry and planning
 * 
 * This example shows how to create a basic "Hello World" tool and use it in a flow
 * where a planner can decide whether to use the tool based on the input.
 */

import { Flow, registerTool } from '../../flowkit.js';
import { callLLM, promptTemplate } from '../../tools.js';

// Register a simple hello world tool
const helloWorldTool = registerTool(
  (name = 'World') => `Hello, ${name}!`,
  {
    name: 'helloWorld',
    description: 'Greets a person or the world',
    parameters: ['name?']
  }
);

// Register a tool to get the current time
const getCurrentTimeTool = registerTool(
  () => {
    const now = new Date();
    return `The current time is ${now.toLocaleTimeString()}.`;
  },
  {
    name: 'getCurrentTime',
    description: 'Returns the current time',
    parameters: []
  }
);

// Register a tool to generate a random number
const getRandomNumberTool = registerTool(
  (min = 1, max = 100) => {
    min = parseInt(min);
    max = parseInt(max);
    return `Your random number is: ${Math.floor(Math.random() * (max - min + 1)) + min}`;
  },
  {
    name: 'getRandomNumber',
    description: 'Generates a random number between min and max (defaults to 1-100)',
    parameters: ['min?', 'max?']
  }
);

// Create a planner node that decides which tool to use
const plannerNode = async (state) => {
  // Create a prompt that describes the available tools and asks the LLM to choose one
  const prompt = promptTemplate(`
You are a helpful assistant with access to the following tools:

1. helloWorld - Greets a person or the world
   Parameters: [name?] (optional)

2. getCurrentTime - Returns the current time
   Parameters: none

3. getRandomNumber - Generates a random number
   Parameters: [min?, max?] (both optional, defaults to 1-100)

Based on the user's request: "{{request}}"

Choose the most appropriate tool to use. Respond in the following JSON format:
{
  "toolName": "name of the tool to use",
  "parameters": ["param1", "param2", ...] (or [] if no parameters)
}
`, { request: state.input });

  // Call the LLM to decide which tool to use
  const decision = await callLLM({
    prompt,
    schema: {
      toolName: 'string',
      parameters: 'array'
    }
  });

  // Execute the chosen tool with the provided parameters
  let result;
  switch (decision.toolName) {
    case 'helloWorld':
      result = helloWorldTool(...decision.parameters);
      break;
    case 'getCurrentTime':
      result = getCurrentTimeTool();
      break;
    case 'getRandomNumber':
      result = getRandomNumberTool(...decision.parameters);
      break;
    default:
      result = "I'm not sure how to help with that request.";
  }

  return {
    result,
    toolUsed: decision.toolName,
    parameters: decision.parameters
  };
};

// Create the flow
const plannerFlow = Flow.start(plannerNode);

// Example usage
const runExample = async () => {
  console.log("=== Flowkit Hello World Tool Example ===\n");

  // Example 1: Greeting
  console.log("Example 1: Greeting request");
  const result1 = await plannerFlow.run({ 
    input: "Can you say hello to Alice?" 
  });
  console.log(`Result: ${result1.result}`);
  console.log(`Tool used: ${result1.toolUsed}`);
  console.log(`Parameters: ${JSON.stringify(result1.parameters)}\n`);

  // Example 2: Time request
  console.log("Example 2: Time request");
  const result2 = await plannerFlow.run({ 
    input: "What time is it right now?" 
  });
  console.log(`Result: ${result2.result}`);
  console.log(`Tool used: ${result2.toolUsed}`);
  console.log(`Parameters: ${JSON.stringify(result2.parameters)}\n`);

  // Example 3: Random number request
  console.log("Example 3: Random number request");
  const result3 = await plannerFlow.run({ 
    input: "Give me a random number between 1 and 10" 
  });
  console.log(`Result: ${result3.result}`);
  console.log(`Tool used: ${result3.toolUsed}`);
  console.log(`Parameters: ${JSON.stringify(result3.parameters)}\n`);
};

// Run the examples
runExample().catch(console.error);
