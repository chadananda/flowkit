/**
 * Web Fetch Tool Tests
 * Tests the WebFetchTool functionality for making HTTP requests with retry capability
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebFetchTool } from '../../flowtools.js';

// Mock global fetch
global.fetch = vi.fn();

describe('WebFetchTool', () => {
  let webFetchTool;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a new WebFetchTool instance for each test
    webFetchTool = new WebFetchTool({
      retries: 2,
      retryDelay: 100
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should fetch data from a URL with default GET method', async () => {
    // Mock successful response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test data' })
    });
    
    const result = await webFetchTool.call('https://example.com/api');
    
    // Check that fetch was called with the correct URL and method
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
    
    // Check the result
    expect(result).toEqual({ data: 'test data' });
  });
  
  it('should fetch data with custom method and headers', async () => {
    // Mock successful response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });
    
    const result = await webFetchTool.call({
      url: 'https://example.com/api',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'custom-value'
      },
      body: { key: 'value' }
    });
    
    // Check that fetch was called with the correct parameters
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'custom-value'
        }),
        body: JSON.stringify({ key: 'value' })
      })
    );
    
    // Check the result
    expect(result).toEqual({ success: true });
  });
  
  it('should handle different response types', async () => {
    // Mock text response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Plain text response'
    });
    
    const textResult = await webFetchTool.call({
      url: 'https://example.com/text',
      responseType: 'text'
    });
    
    expect(textResult).toBe('Plain text response');
    
    // Mock blob response
    const mockBlob = new Blob(['test'], { type: 'text/plain' });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob
    });
    
    const blobResult = await webFetchTool.call({
      url: 'https://example.com/blob',
      responseType: 'blob'
    });
    
    expect(blobResult).toBe(mockBlob);
  });
  
  it('should retry on failure', async () => {
    // Mock failed response followed by successful response
    global.fetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'retry success' })
      });
    
    const result = await webFetchTool.call('https://example.com/api');
    
    // Check that fetch was called twice
    expect(global.fetch).toHaveBeenCalledTimes(2);
    
    // Check the result
    expect(result).toEqual({ data: 'retry success' });
  });
  
  it('should retry on non-OK response', async () => {
    // Mock non-OK response followed by successful response
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'retry success' })
      });
    
    const result = await webFetchTool.call('https://example.com/api');
    
    // Check that fetch was called twice
    expect(global.fetch).toHaveBeenCalledTimes(2);
    
    // Check the result
    expect(result).toEqual({ data: 'retry success' });
  });
  
  it('should throw error after maximum retries', async () => {
    // Mock multiple failed responses
    global.fetch
      .mockRejectedValueOnce(new Error('Network error 1'))
      .mockRejectedValueOnce(new Error('Network error 2'))
      .mockRejectedValueOnce(new Error('Network error 3'));
    
    // Should throw error after retries are exhausted
    await expect(webFetchTool.call('https://example.com/api'))
      .rejects.toThrow('Network error 3');
    
    // Check that fetch was called the expected number of times (initial + retries)
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
  
  it('should handle request with string body', async () => {
    // Mock successful response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });
    
    await webFetchTool.call({
      url: 'https://example.com/api',
      method: 'POST',
      body: 'string body'
    });
    
    // Check that fetch was called with string body
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        body: 'string body'
      })
    );
  });
  
  it('should handle request with no body for GET requests', async () => {
    // Mock successful response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test' })
    });
    
    await webFetchTool.call({
      url: 'https://example.com/api',
      method: 'GET'
    });
    
    // Check that fetch was called without body
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'GET'
      })
    );
    
    // Body should not be present in the options
    const options = global.fetch.mock.calls[0][1];
    expect(options).not.toHaveProperty('body');
  });
});
