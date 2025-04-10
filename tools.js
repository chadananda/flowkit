/**
 * Flowkit Tools - Built-in utilities for LLM-powered agent flows
 */

import { registerTool } from './flowkit.js';

// LLM Integration Tools
export const callLLM = async ({ 
  prompt, 
  model = 'default', 
  temperature = 0.7, 
  maxTokens = 1000,
  schema = null,
  retries = 3,
  validate = null,
  provider = 'openai'
}) => {
  let attempt = 0;
  let error = null;
  
  while (attempt < retries) {
    try {
      // This is a placeholder for actual LLM API calls
      // In a real implementation, this would call the appropriate provider API
      const response = await simulateLLMCall(prompt, model, temperature, maxTokens, provider);
      
      // Parse response if schema is provided
      const parsedResponse = schema ? parseStructuredOutput(response, schema) : response;
      
      // Validate response if validation function is provided
      if (validate && !validate(parsedResponse)) {
        throw new Error('Response validation failed');
      }
      
      return parsedResponse;
    } catch (err) {
      error = err;
      attempt++;
      // Exponential backoff
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  
  throw new Error(`LLM call failed after ${retries} attempts: ${error?.message}`);
};

// Register callLLM as a tool
registerTool(callLLM, {
  name: 'callLLM',
  description: 'Call an LLM with structured output parsing and validation',
  inputs: {
    prompt: 'string',
    model: 'string?',
    temperature: 'number?',
    maxTokens: 'number?',
    schema: 'object?',
    retries: 'number?',
    validate: 'function?',
    provider: 'string?'
  },
  returns: 'any'
});

// Prompt Template Tool
export const promptTemplate = (template, variables = {}) => {
  return Object.entries(variables).reduce(
    (prompt, [key, value]) => prompt.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value),
    template
  );
};

registerTool(promptTemplate, {
  name: 'promptTemplate',
  description: 'Create a prompt from a template and variables',
  inputs: {
    template: 'string',
    variables: 'object?'
  },
  returns: 'string'
});

// State Management Tools
export const stateSnapshot = (state) => {
  return JSON.parse(JSON.stringify(state));
};

registerTool(stateSnapshot, {
  name: 'stateSnapshot',
  description: 'Create a deep copy snapshot of the current state',
  inputs: {
    state: 'object'
  },
  returns: 'object'
});

// Data Processing Tools
export const jsonParser = (text, fallback = {}) => {
  try {
    // Try to extract JSON from text if it's embedded in other content
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                      text.match(/```([\s\S]*?)```/) ||
                      text.match(/\{[\s\S]*\}/);
    
    const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
    return JSON.parse(jsonString);
  } catch (error) {
    return fallback;
  }
};

registerTool(jsonParser, {
  name: 'jsonParser',
  description: 'Extract and parse JSON from text, with fallback for errors',
  inputs: {
    text: 'string',
    fallback: 'any?'
  },
  returns: 'object'
});

export const textChunker = (text, { maxChunkSize = 1000, overlap = 200 } = {}) => {
  if (!text || text.length <= maxChunkSize) return [text];
  
  const chunks = [];
  let position = 0;
  
  while (position < text.length) {
    let chunkEnd = Math.min(position + maxChunkSize, text.length);
    
    // Try to end at a sentence or paragraph boundary if possible
    if (chunkEnd < text.length) {
      const nextPeriod = text.indexOf('.', chunkEnd - 100);
      const nextNewline = text.indexOf('\n', chunkEnd - 100);
      
      if (nextPeriod !== -1 && nextPeriod < chunkEnd + 100) {
        chunkEnd = nextPeriod + 1;
      } else if (nextNewline !== -1 && nextNewline < chunkEnd + 100) {
        chunkEnd = nextNewline + 1;
      }
    }
    
    chunks.push(text.substring(position, chunkEnd));
    position = chunkEnd - overlap;
  }
  
  return chunks;
};

registerTool(textChunker, {
  name: 'textChunker',
  description: 'Split text into overlapping chunks for processing',
  inputs: {
    text: 'string',
    options: 'object?'
  },
  returns: 'array'
});

// Helper function to simulate LLM calls (for demonstration purposes)
const simulateLLMCall = async (prompt, model, temperature, maxTokens, provider) => {
  // This is just a placeholder that would be replaced with actual API calls
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  return `This is a simulated response from ${provider} using model ${model}`;
};

// Helper function to parse structured output based on a schema
const parseStructuredOutput = (text, schema) => {
  // Try to extract JSON from the response
  const parsed = jsonParser(text);
  
  // Apply schema validation/coercion here if needed
  return parsed;
};
