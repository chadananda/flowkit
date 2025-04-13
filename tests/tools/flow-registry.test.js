/**
 * Flow Registry Tests
 * Tests the FlowRegistry functionality for managing complex flows with named segments
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tool, flowRegistry } from '../../flowlite.js';

describe('FlowRegistry', () => {
  beforeEach(() => {
    // Clear the registry before each test
    flowRegistry.segments = new Map();
    flowRegistry.tools = new Map();
  });
  
  it('should register and retrieve tools by ID', async () => {
    // Create a simple tool
    const testTool = new Tool({ name: 'testTool' })
      .withExecute(async (input) => ({ result: `Processed: ${input.text}` }));
    
    // Register the tool
    const registeredTool = flowRegistry.register(testTool);
    
    // Should return the same tool
    expect(registeredTool).toBe(testTool);
    
    // Retrieve the tool by ID
    const retrievedTool = flowRegistry.getTool(testTool.toolId);
    
    // Should be the same tool
    expect(retrievedTool).toBe(testTool);
    
    // Execute the tool
    const result = await retrievedTool.call({ text: 'test input' });
    expect(result).toEqual({ result: 'Processed: test input' });
  });
  
  it('should create and retrieve segments', async () => {
    // Create a simple tool
    const greetingTool = new Tool({ name: 'greeting' })
      .withExecute(async ({ name }) => ({ message: `Hello, ${name}!` }));
    
    // Create a segment
    flowRegistry.createSegment('greeting', greetingTool);
    
    // Retrieve the segment
    const retrievedTool = flowRegistry.getSegment('greeting');
    
    // Should be the same tool
    expect(retrievedTool).toBe(greetingTool);
    
    // Execute the tool
    const result = await retrievedTool.call({ name: 'World' });
    expect(result).toEqual({ message: 'Hello, World!' });
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
    expect(result).toEqual({
      message: 'Goodbye, World!',
      processed: true,
      name: 'World'
    });
  });
  
  it('should throw an error for non-existent segments', async () => {
    await expect(flowRegistry.execute('nonExistent', {}))
      .rejects.toThrow(/not found/);
  });
  
  it('should handle circular flow paths', async () => {
    // Create tools with a circular reference
    const toolA = new Tool({ name: 'toolA' })
      .withExecute(async (input) => {
        input.countA = (input.countA || 0) + 1;
        
        // Break the circle after a few iterations
        if (input.countA < 3) {
          return { ...input, _goto: 'segmentB' };
        }
        
        return { ...input, _goto: 'segmentC' };
      });
    
    const toolB = new Tool({ name: 'toolB' })
      .withExecute(async (input) => {
        input.countB = (input.countB || 0) + 1;
        return { ...input, _goto: 'segmentA' };
      });
    
    const toolC = new Tool({ name: 'toolC' })
      .withExecute(async (input) => {
        input.done = true;
        return input;
      });
    
    // Register the tools
    flowRegistry.createSegment('segmentA', toolA);
    flowRegistry.createSegment('segmentB', toolB);
    flowRegistry.createSegment('segmentC', toolC);
    
    // Execute the flow
    const result = await flowRegistry.execute('segmentA', {});
    
    // Should have gone through the loop multiple times
    expect(result.countA).toBe(3);
    expect(result.countB).toBe(2);
    expect(result.done).toBe(true);
  });
  
  it('should handle conditional branching in flows', async () => {
    // Create tools with conditional branching
    const startTool = new Tool({ name: 'start' })
      .withExecute(async ({ value }) => {
        return { value };
      });
    
    // Create a tool that uses gotoIf for conditional branching
    const branchTool = startTool.gotoIf(
      input => input.value > 0,
      'positive'
    );
    
    const positiveTool = new Tool({ name: 'positive' })
      .withExecute(async ({ value }) => {
        return { result: `${value} is positive` };
      });
    
    const negativeTool = new Tool({ name: 'negative' })
      .withExecute(async ({ value }) => {
        return { result: `${value} is not positive` };
      });
    
    // Register the tools
    flowRegistry.createSegment('start', branchTool);
    flowRegistry.createSegment('positive', positiveTool);
    flowRegistry.createSegment('negative', negativeTool);
    
    // Execute with positive value
    const positiveResult = await flowRegistry.execute('start', { value: 5 });
    expect(positiveResult.result).toBe('5 is positive');
    
    // Execute with negative value
    const negativeResult = await flowRegistry.execute('start', { value: -5 });
    // Since there's no explicit goto for negative values, it should stop after branchTool
    expect(negativeResult).toEqual({ value: -5 });
  });
  
  it('should register tools with both ID and segment', async () => {
    // Create a tool
    const tool = new Tool({ name: 'dualTool' })
      .withExecute(async (input) => ({ processed: true, input }));
    
    // Register with both ID and segment
    flowRegistry.register(tool, 'testSegment');
    
    // Should be retrievable by both ID and segment
    const byId = flowRegistry.getTool(tool.toolId);
    const bySegment = flowRegistry.getSegment('testSegment');
    
    expect(byId).toBe(tool);
    expect(bySegment).toBe(tool);
  });
  
  it('should handle complex flow patterns with multiple branches', async () => {
    // Create a flow with multiple paths
    const startTool = new Tool({ name: 'start' })
      .withExecute(async ({ path }) => {
        return { path, _goto: path };
      });
    
    const pathATool = new Tool({ name: 'pathA' })
      .withExecute(async (input) => {
        return { ...input, resultA: 'Path A executed', _goto: 'end' };
      });
    
    const pathBTool = new Tool({ name: 'pathB' })
      .withExecute(async (input) => {
        return { ...input, resultB: 'Path B executed', _goto: 'end' };
      });
    
    const pathCTool = new Tool({ name: 'pathC' })
      .withExecute(async (input) => {
        return { ...input, resultC: 'Path C executed', _goto: 'end' };
      });
    
    const endTool = new Tool({ name: 'end' })
      .withExecute(async (input) => {
        return { ...input, completed: true };
      });
    
    // Register the tools
    flowRegistry.createSegment('start', startTool);
    flowRegistry.createSegment('pathA', pathATool);
    flowRegistry.createSegment('pathB', pathBTool);
    flowRegistry.createSegment('pathC', pathCTool);
    flowRegistry.createSegment('end', endTool);
    
    // Execute with different paths
    const resultA = await flowRegistry.execute('start', { path: 'pathA' });
    expect(resultA).toEqual({
      path: 'pathA',
      resultA: 'Path A executed',
      completed: true
    });
    
    const resultB = await flowRegistry.execute('start', { path: 'pathB' });
    expect(resultB).toEqual({
      path: 'pathB',
      resultB: 'Path B executed',
      completed: true
    });
    
    const resultC = await flowRegistry.execute('start', { path: 'pathC' });
    expect(resultC).toEqual({
      path: 'pathC',
      resultC: 'Path C executed',
      completed: true
    });
  });
});
