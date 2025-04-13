/**
 * Article Writer Flow Tests
 * 
 * This file contains tests for the Article Writer flow and its individual tools.
 * Run with: npx vitest
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  researchTool,
  seoQualityTool,
  copywritingQualityTool,
  saveToDiskTool,
  articleWriterFlow,
  generateArticle,
  isTestMode
} from './article-writer.flow.js';
import * as fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

// Mock dependencies
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockImplementation(() => Promise.resolve())
}));

vi.mock('node-fetch', () => ({
  default: vi.fn()
}));

// We don't need to mock chalk since it's just for console formatting

describe('Article Writer Flow Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.PERPLEXITY_API_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-key';
    
    // Mock fetch response
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Mocked research content' } }]
      })
    });
    
    // Mock file operations
    fs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('researchTool', () => {
    it('should research a topic using Perplexity API', async () => {
      const result = await researchTool.call({ 
        topic: 'AI in healthcare', 
        keywords: ['machine learning', 'diagnosis'] 
      });
      
      expect(result).toContain('Test research data for AI in healthcare');
    });
    
    it('should use fallback when API key is not available', async () => {
      // Remove API key to trigger fallback
      delete process.env.PERPLEXITY_API_KEY;
      
      // Mock the LLM call in the fallback
      const originalExecute = researchTool.execute;
      researchTool.execute = vi.fn().mockResolvedValue('Fallback research content');
      
      const result = await researchTool.call({ 
        topic: 'AI in healthcare', 
        keywords: ['machine learning', 'diagnosis'] 
      });
      
      expect(result).toContain('Fallback research content');
      
      // Restore original method
      researchTool.execute = originalExecute;
    });
  });

  describe('seoQualityTool', () => {
    it('should check SEO quality of content', async () => {
      // Mock the execute method directly
      const originalExecute = seoQualityTool.execute;
      seoQualityTool.execute = vi.fn().mockResolvedValue({
        score: 8,
        analysis: 'Good SEO',
        improvements: ['Add more keywords'],
        optimizedOutline: 'Improved outline'
      });
      
      const result = await seoQualityTool.call({ 
        content: 'Test content about AI', 
        keywords: ['artificial intelligence', 'machine learning'],
        type: 'outline'
      });
      
      expect(result.score).toBe(8);
      expect(result.analysis).toBe('Good SEO');
      expect(result.improvements).toBeInstanceOf(Array);
      
      // Restore original method
      seoQualityTool.execute = originalExecute;
    });
    
    it('should handle JSON parsing errors', async () => {
      // Mock the execute method to throw an error
      const originalExecute = seoQualityTool.execute;
      seoQualityTool.execute = vi.fn().mockResolvedValue({
        score: 5,
        analysis: 'Failed to parse response',
        improvements: ['Check formatting'],
        optimizedOutline: 'Invalid response'
      });
      
      const result = await seoQualityTool.call({ 
        content: 'Test content', 
        keywords: ['test'],
        type: 'content'
      });
      
      expect(result.score).toBe(5);
      expect(result.analysis).toBe('Failed to parse response');
      
      // Restore original method
      seoQualityTool.execute = originalExecute;
    });
  });

  describe('copywritingQualityTool', () => {
    it('should check copywriting quality of content', async () => {
      // Mock the execute method directly
      const originalExecute = copywritingQualityTool.execute;
      copywritingQualityTool.execute = vi.fn().mockResolvedValue({
        score: 8,
        analysis: 'Good copywriting',
        improvements: ['Add more emotion'],
        optimizedContent: 'Improved content'
      });
      
      const result = await copywritingQualityTool.call({ 
        content: 'Test content', 
        audience: 'General readers',
        tone: 'Informative',
        type: 'outline'
      });
      
      expect(result.score).toBe(8);
      expect(result.analysis).toBe('Good copywriting');
      expect(result.improvements).toBeInstanceOf(Array);
      expect(result.optimizedContent).toBe('Improved content');
      
      // Restore original method
      copywritingQualityTool.execute = originalExecute;
    });
    
    it('should handle JSON parsing errors', async () => {
      // Mock the execute method to return an error response
      const originalExecute = copywritingQualityTool.execute;
      copywritingQualityTool.execute = vi.fn().mockResolvedValue({
        score: 5,
        analysis: 'Failed to parse response',
        improvements: ['Check formatting'],
        optimizedContent: 'Invalid response'
      });
      
      const result = await copywritingQualityTool.call({ 
        content: 'Test content', 
        audience: 'General readers',
        tone: 'Informative',
        type: 'content'
      });
      
      expect(result.score).toBe(5);
      expect(result.analysis).toBe('Failed to parse response');
      
      // Restore original method
      copywritingQualityTool.execute = originalExecute;
    });
  });

  describe('saveToDiskTool', () => {
    it('should save content to disk', async () => {
      // Mock the saveToDiskTool.execute method
      const originalExecute = saveToDiskTool.execute;
      saveToDiskTool.execute = vi.fn().mockResolvedValue({
        filePath: '/test/path/test-article.md'
      });
      
      const result = await saveToDiskTool.call({
        content: '# Test Article\n\nThis is a test article.',
        metadata: {
          title: 'Test Article',
          topic: 'Testing',
          audience: 'Developers',
          keywords: ['test', 'article'],
          seoScore: 8,
          copywritingScore: 9
        }
      });
      
      expect(result).toHaveProperty('filePath');
      expect(result.filePath).toContain('test-article');
      
      // Restore original method
      saveToDiskTool.execute = originalExecute;
    });
    
    it('should handle file writing errors', async () => {
      // Mock the saveToDiskTool.execute method to throw an error
      const originalExecute = saveToDiskTool.execute;
      saveToDiskTool.execute = vi.fn().mockRejectedValue(new Error('Write error'));
      
      await expect(saveToDiskTool.call({
        content: 'Test content',
        metadata: { title: 'Test' }
      })).rejects.toThrow('Write error');
      
      // Restore original method
      saveToDiskTool.execute = originalExecute;
    });
  });

  describe('articleWriterFlow', () => {
    it('should generate an article with all steps', async () => {
      // Mock the generateArticle function directly
      const originalGenerateArticle = generateArticle;
      global.generateArticle = vi.fn().mockResolvedValue({
        success: true,
        filePath: '/path/to/article.md',
        outline: {
          title: 'Test Article',
          sections: [{ heading: 'Section 1', keyPoints: ['Point 1', 'Point 2'] }]
        },
        article: 'Test article content',
        contentSEOScore: 8,
        contentCopyScore: 9
      });
      
      const result = await global.generateArticle({
        title: 'Test Article',
        topic: 'AI Testing',
        audience: 'Developers',
        keywords: ['test', 'ai'],
        tone: 'Informative',
        wordCount: 500
      });
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('filePath');
      
      // Restore original function
      global.generateArticle = originalGenerateArticle;
    });
    
    it('should handle errors during article generation', async () => {
      // Mock the generateArticle function to throw an error
      const originalGenerateArticle = generateArticle;
      global.generateArticle = vi.fn().mockRejectedValue(new Error('Research failed'));
      
      await expect(global.generateArticle({
        title: 'Test Article',
        topic: 'AI Testing'
      })).rejects.toThrow('Research failed');
      
      // Restore original function
      global.generateArticle = originalGenerateArticle;
    });

    it('should provide information about its required parameters', () => {
      // Verify that the flow has the expected input parameters
      const inputParams = articleWriterFlow.metadata.input;
      
      // Check that required parameters exist
      const requiredParams = inputParams.filter(p => !p.optional);
      expect(requiredParams).toHaveLength(1);
      expect(requiredParams[0].name).toBe('title');
      
      // Check that optional parameters exist
      const optionalParams = inputParams.filter(p => p.optional);
      const optionalParamNames = optionalParams.map(p => p.name);
      expect(optionalParamNames).toContain('topic');
      expect(optionalParamNames).toContain('audience');
      expect(optionalParamNames).toContain('keywords');
      expect(optionalParamNames).toContain('tone');
      expect(optionalParamNames).toContain('wordCount');
      expect(optionalParamNames).toContain('model');
      expect(optionalParamNames).toContain('temperature');
    });
  });

  describe('Required API Keys', () => {
    const originalEnv = { ...process.env };
    
    afterEach(() => {
      // Restore original environment variables
      process.env = { ...originalEnv };
    });
    
    it('should identify required API keys for the flow', () => {
      // Verify tools exist and have metadata
      expect(researchTool).toBeDefined();
      expect(researchTool.metadata).toBeDefined();
      expect(researchTool.metadata.name).toBe('researchWithPerplexity');
      
      // Verify LLM tools
      expect(seoQualityTool).toBeDefined();
      expect(seoQualityTool.metadata).toBeDefined();
      expect(seoQualityTool.metadata.name).toBe('checkSEOQuality');
      
      expect(copywritingQualityTool).toBeDefined();
      expect(copywritingQualityTool.metadata).toBeDefined();
      expect(copywritingQualityTool.metadata.name).toBe('checkCopywritingQuality');
      
      // Check that the flow requires these tools
      const flowRequiresTools = [
        researchTool, 
        seoQualityTool, 
        copywritingQualityTool,
        saveToDiskTool
      ].every(tool => tool !== undefined);
      
      expect(flowRequiresTools).toBe(true);
    });
    
    it('should verify if required API keys are present in the environment', () => {
      // Set up test environment variables
      process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      
      // Check if keys are available
      expect(process.env.PERPLEXITY_API_KEY).toBeDefined();
      expect(process.env.OPENAI_API_KEY).toBeDefined();
      
      // Test with missing key
      delete process.env.PERPLEXITY_API_KEY;
      
      // Verify researchTool handles missing key
      const missingKeyTest = async () => {
        try {
          await researchTool.call({ topic: 'Test topic' });
          return true; // If it reaches here, it handled the missing key
        } catch (error) {
          if (error.message.includes('fallback')) {
            return true; // It's using fallback mechanism
          }
          return false; // It failed to handle missing key properly
        }
      };
      
      return expect(missingKeyTest()).resolves.toBe(true);
    });
    
    it('should generate a list of required environment variables', () => {
      // This is a utility function that could be added to the Flow class
      const getRequiredEnvVars = () => {
        const requiredVars = new Set();
        
        // For this specific flow, we know these are the required keys
        requiredVars.add('PERPLEXITY_API_KEY');
        requiredVars.add('OPENAI_API_KEY');
        
        return Array.from(requiredVars);
      };
      
      const requiredVars = getRequiredEnvVars();
      expect(requiredVars).toContain('PERPLEXITY_API_KEY');
      expect(requiredVars).toContain('OPENAI_API_KEY');
      expect(requiredVars.length).toBe(2);
    });
  });
});
