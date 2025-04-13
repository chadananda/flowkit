/**
 * LLM Tool Tests
 * Tests the LLMTool functionality for LLM interactions with validation and parsing
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMTool } from '../../flowtools.js';

// Mock global fetch
global.fetch = vi.fn();

describe('LLMTool', () => {
  let llmTool;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    
    // Create a new LLMTool instance for each test
    llmTool = new LLMTool({
      validateJSON: true,
      repairJSON: true,
      retries: 2
    });
    
    // Override the callLLMAPI method to avoid actual API calls
    llmTool.callLLMAPI = vi.fn().mockImplementation(async (prompt, model, temperature, maxTokens, provider) => {
      if (provider === 'openai') {
        return {
          choices: [
            {
              message: {
                content: '{"result": "This is a test response from OpenAI"}'
              }
            }
          ]
        };
      } else if (provider === 'anthropic') {
        return {
          content: [
            {
              text: '{"result": "This is a test response from Anthropic"}'
            }
          ]
        };
      } else {
        return '{"result": "This is a test response from default provider"}';
      }
    });
  });
  
  afterEach(() => {
    // Clean up environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });
  
  it('should call LLM API with correct parameters', async () => {
    const result = await llmTool.call({
      prompt: 'Test prompt',
      model: 'gpt-4',
      temperature: 0.7,
      provider: 'openai'
    });
    
    expect(llmTool.callLLMAPI).toHaveBeenCalledWith(
      'Test prompt',
      'gpt-4',
      0.7,
      expect.any(Number),
      'openai',
      expect.any(Object)
    );
    
    expect(result).toEqual({
      result: 'This is a test response from OpenAI'
    });
  });
  
  it('should use default values when parameters are not provided', async () => {
    await llmTool.call({
      prompt: 'Test prompt'
    });
    
    expect(llmTool.callLLMAPI).toHaveBeenCalledWith(
      'Test prompt',
      expect.any(String), // Default model
      expect.any(Number), // Default temperature
      expect.any(Number), // Default maxTokens
      expect.any(String), // Default provider
      expect.any(Object)
    );
  });
  
  it('should handle different providers', async () => {
    const anthropicResult = await llmTool.call({
      prompt: 'Test prompt',
      provider: 'anthropic',
      model: 'claude-3-opus'
    });
    
    expect(llmTool.callLLMAPI).toHaveBeenCalledWith(
      'Test prompt',
      'claude-3-opus',
      expect.any(Number),
      expect.any(Number),
      'anthropic',
      expect.any(Object)
    );
    
    expect(anthropicResult).toEqual({
      result: 'This is a test response from Anthropic'
    });
  });
  
  it('should validate JSON output', async () => {
    // Override callLLMAPI to return invalid JSON
    const originalCallLLMAPI = llmTool.callLLMAPI;
    llmTool.callLLMAPI = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: 'This is not valid JSON'
          }
        }
      ]
    });
    
    // Expect the call to throw an error
    await expect(llmTool.call({
      prompt: 'Test prompt',
      provider: 'openai',
      validateJSON: true
    })).rejects.toThrow(/Failed to parse JSON/);
    
    // Restore original method
    llmTool.callLLMAPI = originalCallLLMAPI;
  });
  
  it('should repair malformed JSON', async () => {
    // Override callLLMAPI to return malformed but repairable JSON
    const originalCallLLMAPI = llmTool.callLLMAPI;
    llmTool.callLLMAPI = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '{ result: "Missing quotes around property name" }'
          }
        }
      ]
    });
    
    // With repairJSON enabled, it should fix the JSON
    const result = await llmTool.call({
      prompt: 'Test prompt',
      provider: 'openai',
      validateJSON: true,
      repairJSON: true
    });
    
    expect(result).toHaveProperty('result');
    
    // Restore original method
    llmTool.callLLMAPI = originalCallLLMAPI;
  });
  
  it('should validate against schema', async () => {
    // Override callLLMAPI to return JSON that doesn't match schema
    const originalCallLLMAPI = llmTool.callLLMAPI;
    llmTool.callLLMAPI = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"wrongProperty": "This does not match the schema"}'
          }
        }
      ]
    });
    
    // With schema validation enabled, it should throw an error
    await expect(llmTool.call({
      prompt: 'Test prompt',
      provider: 'openai',
      validateJSON: true,
      validateSchema: true,
      schema: {
        type: 'object',
        required: ['result'],
        properties: {
          result: { type: 'string' }
        }
      }
    })).rejects.toThrow(/Schema validation failed/);
    
    // Restore original method
    llmTool.callLLMAPI = originalCallLLMAPI;
  });
  
  it('should retry on failure', async () => {
    // Override callLLMAPI to fail on first call, succeed on second
    const originalCallLLMAPI = llmTool.callLLMAPI;
    llmTool.callLLMAPI = vi.fn()
      .mockRejectedValueOnce(new Error('API rate limit exceeded'))
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '{"result": "Success after retry"}'
            }
          }
        ]
      });
    
    const result = await llmTool.call({
      prompt: 'Test prompt',
      provider: 'openai',
      retries: 3
    });
    
    expect(llmTool.callLLMAPI).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      result: 'Success after retry'
    });
    
    // Restore original method
    llmTool.callLLMAPI = originalCallLLMAPI;
  });
  
  it('should respect rate limits', async () => {
    // Create a tool with strict rate limits
    const rateLimitedTool = new LLMTool({
      rateLimit: {
        openai: { tokensPerMinute: 1, requestsPerMinute: 1 }
      }
    });
    
    // Override the callLLMAPI method
    rateLimitedTool.callLLMAPI = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"result": "Success"}'
          }
        }
      ]
    });
    
    // Make multiple calls in quick succession
    await rateLimitedTool.call({
      prompt: 'Test prompt 1',
      provider: 'openai'
    });
    
    // The second call should be rate limited
    await expect(rateLimitedTool.call({
      prompt: 'Test prompt 2',
      provider: 'openai'
    })).rejects.toThrow(/Rate limit/);
    
    // Wait for rate limit to reset
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Now it should work again
    await rateLimitedTool.call({
      prompt: 'Test prompt 3',
      provider: 'openai'
    });
    
    expect(rateLimitedTool.callLLMAPI).toHaveBeenCalledTimes(2);
  });
  
  it('should extract JSON from text with other content', async () => {
    // Override callLLMAPI to return JSON embedded in other text
    const originalCallLLMAPI = llmTool.callLLMAPI;
    llmTool.callLLMAPI = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Here is the result: {"result": "Extracted from text"} Hope that helps!'
          }
        }
      ]
    });
    
    const result = await llmTool.call({
      prompt: 'Test prompt',
      provider: 'openai',
      validateJSON: true
    });
    
    expect(result).toEqual({
      result: 'Extracted from text'
    });
    
    // Restore original method
    llmTool.callLLMAPI = originalCallLLMAPI;
  });
});
