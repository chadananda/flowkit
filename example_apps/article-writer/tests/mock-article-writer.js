/**
 * Mock implementation of article-writer.js for testing
 */

// Create a mock result that will be returned by the generateArticle function
const mockResult = {
  title: 'Test Article',
  topic: 'Testing',
  audience: 'Developers',
  keywords: ['test', 'article'],
  tone: 'Informative',
  wordCount: 500,
  research: 'Test research data',
  outline: { 
    title: 'Test Title', 
    sections: [{ heading: 'Test Section', keyPoints: ['Point 1'] }] 
  },
  outlineSEOScore: 8,
  outlineSEOAnalysis: 'Good SEO',
  outlineCopyScore: 9,
  outlineCopyAnalysis: 'Good copy',
  article: 'Test article content',
  contentSEOScore: 8,
  contentSEOAnalysis: 'Good SEO',
  contentCopyScore: 9,
  contentCopyAnalysis: 'Good copy',
  filePath: '/test/path/test-title.md',
  success: true
};

// Mock implementation of generateArticle
export const generateArticle = async (articleDetails) => {
  console.log('🔍 Researching topic...');
  
  // If testing without Perplexity API key
  if (!process.env.PERPLEXITY_API_KEY) {
    console.warn('Research failed: PERPLEXITY_API_KEY not found. Using fallback.');
  }
  
  // Return the mock result
  return mockResult;
};
