# Flowlite Refactoring Guide

This document outlines the changes made to refactor Flowlite into a more tool-centric and flexible framework, as well as guidance on how to migrate existing code and take advantage of the new features.

## Overview of Changes

The Flowlite framework has been refactored to embrace a tool-centric architecture with chainable operations, inspired by JavaScript Promises. This approach offers:

- A simplified mental model ("this, then that") for developers
- Reduced boilerplate and fewer abstractions
- A familiar pattern resembling JavaScript Promises
- Better composability of flows and improved reusability
- A more intuitive and expressive API

## Key New Features

### Chainable Tool API

Tools can now be chained together using methods like:

- `then(nextTool)`: Chain tools sequentially
- `branch(condition, truePath, falsePath)`: Add conditional branching
- `switch(keySelector, cases, defaultCase)`: Add switch-case branching
- `catch(handler)`: Add error handling

### Flow Registry for Non-Linear Navigation

A new `FlowRegistry` class enables complex non-linear flows:

- Register tools and segments with `flowRegistry.createSegment(id, tool)`
- Navigate between segments using `goto(segmentId)` and `gotoIf(condition, segmentId)`
- Execute flows starting from any segment with `flowRegistry.execute(segmentId, input)`

### Backward Compatibility

Existing Flow-based code continues to work, with new methods for conversion:

- Convert a Flow to a tool chain with `flow.toToolChain()`
- Create a Flow from a tool chain with `Flow.fromToolChain(toolChain)`

## Migration Guide

### Migrating from Flow-Based to Tool-Centric

**Before (Flow-based approach):**

```javascript
const myFlow = Flow.create({ name: 'myFlow' })
  .start(async ({ input }) => {
    return { processed: input.toUpperCase() };
  })
  .next(async ({ processed }) => {
    return { result: `Processed: ${processed}` };
  });

const result = await myFlow.run({ input: 'hello' });
```

**After (Tool-centric approach):**

```javascript
const processor = new Tool({ name: 'processor' })
  .withExecute(async ({ input }) => {
    return { processed: input.toUpperCase() };
  });

const formatter = new Tool({ name: 'formatter' })
  .withExecute(async ({ processed }) => {
    return { result: `Processed: ${processed}` };
  });

const chain = processor.then(formatter);
const result = await chain.call({ input: 'hello' });
```

### Adding Conditional Logic

**Before (Flow-based approach):**

```javascript
const myFlow = Flow.create({ name: 'myFlow' })
  .start(async ({ value }) => {
    if (value > 10) return 'high';
    return 'low';
  })
  .on('high', async () => {
    return { result: 'Value is high' };
  })
  .on('low', async () => {
    return { result: 'Value is low' };
  });
```

**After (Tool-centric approach):**

```javascript
const evaluator = new Tool({ name: 'evaluator' })
  .withExecute(async ({ value }) => {
    return { value };
  });

const highHandler = new Tool({ name: 'highHandler' })
  .withExecute(async () => {
    return { result: 'Value is high' };
  });

const lowHandler = new Tool({ name: 'lowHandler' })
  .withExecute(async () => {
    return { result: 'Value is low' };
  });

const chain = evaluator.branch(
  (input) => input.value > 10,
  highHandler,
  lowHandler
);
```

### Using Non-Linear Navigation

```javascript
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

## Best Practices

1. **Use Tool Primitives**: Extend from `Tool`, `LLMTool`, or `APITool` for specialized functionality

2. **Chain for Readability**: Use the chainable API for clear, linear flows:
   ```javascript
   const flow = toolA.then(toolB).then(toolC).catch(errorHandler);
   ```

3. **Segments for Complex Flows**: Use the registry and goto for complex non-linear flows

4. **Error Handling**: Always add error handlers with `.catch()` for robust flows

5. **State Management**: State is automatically passed between chain links, with each tool's result merged into the state

6. **Conversion for Migration**: Use conversion methods when gradually migrating existing code

## Example

```javascript
// Create tools
const textProcessor = new Tool({ name: 'textProcessor' })
  .withExecute(async ({ text }) => {
    return { processed: text.toUpperCase() };
  });

const sentimentAnalyzer = new Tool({ name: 'sentimentAnalyzer' })
  .withExecute(async ({ processed }) => {
    // Simple sentiment analysis
    const score = processed.includes('GOOD') ? 1 : -1;
    return { sentiment: score > 0 ? 'positive' : 'negative', score };
  });

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
  )
  .catch(async (error) => {
    return { message: `Error: ${error.message}` };
  });

// Run the chain
const result = await chain.call({ text: 'This is good!' });
console.log(result.message); // 😊 Positive: THIS IS GOOD!
```

## Conclusion

This refactoring makes Flowlite more intuitive and flexible while maintaining backward compatibility. By embracing a tool-centric approach with chainable operations, we've simplified the mental model and improved composability, making it easier to build complex AI-powered applications.

For more detailed examples, see the `examples/tool-chaining.js` file in the repository.
