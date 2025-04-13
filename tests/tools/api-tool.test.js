/**
 * API Tool Tests
 * Tests the APITool functionality for making API requests with retry capability
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APITool } from '../../flowtools.js';

describe('APITool', () => {
  let apiTool;
  
  beforeEach(() => {
    // Create a new APITool instance for each test
    apiTool = new APITool({
      name: 'testApiTool',
      description: 'Test API Tool',
      retries: 2,
      retryDelay: 100
    });
    
    // Implement execute method for testing
    apiTool.execute = vi.fn().mockImplementation(async (input) => {
      if (input.shouldFail) {
        throw new Error('API error');
      }
      return { success: true, data: input.data || 'default data' };
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should execute successfully with valid input', async () => {
    const result = await apiTool.call({
      data: 'test data'
    });
    
    expect(apiTool.execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      data: 'test data'
    });
  });
  
  it('should track statistics for successful calls', async () => {
    await apiTool.call({ data: 'test' });
    
    expect(apiTool.stats.calls).toBe(1);
    expect(apiTool.stats.errors).toBe(0);
    expect(apiTool.stats.totalTime).toBeGreaterThan(0);
  });
  
  it('should track statistics for failed calls', async () => {
    try {
      await apiTool.call({ shouldFail: true });
    } catch (error) {
      // Expected error
    }
    
    expect(apiTool.stats.calls).toBe(1);
    expect(apiTool.stats.errors).toBe(1);
  });
  
  it('should support chaining with then()', async () => {
    // Create a second tool for chaining
    const secondTool = new APITool({ name: 'secondTool' });
    secondTool.execute = vi.fn().mockImplementation(async (input) => {
      return { 
        processed: true, 
        originalData: input.data 
      };
    });
    
    // Chain the tools
    const chain = apiTool.then(secondTool);
    
    // Execute the chain
    const result = await chain.call({ data: 'test data' });
    
    // First tool should be called with original input
    expect(apiTool.execute).toHaveBeenCalledWith({ data: 'test data' });
    
    // Second tool should be called with result from first tool
    expect(secondTool.execute).toHaveBeenCalledWith({
      success: true,
      data: 'test data'
    });
    
    // Final result should be from second tool
    expect(result).toEqual({
      processed: true,
      originalData: 'test data'
    });
  });
  
  it('should support error handling with catch()', async () => {
    // Create an error handler
    const errorHandler = vi.fn().mockImplementation(async (error, state) => {
      return { 
        handled: true, 
        errorMessage: error.message,
        originalState: state
      };
    });
    
    // Chain with error handling
    const chain = apiTool.catch(errorHandler);
    
    // Execute the chain with input that causes an error
    const result = await chain.call({ shouldFail: true });
    
    // Error handler should be called with the error and original state
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'API error' }),
      { shouldFail: true }
    );
    
    // Result should be from error handler
    expect(result).toEqual({
      handled: true,
      errorMessage: 'API error',
      originalState: { shouldFail: true }
    });
  });
  
  it('should support conditional branching with branch()', async () => {
    // Create tools for different branches
    const trueBranch = new APITool({ name: 'trueBranch' });
    trueBranch.execute = vi.fn().mockImplementation(async () => ({ branch: 'true' }));
    
    const falseBranch = new APITool({ name: 'falseBranch' });
    falseBranch.execute = vi.fn().mockImplementation(async () => ({ branch: 'false' }));
    
    // Create a condition function
    const condition = vi.fn().mockImplementation(input => input.success);
    
    // Chain with branching
    const chain = apiTool.branch(condition, trueBranch, falseBranch);
    
    // Execute with condition = true
    const trueResult = await chain.call({ data: 'success data' });
    
    // Condition should be called with result from apiTool
    expect(condition).toHaveBeenCalledWith({
      success: true,
      data: 'success data'
    });
    
    // True branch should be called
    expect(trueBranch.execute).toHaveBeenCalled();
    expect(falseBranch.execute).not.toHaveBeenCalled();
    
    // Result should be from true branch
    expect(trueResult).toEqual({ branch: 'true' });
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Override execute to return success: false
    apiTool.execute = vi.fn().mockImplementation(async () => ({ success: false }));
    
    // Execute with condition = false
    const falseResult = await chain.call({});
    
    // False branch should be called
    expect(trueBranch.execute).not.toHaveBeenCalled();
    expect(falseBranch.execute).toHaveBeenCalled();
    
    // Result should be from false branch
    expect(falseResult).toEqual({ branch: 'false' });
  });
  
  it('should support switch-case branching with switch()', async () => {
    // Create tools for different cases
    const caseA = new APITool({ name: 'caseA' });
    caseA.execute = vi.fn().mockImplementation(async () => ({ case: 'A' }));
    
    const caseB = new APITool({ name: 'caseB' });
    caseB.execute = vi.fn().mockImplementation(async () => ({ case: 'B' }));
    
    const defaultCase = new APITool({ name: 'defaultCase' });
    defaultCase.execute = vi.fn().mockImplementation(async () => ({ case: 'default' }));
    
    // Chain with switch
    const chain = apiTool.switch(
      'type',
      {
        'A': caseA,
        'B': caseB
      },
      defaultCase
    );
    
    // Override execute to return a type
    apiTool.execute = vi.fn().mockImplementation(async (input) => ({
      success: true,
      type: input.type
    }));
    
    // Execute with type = 'A'
    const resultA = await chain.call({ type: 'A' });
    
    // Case A should be called
    expect(caseA.execute).toHaveBeenCalled();
    expect(caseB.execute).not.toHaveBeenCalled();
    expect(defaultCase.execute).not.toHaveBeenCalled();
    
    // Result should be from case A
    expect(resultA).toEqual({ case: 'A' });
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Execute with type = 'C' (not in cases)
    const resultC = await chain.call({ type: 'C' });
    
    // Default case should be called
    expect(caseA.execute).not.toHaveBeenCalled();
    expect(caseB.execute).not.toHaveBeenCalled();
    expect(defaultCase.execute).toHaveBeenCalled();
    
    // Result should be from default case
    expect(resultC).toEqual({ case: 'default' });
  });
});
