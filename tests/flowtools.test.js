import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tool, flowRegistry } from '../flowlite.js';
import { createMemoryStore } from '../flowtools.js';
import { MockParamType as ParamType, mockParam as param } from './test-utils.js';

describe('Flow Tools', () => {
  describe('Memory Store', () => {
    let memoryStore;
    
    beforeEach(() => {
      memoryStore = createMemoryStore();
    });
    
    it('should store and retrieve values', async () => {
      await memoryStore.call({ key: 'testKey', value: 'testValue', action: 'set' });
      expect(await memoryStore.call('testKey')).toBe('testValue');
    });
    
    it('should return undefined for non-existent keys', async () => {
      expect(await memoryStore.call('nonExistentKey')).toBeUndefined();
    });
    
    it('should store complex objects', async () => {
      const complexObject = { 
        nested: { 
          array: [1, 2, 3],
          value: true
        },
        count: 42
      };
      
      await memoryStore.call({ key: 'complex', value: complexObject, action: 'set' });
      const retrieved = await memoryStore.call('complex');
      
      expect(retrieved).toEqual(complexObject);
    });
    
    it('should update existing values', async () => {
      await memoryStore.call({ key: 'counter', value: 1, action: 'set' });
      await memoryStore.call({ key: 'counter', value: 2, action: 'set' });
      expect(await memoryStore.call('counter')).toBe(2);
    });
    
    it('should delete values', async () => {
      await memoryStore.call({ key: 'toDelete', value: 'value', action: 'set' });
      expect(await memoryStore.call('toDelete')).toBe('value');
      
      await memoryStore.call({ key: 'toDelete', action: 'delete' });
      expect(await memoryStore.call('toDelete')).toBeUndefined();
    });
  });

  describe('Tool Chaining', () => {
    it('should chain tools with then()', async () => {
      // Create two simple tools
      const uppercase = new Tool({ name: 'uppercase' })
        .withExecute(async ({ text }) => ({ result: text.toUpperCase() }));
      
      const addExclamation = new Tool({ name: 'addExclamation' })
        .withExecute(async ({ result }) => ({ result: `${result}!` }));
      
      // Chain them together
      const chain = uppercase.then(addExclamation);
      
      // Execute the chain
      const result = await chain.call({ text: 'hello' });
      
      // Check the result
      expect(result.result).toBe('HELLO!');
    });
    
    it('should handle errors with catch()', async () => {
      // Create a tool that throws an error
      const errorTool = new Tool({ name: 'errorTool' })
        .withExecute(async () => {
          throw new Error('Test error');
        });
      
      // Create an error handler
      const errorHandler = vi.fn().mockImplementation(async (error, state) => ({
        error: error.message,
        handled: true
      }));
      
      // Chain with error handling
      const chain = errorTool.catch(errorHandler);
      
      // Execute the chain
      const result = await chain.call({});
      
      // Check the result
      expect(errorHandler).toHaveBeenCalled();
      expect(result.error).toBe('Test error');
      expect(result.handled).toBe(true);
    });
    
    it('should support conditional branching with branch()', async () => {
      // Create tools for different branches
      const evaluator = new Tool({ name: 'evaluator' })
        .withExecute(async ({ value }) => ({ value }));
      
      const trueBranch = new Tool({ name: 'trueBranch' })
        .withExecute(async ({ value }) => ({ result: `${value} is positive` }));
      
      const falseBranch = new Tool({ name: 'falseBranch' })
        .withExecute(async ({ value }) => ({ result: `${value} is not positive` }));
      
      // Create a chain with branching
      const chain = evaluator.branch(
        input => input.value > 0,
        trueBranch,
        falseBranch
      );
      
      // Execute the chain with positive value
      const positiveResult = await chain.call({ value: 5 });
      expect(positiveResult.result).toBe('5 is positive');
      
      // Execute the chain with non-positive value
      const negativeResult = await chain.call({ value: -5 });
      expect(negativeResult.result).toBe('-5 is not positive');
    });
    
    it('should support switch-case branching with switch()', async () => {
      // Create tools for different cases
      const evaluator = new Tool({ name: 'evaluator' })
        .withExecute(async ({ operation, value }) => ({ operation, value }));
      
      const double = new Tool({ name: 'double' })
        .withExecute(async ({ value }) => ({ result: value * 2 }));
      
      const square = new Tool({ name: 'square' })
        .withExecute(async ({ value }) => ({ result: value * value }));
      
      const defaultCase = new Tool({ name: 'default' })
        .withExecute(async ({ value }) => ({ result: value }));
      
      // Create a chain with switch
      const chain = evaluator.switch(
        'operation',
        {
          'double': double,
          'square': square
        },
        defaultCase
      );
      
      // Test different cases
      const doubleResult = await chain.call({ operation: 'double', value: 5 });
      expect(doubleResult.result).toBe(10);
      
      const squareResult = await chain.call({ operation: 'square', value: 5 });
      expect(squareResult.result).toBe(25);
      
      const defaultResult = await chain.call({ operation: 'unknown', value: 5 });
      expect(defaultResult.result).toBe(5);
    });

    it('should support chaining multiple tools in sequence', async () => {
      // Create a sequence of tools
      const addFive = new Tool({ name: 'addFive' })
        .withExecute(async ({ value }) => ({ value: value + 5 }));
      
      const multiplyByTwo = new Tool({ name: 'multiplyByTwo' })
        .withExecute(async ({ value }) => ({ value: value * 2 }));
      
      const subtractThree = new Tool({ name: 'subtractThree' })
        .withExecute(async ({ value }) => ({ value: value - 3 }));
      
      // Chain them together
      const chain = addFive
        .then(multiplyByTwo)
        .then(subtractThree);
      
      // Execute the chain
      const result = await chain.call({ value: 10 });
      
      // Check the result: (10 + 5) * 2 - 3 = 27
      expect(result.value).toBe(27);
    });
  });

  describe('Flow Registry', () => {
    beforeEach(() => {
      // Clear the registry before each test
      flowRegistry.segments = new Map();
      flowRegistry.tools = new Map();
    });
    
    it('should register and retrieve tools by segment ID', async () => {
      // Create a simple tool
      const greetingTool = new Tool({ name: 'greeting' })
        .withExecute(async ({ name }) => ({ message: `Hello, ${name}!` }));
      
      // Register the tool
      flowRegistry.createSegment('greeting', greetingTool);
      
      // Retrieve the tool
      const retrievedTool = flowRegistry.getSegment('greeting');
      
      // Check that it's the same tool
      expect(retrievedTool).toBe(greetingTool);
      
      // Execute the tool through the registry
      const result = await retrievedTool.call({ name: 'World' });
      expect(result.message).toBe('Hello, World!');
    });
    
    it('should execute flows with goto instructions', async () => {
      // Create tools for different segments
      const startTool = new Tool({ name: 'start' })
        .withExecute(async ({ name }) => {
          return { name, _goto: 'process' };
        });
      
      const processTool = new Tool({ name: 'process' })
        .withExecute(async ({ name }) => {
          return { name, processed: true, _goto: 'end' };
        });
      
      const endTool = new Tool({ name: 'end' })
        .withExecute(async ({ name, processed }) => {
          return { message: `Goodbye, ${name}!`, processed };
        });
      
      // Register the tools
      flowRegistry.createSegment('start', startTool);
      flowRegistry.createSegment('process', processTool);
      flowRegistry.createSegment('end', endTool);
      
      // Execute the flow
      const result = await flowRegistry.execute('start', { name: 'World' });
      
      // Check the result
      expect(result.message).toBe('Goodbye, World!');
      expect(result.processed).toBe(true);
    });
    
    it('should throw an error for non-existent segments', async () => {
      await expect(flowRegistry.execute('nonExistent', {}))
        .rejects.toThrow(/not found/);
    });
  });
});
