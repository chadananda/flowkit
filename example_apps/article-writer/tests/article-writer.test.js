import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateArticle } from './mock-article-writer.js';

// Mock dependencies to avoid actual imports in the test
vi.mock('../../flowkit.js');
vi.mock('../../tools.js');
vi.mock('fs/promises');
vi.mock('path');
vi.mock('url');
vi.mock('readline/promises');
vi.mock('dotenv');
vi.mock('node-fetch');

describe('Article Writer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.PERPLEXITY_API_KEY = 'test-key';
  });
  
  it('generates an article with the provided details', async () => {
    const articleDetails = {
      title: 'Test Article',
      topic: 'Testing',
      audience: 'Developers',
      keywords: ['test', 'article'],
      tone: 'Informative',
      wordCount: 500
    };
    
    const result = await generateArticle(articleDetails);
    
    expect(result).toHaveProperty('outline');
    expect(result).toHaveProperty('article');
    expect(result).toHaveProperty('filePath');
    expect(result).toHaveProperty('outlineSEOScore');
    expect(result).toHaveProperty('outlineCopyScore');
    expect(result).toHaveProperty('contentSEOScore');
    expect(result).toHaveProperty('contentCopyScore');
    expect(result.success).toBe(true);
  });
  
  it('handles missing Perplexity API key gracefully', async () => {
    delete process.env.PERPLEXITY_API_KEY;
    
    const articleDetails = {
      title: 'Test Article',
      topic: 'Testing',
      keywords: ['test']
    };
    
    const result = await generateArticle(articleDetails);
    expect(result.success).toBe(true);
  });
});
