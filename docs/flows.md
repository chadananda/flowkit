# Flowlite Flow API Documentation

This document provides detailed information about Flowlite's Flow API, which is used to orchestrate tools into complex workflows.

## Table of Contents

1. [Flow Architecture](#flow-architecture)
2. [Creating Flows](#creating-flows)
3. [Flow Methods](#flow-methods)
4. [Branching Logic](#branching-logic)
5. [Error Handling](#error-handling)
6. [Parallel Execution](#parallel-execution)
7. [Flow Composition](#flow-composition)
8. [Flow Patterns](#flow-patterns)
9. [Best Practices](#best-practices)

## Flow Architecture

Flowlite's Flow system is designed to orchestrate tools into structured workflows:

```ditaa
+------------------------+
|         Flow           |
|------------------------|
| + name                 |
| + description          |
| + nodes                |
| + create()             |
| + next()               |
| + on()                 |
| + run()                |
+------------------------+
           |
           v
+------------------------+
|         Node           |
|------------------------|
| + id                   |
| + execute()            |
| + next                 |
| + branches             |
+------------------------+
           |
           v
+------------------------+
|         Tool           |
|------------------------|
| + name                 |
| + description          |
| + execute()            |
| + call()               |
+------------------------+
```

A Flow consists of a series of Nodes, each of which can execute a function or a Tool. Nodes can be connected in a linear sequence or with branching logic.

## Creating Flows

### Basic Flow Creation

The simplest way to create a flow is using the `Flow.create()` method:

```js
import { Flow, param, ParamType } from 'flowlite';

// Create a simple flow
const greetingFlow = Flow.create({
  name: 'greeting',
  description: 'Greets a user by name',
  input: [
    param('name', ParamType.STRING, 'Name to greet')
  ]
});
```

### Adding Nodes

Once you've created a flow, you can add nodes using the `next()` method:

```js
// Add a node to the flow
greetingFlow.next(({ name = 'World' }) => {
  return { message: `Hello, ${name}!` };
});

// Run the flow
const result = await greetingFlow.run({ name: 'Flowlite' });
console.log(result.message); // "Hello, Flowlite!"
```

### Using Tools in Flows

Flows become powerful when combined with tools:

```js
import { Flow } from 'flowlite';
import { translateText, analyzeSentiment } from './my-tools.js';

// Create a flow that uses tools
const analyzeFlow = Flow.create({
  name: 'analyzeText',
  description: 'Analyzes text sentiment in any language'
})
.next(async ({ text, language }) => {
  // First translate to English if not already in English
  let englishText = text;
  if (language && language.toLowerCase() !== 'english') {
    const translated = await translateText.call({
      text,
      sourceLanguage: language,
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

// Run the flow
const result = await analyzeFlow.run({
  text: "C'est une journée magnifique!",
  language: "French"
});
```

## Flow Methods

### Flow.create()

Creates a new flow with the specified configuration:

```js
const myFlow = Flow.create({
  name: 'myFlow',           // Required: Flow name
  description: 'My flow',   // Optional: Flow description
  input: [                  // Optional: Input parameters
    param('param1', ParamType.STRING, 'Parameter 1'),
    param('param2', ParamType.NUMBER, 'Parameter 2', true)
  ],
  output: {                 // Optional: Output schema
    type: 'object',
    properties: {
      result: { type: 'string' }
    }
  },
  options: {                // Optional: Additional options
    logLevel: LogLevel.INFO,
    timeout: 30000
  }
});
```

### next()

Adds a node to the flow:

```js
myFlow.next(async (state) => {
  // Do something with state
  return { ...state, newValue: 'something' };
});

// You can also add a named node
myFlow.next('processData', async (state) => {
  // Do something with state
  return { ...state, processed: true };
});

// Or use a tool directly
myFlow.next(async (state) => {
  return await myTool.call(state);
});
```

### on()

Adds a conditional branch to the flow:

```js
// Branch based on a string value
myFlow
  .next(({ type }) => {
    // Return the branch name
    return type; // 'a', 'b', or 'c'
  })
  .on('a', (state) => {
    // Handle type 'a'
    return { ...state, result: 'Type A' };
  })
  .on('b', (state) => {
    // Handle type 'b'
    return { ...state, result: 'Type B' };
  })
  .on('c', (state) => {
    // Handle type 'c'
    return { ...state, result: 'Type C' };
  });

// Branch based on a function
myFlow
  .next((state) => {
    // Return the state unchanged
    return state;
  })
  .on(state => state.value > 10, (state) => {
    // Handle value > 10
    return { ...state, result: 'Value is greater than 10' };
  })
  .on(state => state.value <= 10, (state) => {
    // Handle value <= 10
    return { ...state, result: 'Value is 10 or less' };
  });
```

### run()

Executes the flow with the given input:

```js
// Run the flow
const result = await myFlow.run({
  param1: 'value1',
  param2: 42
});

// Run with options
const resultWithOptions = await myFlow.run(
  { param1: 'value1', param2: 42 },
  { 
    timeout: 60000,
    logLevel: LogLevel.DEBUG
  }
);
```

### getNode()

Gets a node by name:

```js
// Get a node by name
const node = myFlow.getNode('processData');

// Execute the node directly
const result = await node.execute({ data: 'test' });
```

## Branching Logic

Flowlite supports sophisticated branching logic:

### String-Based Branching

```js
const routingFlow = Flow.create({ name: 'routing' })
  .next(({ type }) => {
    // Return a string to indicate which branch to take
    return type;
  })
  .on('question', (state) => {
    // Handle questions
    return { ...state, response: 'I can answer that question' };
  })
  .on('request', (state) => {
    // Handle requests
    return { ...state, response: 'I can fulfill that request' };
  })
  .on('statement', (state) => {
    // Handle statements
    return { ...state, response: 'I acknowledge your statement' };
  });
```

### Function-Based Branching

```js
const scoringFlow = Flow.create({ name: 'scoring' })
  .next(({ score }) => {
    // Just pass through the state
    return { score };
  })
  .on(state => state.score >= 90, (state) => {
    return { ...state, grade: 'A' };
  })
  .on(state => state.score >= 80 && state.score < 90, (state) => {
    return { ...state, grade: 'B' };
  })
  .on(state => state.score >= 70 && state.score < 80, (state) => {
    return { ...state, grade: 'C' };
  })
  .on(state => state.score >= 60 && state.score < 70, (state) => {
    return { ...state, grade: 'D' };
  })
  .on(state => state.score < 60, (state) => {
    return { ...state, grade: 'F' };
  });
```

### Default Branch

```js
const processingFlow = Flow.create({ name: 'processing' })
  .next(({ status }) => {
    return status;
  })
  .on('success', (state) => {
    return { ...state, message: 'Operation successful' };
  })
  .on('error', (state) => {
    return { ...state, message: 'Operation failed' };
  })
  .on('*', (state) => {
    // Default branch for any other status
    return { ...state, message: `Unknown status: ${state.status}` };
  });
```

## Error Handling

Flowlite provides several mechanisms for handling errors in flows:

### Try-Catch Pattern

```js
const robustFlow = Flow.create({ name: 'robustFlow' })
  .next(async (state) => {
    try {
      // Attempt to call an API
      const response = await fetch('https://api.example.com/data');
      const data = await response.json();
      return { ...state, data, success: true };
    } catch (error) {
      // Handle the error
      console.error('API call failed:', error);
      return { ...state, error: error.message, success: false };
    }
  })
  .next((state) => {
    // Branch based on success or failure
    return state.success ? 'success' : 'failure';
  })
  .on('success', (state) => {
    // Process the data
    return { ...state, processed: true };
  })
  .on('failure', (state) => {
    // Handle the failure
    return { ...state, fallback: 'Using cached data' };
  });
```

### Error Branches

```js
const apiFlow = Flow.create({ name: 'apiFlow' })
  .next(async (state) => {
    try {
      const response = await fetch('https://api.example.com/data');
      const data = await response.json();
      return { ...state, data };
    } catch (error) {
      // Explicitly return an error state
      return { ...state, error: error.message };
    }
  })
  .next((state) => {
    // Check if there was an error
    return state.error ? 'error' : 'success';
  })
  .on('success', (state) => {
    // Process the data
    return { ...state, result: state.data.value * 2 };
  })
  .on('error', (state) => {
    // Handle the error
    return { ...state, result: 'Failed to get data: ' + state.error };
  });
```

### Global Error Handler

```js
const criticalFlow = Flow.create({ 
  name: 'criticalFlow',
  // Global error handler
  errorHandler: (error, state) => {
    console.error('Flow error:', error);
    // Return a fallback state
    return { 
      error: error.message,
      fallback: true,
      originalState: state
    };
  }
})
.next(async (state) => {
  // This might throw an error
  const result = await riskyOperation(state);
  return { ...state, result };
});

// The flow will never throw an error to the caller
// Instead, it will return the state from the error handler
```

## Parallel Execution

Flowlite supports parallel execution of tasks:

### Promise.all Pattern

```js
const parallelFlow = Flow.create({ name: 'parallelFlow' })
  .next(async ({ userId }) => {
    // Execute multiple API calls in parallel
    const [profile, posts, friends] = await Promise.all([
      fetch(`/api/users/${userId}`).then(r => r.json()),
      fetch(`/api/users/${userId}/posts`).then(r => r.json()),
      fetch(`/api/users/${userId}/friends`).then(r => r.json())
    ]);
    
    // Return combined results
    return {
      profile,
      posts,
      friends,
      timestamp: Date.now()
    };
  });
```

### Parallel Tool Execution

```js
const analyzeFlow = Flow.create({ name: 'analyzeFlow' })
  .next(async ({ text }) => {
    // Execute multiple tools in parallel
    const [sentiment, entities, summary] = await Promise.all([
      analyzeSentiment.call({ text }),
      extractEntities.call({ text }),
      summarizeText.call({ text })
    ]);
    
    // Return combined results
    return {
      text,
      sentiment: sentiment.sentiment,
      entities: entities.entities,
      summary: summary.summary
    };
  });
```

## Flow Composition

Flows can be composed to create more complex workflows:

### Sequential Composition

```js
// Create a flow for data fetching
const fetchDataFlow = Flow.create({ name: 'fetchData' })
  .next(async ({ id }) => {
    const response = await fetch(`/api/data/${id}`);
    const data = await response.json();
    return { data };
  });

// Create a flow for data processing
const processDataFlow = Flow.create({ name: 'processData' })
  .next(({ data }) => {
    const processed = data.map(item => item.value * 2);
    return { processed };
  });

// Compose the flows
const combinedFlow = Flow.create({ name: 'combined' })
  .next(async (state) => {
    // Run the first flow
    const fetchResult = await fetchDataFlow.run(state);
    
    // Run the second flow with the result of the first
    const processResult = await processDataFlow.run(fetchResult);
    
    // Return the combined result
    return {
      ...state,
      ...fetchResult,
      ...processResult
    };
  });
```

### Nested Flows

```js
// Create a sub-flow
const validationFlow = Flow.create({ name: 'validation' })
  .next(({ data }) => {
    const isValid = data && data.length > 0;
    return { isValid };
  });

// Create a main flow that uses the sub-flow
const mainFlow = Flow.create({ name: 'main' })
  .next(async (state) => {
    // Fetch data
    const response = await fetch('/api/data');
    const data = await response.json();
    return { ...state, data };
  })
  .next(async (state) => {
    // Validate the data using the sub-flow
    const validationResult = await validationFlow.run(state);
    return { ...state, ...validationResult };
  })
  .next((state) => {
    // Branch based on validation result
    return state.isValid ? 'valid' : 'invalid';
  })
  .on('valid', (state) => {
    // Process valid data
    return { ...state, processed: true };
  })
  .on('invalid', (state) => {
    // Handle invalid data
    return { ...state, error: 'Invalid data' };
  });
```

## Flow Patterns

### Pipeline Pattern

```js
const pipelineFlow = Flow.create({ name: 'pipeline' })
  .next(async ({ input }) => {
    // Stage 1: Parse
    const parsed = parseInput(input);
    return { input, parsed };
  })
  .next(async ({ input, parsed }) => {
    // Stage 2: Validate
    const validated = validateData(parsed);
    return { input, parsed, validated };
  })
  .next(async ({ input, parsed, validated }) => {
    // Stage 3: Transform
    const transformed = transformData(validated);
    return { input, parsed, validated, transformed };
  })
  .next(async ({ input, parsed, validated, transformed }) => {
    // Stage 4: Store
    const stored = await storeData(transformed);
    return { input, parsed, validated, transformed, stored };
  });
```

### Saga Pattern

```js
const sagaFlow = Flow.create({ name: 'saga' })
  .next(async ({ orderId, amount }) => {
    try {
      // Step 1: Verify inventory
      const inventory = await checkInventory(orderId);
      if (!inventory.available) {
        throw new Error('Inventory not available');
      }
      
      // Step 2: Process payment
      const payment = await processPayment(orderId, amount);
      if (!payment.success) {
        throw new Error('Payment failed');
      }
      
      // Step 3: Update inventory
      const updated = await updateInventory(orderId);
      if (!updated.success) {
        // Compensating transaction: Refund payment
        await refundPayment(payment.id);
        throw new Error('Inventory update failed');
      }
      
      // Step 4: Create shipment
      const shipment = await createShipment(orderId);
      if (!shipment.success) {
        // Compensating transactions
        await refundPayment(payment.id);
        await restoreInventory(orderId);
        throw new Error('Shipment creation failed');
      }
      
      return {
        success: true,
        orderId,
        paymentId: payment.id,
        shipmentId: shipment.id
      };
    } catch (error) {
      return {
        success: false,
        orderId,
        error: error.message
      };
    }
  });
```

### State Machine Pattern

```js
const orderFlow = Flow.create({ name: 'orderProcessing' })
  .next(({ order }) => {
    // Determine the current state
    return order.status;
  })
  .on('created', async (state) => {
    // Process a newly created order
    const validated = await validateOrder(state.order);
    return { 
      ...state, 
      order: { ...state.order, status: 'validated', validated }
    };
  })
  .on('validated', async (state) => {
    // Process a validated order
    const payment = await processPayment(state.order);
    return { 
      ...state, 
      order: { ...state.order, status: 'paid', payment }
    };
  })
  .on('paid', async (state) => {
    // Process a paid order
    const shipment = await createShipment(state.order);
    return { 
      ...state, 
      order: { ...state.order, status: 'shipped', shipment }
    };
  })
  .on('shipped', async (state) => {
    // Process a shipped order
    const delivery = await trackDelivery(state.order);
    return { 
      ...state, 
      order: { ...state.order, status: 'delivered', delivery }
    };
  })
  .on('delivered', (state) => {
    // Process a delivered order
    return { 
      ...state, 
      order: { ...state.order, status: 'completed' }
    };
  })
  .on('*', (state) => {
    // Handle unknown states
    return { 
      ...state, 
      error: `Unknown order status: ${state.order.status}`
    };
  });
```

## Best Practices

### Flow Design

1. **Single Responsibility**: Each flow should have a clear purpose
2. **Composability**: Design flows to be composable
3. **State Immutability**: Treat state as immutable
4. **Error Handling**: Include comprehensive error handling
5. **Documentation**: Document flow behavior and requirements

### Performance

1. **Parallel Execution**: Use Promise.all for parallel operations
2. **Caching**: Cache results for expensive operations
3. **Lazy Loading**: Load resources only when needed
4. **Timeouts**: Set appropriate timeouts for long-running operations
5. **Resource Management**: Release resources when done

### Maintainability

1. **Naming**: Use clear, descriptive names for flows and nodes
2. **Modularity**: Break complex flows into smaller, reusable flows
3. **Testing**: Write tests for each flow
4. **Logging**: Include appropriate logging
5. **Versioning**: Version flows appropriately

### Security

1. **Input Validation**: Validate all inputs
2. **Output Sanitization**: Sanitize outputs
3. **Error Handling**: Don't expose sensitive information in errors
4. **Authentication**: Include proper authentication
5. **Authorization**: Check permissions before operations
