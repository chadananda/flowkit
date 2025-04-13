/**
 * Tool Chaining Example - Demonstrates the new chainable API in Flowlite
 * 
 * This example shows how to create and chain tools together using the
 * refactored tool-centric approach.
 */

import { Tool, LLMTool, param, ParamType, flowRegistry } from '../flowtools.js';

// Create a simple text processing tool
const textProcessor = new Tool({
  name: 'textProcessor',
  description: 'Processes text in various ways',
  input: [
    param('text', ParamType.STRING, 'Text to process'),
    param('operation', ParamType.STRING, 'Operation to perform', true)
  ],
  output: [
    param('result', ParamType.STRING, 'Processed text')
  ]
}).withExecute(async ({ text, operation = 'uppercase' }) => {
  console.log(`Processing text with operation: ${operation}`);
  
  switch (operation.toLowerCase()) {
    case 'uppercase':
      return { result: text.toUpperCase() };
    case 'lowercase':
      return { result: text.toLowerCase() };
    case 'reverse':
      return { result: text.split('').reverse().join('') };
    case 'count':
      return { result: text.length.toString(), count: text.length };
    default:
      return { result: text };
  }
});

// Create a sentiment analysis tool
const sentimentAnalyzer = new Tool({
  name: 'sentimentAnalyzer',
  description: 'Analyzes the sentiment of text',
  input: [
    param('text', ParamType.STRING, 'Text to analyze')
  ],
  output: [
    param('sentiment', ParamType.STRING, 'Sentiment analysis result'),
    param('score', ParamType.NUMBER, 'Sentiment score')
  ]
}).withExecute(async ({ text }) => {
  console.log('Analyzing sentiment...');
  
  // Simple sentiment analysis (in a real app, this would use an LLM or API)
  const positiveWords = ['good', 'great', 'excellent', 'happy', 'love', 'like'];
  const negativeWords = ['bad', 'terrible', 'awful', 'sad', 'hate', 'dislike'];
  
  const words = text.toLowerCase().split(/\W+/);
  let score = 0;
  
  words.forEach(word => {
    if (positiveWords.includes(word)) score += 1;
    if (negativeWords.includes(word)) score -= 1;
  });
  
  const sentiment = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  
  return { sentiment, score };
});

// Create a formatting tool
const formatter = new Tool({
  name: 'formatter',
  description: 'Formats the results into a nice message',
  input: [
    param('result', ParamType.STRING, 'Text result'),
    param('sentiment', ParamType.STRING, 'Sentiment analysis'),
    param('score', ParamType.NUMBER, 'Sentiment score')
  ],
  output: [
    param('message', ParamType.STRING, 'Formatted message')
  ]
}).withExecute(async ({ result, sentiment, score }) => {
  console.log('Formatting results...');
  
  return {
    message: `
    ===== ANALYSIS RESULTS =====
    Processed text: ${result}
    Sentiment: ${sentiment}
    Score: ${score}
    ===========================
    `
  };
});

// Create an error handler
const errorHandler = async (error, input) => {
  console.error('An error occurred:', error.message);
  return {
    message: `Error processing your request: ${error.message}`,
    originalInput: input
  };
};

// Example 1: Simple linear chain
console.log('\n===== EXAMPLE 1: SIMPLE LINEAR CHAIN =====');
const simpleChain = textProcessor
  .then(sentimentAnalyzer)
  .then(formatter)
  .catch(errorHandler);

// Run the chain
const result1 = await simpleChain.call({
  text: 'I really love this new chainable API approach!',
  operation: 'uppercase'
});

console.log(result1.message);

// Example 2: Conditional branching
console.log('\n===== EXAMPLE 2: CONDITIONAL BRANCHING =====');

// Create a special formatter for negative sentiment
const negativeFormatter = new Tool({
  name: 'negativeFormatter',
  description: 'Special formatter for negative sentiment'
}).withExecute(async (input) => {
  return {
    message: `
    ⚠️ NEGATIVE SENTIMENT DETECTED ⚠️
    Text: ${input.result}
    Score: ${input.score}
    Consider rephrasing your message to be more positive.
    `
  };
});

// Register segments in the flow registry
flowRegistry.createSegment('positive_branch', formatter);
flowRegistry.createSegment('negative_branch', negativeFormatter);

// Create a branching chain
const branchingChain = textProcessor
  .then(sentimentAnalyzer)
  .branch(
    (input) => input.sentiment === 'positive',
    { _goto: 'positive_branch' },
    { _goto: 'negative_branch' }
  )
  .catch(errorHandler);

// Run with positive text
const result2a = await flowRegistry.execute('positive_branch', await branchingChain.call({
  text: 'I love this new approach to building flows!',
  operation: 'uppercase'
}));

console.log(result2a.message);

// Run with negative text
const result2b = await flowRegistry.execute('negative_branch', await branchingChain.call({
  text: 'I hate when APIs are hard to use and confusing.',
  operation: 'uppercase'
}));

console.log(result2b.message);

// Example 3: Switch-case branching
console.log('\n===== EXAMPLE 3: SWITCH-CASE BRANCHING =====');

// Create specialized formatters for different operations
const uppercaseFormatter = new Tool({
  name: 'uppercaseFormatter'
}).withExecute(async (input) => ({
  message: `UPPERCASE RESULT: ${input.result} (Sentiment: ${input.sentiment})`
}));

const lowercaseFormatter = new Tool({
  name: 'lowercaseFormatter'
}).withExecute(async (input) => ({
  message: `lowercase result: ${input.result} (sentiment: ${input.sentiment})`
}));

const reverseFormatter = new Tool({
  name: 'reverseFormatter'
}).withExecute(async (input) => ({
  message: `⟲ REVERSED: ${input.result} (Sentiment: ${input.sentiment}) ⟳`
}));

const defaultFormatter = new Tool({
  name: 'defaultFormatter'
}).withExecute(async (input) => ({
  message: `Default format: ${input.result} (Sentiment: ${input.sentiment})`
}));

// Create a switch chain
const switchChain = textProcessor
  .then(sentimentAnalyzer)
  .switch('operation', {
    'uppercase': uppercaseFormatter,
    'lowercase': lowercaseFormatter,
    'reverse': reverseFormatter
  }, defaultFormatter)
  .catch(errorHandler);

// Run with different operations
const result3a = await switchChain.call({
  text: 'Testing the switch functionality',
  operation: 'uppercase'
});

console.log(result3a.message);

const result3b = await switchChain.call({
  text: 'Testing the switch functionality',
  operation: 'lowercase'
});

console.log(result3b.message);

const result3c = await switchChain.call({
  text: 'Testing the switch functionality',
  operation: 'reverse'
});

console.log(result3c.message);

const result3d = await switchChain.call({
  text: 'Testing the switch functionality',
  operation: 'count' // This will use the default formatter
});

console.log(result3d.message);

// Example 4: Converting between Flow and Tool Chain
console.log('\n===== EXAMPLE 4: FLOW COMPATIBILITY =====');

import { Flow } from '../flowlite.js';

// Create a flow using the traditional API
const traditionalFlow = Flow.create({
  name: 'traditionalFlow',
  description: 'A flow created using the traditional API'
})
.start(async ({ text }) => {
  return { processedText: text.toUpperCase() };
})
.next(async ({ processedText }) => {
  return { finalResult: `Processed by traditional flow: ${processedText}` };
});

// Run the traditional flow
const result4a = await traditionalFlow.run({
  text: 'This is processed by the traditional flow API'
});

console.log(result4a.finalResult);

// Convert the flow to a tool chain
const convertedChain = traditionalFlow.toToolChain();

// Run the converted chain
const result4b = await convertedChain.call({
  text: 'This is processed by a converted flow'
});

console.log(result4b.finalResult);

// Create a tool chain
const toolChain = textProcessor
  .then(sentimentAnalyzer)
  .then(formatter);

// Convert to a flow
const convertedFlow = Flow.fromToolChain(toolChain, {
  name: 'convertedFlow',
  description: 'A flow created from a tool chain'
});

// Run the converted flow
const result4c = await convertedFlow.run({
  text: 'This demonstrates bidirectional conversion',
  operation: 'uppercase'
});

console.log(result4c.message);

console.log('\n===== ALL EXAMPLES COMPLETED =====');
