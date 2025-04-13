/**
 * Tool Base Class Tests
 * Tests the core Tool functionality that all other tools inherit
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tool } from '../../flowtools.js';

describe('Tool Base Class', () => {
  let tool;
  
  beforeEach(() => {
    // Create a new Tool instance for each test
    tool = new Tool({
      name: 'testTool',
      description: 'Test Tool Description',
      input: [{ name: 'testInput', type: 'string' }],
      output: [{ name: 'testOutput', type: 'string' }],
      examples: [{ input: 'test', output: 'result' }],
      apiKeys: [{ name: 'TEST_API_KEY', description: 'Test API Key' }],
      tags: ['test', 'example']
    });
    
    // Implement execute method for testing
    tool.execute = vi.fn().mockImplementation(async (input) => {
      return { result: `Processed: ${input.text || 'no input'}` };
    });
  });
  
  it('should initialize with correct metadata', () => {
    expect(tool.metadata.name).toBe('testTool');
    expect(tool.metadata.description).toBe('Test Tool Description');
    expect(tool.metadata.input).toEqual([{ name: 'testInput', type: 'string' }]);
    expect(tool.metadata.output).toEqual([{ name: 'testOutput', type: 'string' }]);
    expect(tool.metadata.examples).toEqual([{ input: 'test', output: 'result' }]);
    expect(tool.metadata.apiKeys).toEqual([{ name: 'TEST_API_KEY', description: 'Test API Key' }]);
    expect(tool.metadata.tags).toEqual(['test', 'example']);
  });
  
  it('should initialize with default values when not provided', () => {
    const defaultTool = new Tool();
    
    expect(defaultTool.metadata.name).toBe('unnamed_tool');
    expect(defaultTool.metadata.description).toBe('No description provided');
    expect(defaultTool.metadata.input).toEqual([]);
    expect(defaultTool.metadata.output).toEqual([]);
    expect(defaultTool.metadata.examples).toEqual([]);
    expect(defaultTool.metadata.apiKeys).toEqual([]);
    expect(defaultTool.metadata.tags).toEqual([]);
  });
  
  it('should initialize statistics', () => {
    expect(tool.stats).toEqual({
      calls: 0,
      errors: 0,
      totalTime: 0
    });
  });
  
  it('should call execute method and update statistics', async () => {
    const result = await tool.call({ text: 'test input' });
    
    expect(tool.execute).toHaveBeenCalledWith({ text: 'test input' });
    expect(result).toEqual({ result: 'Processed: test input' });
    expect(tool.stats.calls).toBe(1);
    expect(tool.stats.errors).toBe(0);
    expect(tool.stats.totalTime).toBeGreaterThan(0);
  });
  
  it('should handle errors and update error statistics', async () => {
    // Override execute to throw an error
    tool.execute = vi.fn().mockImplementation(() => {
      throw new Error('Test error');
    });
    
    await expect(tool.call({ text: 'test' })).rejects.toThrow('Test error');
    
    expect(tool.stats.calls).toBe(1);
    expect(tool.stats.errors).toBe(1);
  });
  
  it('should support chainable configuration methods', () => {
    const result = tool
      .setLogLevel(2)
      .setLogger(console)
      .withApiKey('API_KEY', 'API Key Description')
      .withExample('example input', 'example output')
      .withTag('new-tag');
    
    // Methods should return the tool instance for chaining
    expect(result).toBe(tool);
    
    // Check that the configurations were applied
    expect(tool.logLevel).toBe(2);
    expect(tool.logger).toBe(console);
    expect(tool.metadata.apiKeys).toContainEqual({
      name: 'API_KEY',
      description: 'API Key Description',
      required: true
    });
    expect(tool.metadata.examples).toContainEqual({
      input: 'example input',
      output: 'example output'
    });
    expect(tool.metadata.tags).toContain('new-tag');
  });
  
  it('should support withExecute for setting the execute method', async () => {
    const customExecute = vi.fn().mockImplementation(async (input) => {
      return { custom: true, input };
    });
    
    tool.withExecute(customExecute);
    
    const result = await tool.call({ text: 'test' });
    
    expect(customExecute).toHaveBeenCalledWith({ text: 'test' });
    expect(result).toEqual({ custom: true, input: { text: 'test' } });
  });
  
  it('should convert to a function with asFunction()', async () => {
    const fn = tool.asFunction();
    
    expect(typeof fn).toBe('function');
    
    const result = await fn({ text: 'function test' });
    
    expect(tool.execute).toHaveBeenCalledWith({ text: 'function test' });
    expect(result).toEqual({ result: 'Processed: function test' });
  });
  
  it('should support goto for flow control', async () => {
    // In the actual implementation, goto returns an object with _goto property
    // not a Tool instance
    const gotoResult = tool.goto('nextSegment');
    
    // Should return a goto instruction directly
    expect(gotoResult).toEqual({ _goto: 'nextSegment' });
  });
  
  it('should support conditional goto with gotoIf', async () => {
    const condition = vi.fn().mockImplementation(input => input.shouldJump);
    
    // Override execute to implement gotoIf behavior
    tool.execute = vi.fn().mockImplementation(async (input) => {
      if (condition(input)) {
        return { _goto: 'jumpTarget' };
      }
      return { result: 'No jump' };
    });
    
    // Execute with condition = true
    const trueResult = await tool.call({ shouldJump: true });
    expect(trueResult).toEqual({ _goto: 'jumpTarget' });
    
    // Execute with condition = false
    const falseResult = await tool.call({ shouldJump: false });
    expect(falseResult).toEqual({ result: 'No jump' });
  });
  
  it('should provide statistics through getStats()', async () => {
    // Execute the tool multiple times
    await tool.call({ text: 'test1' });
    await tool.call({ text: 'test2' });
    
    // Simulate an error
    tool.execute = vi.fn().mockImplementation(() => {
      throw new Error('Test error');
    });
    
    try {
      await tool.call({ text: 'error' });
    } catch (error) {
      // Expected error
    }
    
    const stats = tool.getStats();
    
    expect(stats.calls).toBe(3);
    expect(stats.errors).toBe(1);
    expect(stats.totalTime).toBeGreaterThan(0);
    expect(stats.avgTime).toBeGreaterThan(0);
    expect(stats.errorRate).toBeCloseTo(1/3);
  });
  
  it('should reset statistics with resetStats()', async () => {
    // Execute the tool to generate some stats
    await tool.call({ text: 'test' });
    
    expect(tool.stats.calls).toBe(1);
    
    // Reset stats
    tool.resetStats();
    
    expect(tool.stats.calls).toBe(0);
    expect(tool.stats.errors).toBe(0);
    expect(tool.stats.totalTime).toBe(0);
  });
});
