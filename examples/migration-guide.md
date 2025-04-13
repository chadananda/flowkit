# Flowlite Migration Guide: From Flow to Tool-Centric Approach

This guide will help you migrate your existing Flowlite applications from the traditional Flow-based approach to the new tool-centric approach. The new approach offers several advantages:

- More intuitive, chainable API
- Better error handling
- Conditional branching
- Non-linear navigation
- More flexible composition

## Basic Migration Steps

### 1. Traditional Flow Approach

```javascript
// Traditional Flow approach
const myFlow = Flow.create({
  name: 'myFlow',
  input: [
    param('inputParam', ParamType.STRING, 'Input parameter')
  ]
})
.next(async (state) => {
  // Step 1
  return { ...state, step1Result: 'result' };
})
.next(async (state) => {
  // Step 2
  return { ...state, step2Result: 'result' };
})
.next(async (state) => {
  // Step 3
  return { ...state, step3Result: 'result' };
});

// Run the flow
const result = await myFlow.run({ inputParam: 'value' });
```

### 2. Tool-Centric Approach

```javascript
// Tool-centric approach
const step1Tool = new Tool({ name: 'step1' })
  .withExecute(async (state) => {
    // Step 1
    return { ...state, step1Result: 'result' };
  });

const step2Tool = new Tool({ name: 'step2' })
  .withExecute(async (state) => {
    // Step 2
    return { ...state, step2Result: 'result' };
  });

const step3Tool = new Tool({ name: 'step3' })
  .withExecute(async (state) => {
    // Step 3
    return { ...state, step3Result: 'result' };
  });

// Chain the tools together
const myToolChain = step1Tool
  .then(step2Tool)
  .then(step3Tool);

// Run the tool chain
const result = await myToolChain.call({ inputParam: 'value' });
```

## Advanced Features

### Conditional Branching

```javascript
const myToolChain = step1Tool
  .then(step2Tool)
  .branch(
    // Condition function
    (state) => state.step2Result === 'success',
    // True branch
    step3Tool.then(step4Tool),
    // False branch
    errorHandlingTool
  );
```

### Multi-path Routing (Switch)

```javascript
const myToolChain = step1Tool
  .then(step2Tool)
  .switch(
    // Selector function
    (state) => state.status,
    // Cases
    {
      'success': step3Tool,
      'warning': warningHandlingTool,
      'error': errorHandlingTool,
      'default': defaultHandlingTool
    }
  );
```

### Error Handling

```javascript
const myToolChain = step1Tool
  .then(step2Tool)
  .catch(async (error, state) => {
    console.error(`Error in step2: ${error.message}`);
    return { ...state, error: error.message, status: 'error' };
  })
  .then(step3Tool);
```

### Non-linear Navigation with FlowRegistry

```javascript
// Register segments
flowRegistry.createSegment('step1', step1Tool);
flowRegistry.createSegment('step2', step2Tool);
flowRegistry.createSegment('step3', step3Tool);
flowRegistry.createSegment('error', errorHandlingTool);

// Create a tool that uses the registry
const myNonLinearChain = new Tool({ name: 'myNonLinearFlow' })
  .withExecute(async (initialState) => {
    // Start with step1
    return { _goto: 'step1', ...initialState };
  });

// Execute with the registry
const result = await flowRegistry.execute('step1', { inputParam: 'value' });

// Jump to a specific segment
const result2 = await flowRegistry.execute('step3', { 
  step1Result: 'skipped',
  step2Result: 'skipped',
  inputParam: 'value'
});
```

## Converting Existing Flows

### Option 1: Manual Conversion

1. Identify each step in your flow
2. Create a Tool for each step
3. Chain the tools together using `.then()`, `.branch()`, etc.

### Option 2: Automatic Conversion

Use the built-in conversion methods:

```javascript
// Convert a Flow to a Tool chain
const myToolChain = myFlow.toToolChain();

// Convert a Tool chain to a Flow
const newFlow = Flow.fromToolChain(myToolChain);
```

## Best Practices

1. **Create reusable tools**: Design tools that can be reused across different flows

2. **Use descriptive names**: Give your tools clear, descriptive names

3. **Handle errors gracefully**: Use `.catch()` to handle errors at appropriate points

4. **Keep state immutable**: Always return a new state object, don't modify the existing one

5. **Use branching judiciously**: Don't create overly complex branching logic

6. **Document your tools**: Add descriptions and input parameters to your tools

7. **Test individual tools**: Unit test each tool independently before chaining

## Example: Converting a Simple Flow

### Before (Flow-based)

```javascript
const userFlow = Flow.create({
  name: 'userFlow',
  input: [
    param('userId', ParamType.STRING, 'User ID')
  ]
})
.next(async (state) => {
  // Fetch user
  const user = await fetchUser(state.userId);
  return { ...state, user };
})
.next(async (state) => {
  // Fetch user preferences
  const preferences = await fetchPreferences(state.userId);
  return { ...state, preferences };
})
.next(async (state) => {
  // Generate recommendations
  const recommendations = generateRecommendations(state.user, state.preferences);
  return { ...state, recommendations };
});
```

### After (Tool-centric)

```javascript
const fetchUserTool = new Tool({ name: 'fetchUser' })
  .withExecute(async ({ userId, ...state }) => {
    const user = await fetchUser(userId);
    return { ...state, user, userId };
  });

const fetchPreferencesTool = new Tool({ name: 'fetchPreferences' })
  .withExecute(async ({ userId, ...state }) => {
    const preferences = await fetchPreferences(userId);
    return { ...state, preferences, userId };
  });

const generateRecommendationsTool = new Tool({ name: 'generateRecommendations' })
  .withExecute(async ({ user, preferences, ...state }) => {
    const recommendations = generateRecommendations(user, preferences);
    return { ...state, recommendations };
  });

const userToolChain = fetchUserTool
  .then(fetchPreferencesTool)
  .then(generateRecommendationsTool);
```

## Conclusion

The new tool-centric approach in Flowlite provides a more flexible and intuitive way to build AI-powered workflows. By following this guide, you can easily migrate your existing flows to take advantage of the new features.

For more examples, see:
- `examples/tool-chain-example.js` - Demonstrates key features of the tool-centric approach
- `example_apps/article-writer/article-writer.chain.js` - A real-world example of the article writer using the tool-centric approach
- `example_apps/ocr-pdf/ocr-pdf.chain.js` - A complex OCR pipeline using the tool-centric approach
