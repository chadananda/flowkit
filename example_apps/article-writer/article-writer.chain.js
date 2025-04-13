/**
 * article-writer.chain.js - Tool-centric implementation of the article writer
 * 
 * This file demonstrates the new chainable API approach for the article writer.
 */
import { Tool, APITool, LLMTool, param, ParamType, flowRegistry } from '../../../flowlite.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, 'articles');
export const isTestMode = process.env.NODE_ENV === 'test';

// Ultra-compact tool definitions using class expressions
export const researchTool = new class extends APITool {
  constructor() {
    super({
      name: 'researchWithPerplexity',
      description: 'Research a topic using Perplexity API',
      input: [
        param('topic', ParamType.STRING, 'Topic to research'),
        param('keywords', ParamType.ARRAY, 'Keywords to include', { optional: true })
      ]
    });
    this.withApiKey('PERPLEXITY_API_KEY');
  }
  
  async execute({ topic, keywords = [] }) {
    if (isTestMode) return { research: 'Test research data for ' + topic };
    
    try {
      const apiKey = process.env.PERPLEXITY_API_KEY;
      if (!apiKey) throw new Error('PERPLEXITY_API_KEY not found');
      
      const query = `${topic} ${keywords.join(' ')}`;
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'sonar-medium-online',
          messages: [{ role: 'user', content: `Research about: ${query}` }]
        })
      });
      
      if (!response.ok) throw new Error(`Perplexity API error: ${response.statusText}`);
      return { research: (await response.json()).choices[0].message.content };
    } catch (error) {
      console.warn(chalk.yellow(`Research failed: ${error.message}. Using fallback.`));
      
      // Fallback to LLM
      const fallbackTool = new class extends LLMTool {
        constructor() {
          super({
            name: 'fallbackResearch',
            description: 'Research a topic using LLM',
            temperature: 0.3
          });
        }
        
        async execute({ topic, keywords }) {
          const prompt = `Research the topic "${topic}" with keywords: ${keywords.join(', ')}. Provide 3-5 main points.`;
          const result = await this.call({ prompt });
          return { research: result };
        }
      }();
      
      return fallbackTool.call({ topic, keywords });
    }
  }
}();

export const seoQualityTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'checkSEOQuality',
      description: 'Check SEO quality of content',
      input: [
        param('content', ParamType.STRING, 'Content to check'),
        param('keywords', ParamType.ARRAY, 'Target keywords', { optional: true }),
        param('type', ParamType.STRING, 'Content type (outline or content)', { optional: true })
      ],
      temperature: 0.3
    });
  }
  
  async execute({ content, keywords = [], type = 'outline' }) {
    if (isTestMode) {
      return {
        score: 8,
        analysis: 'Test SEO analysis',
        improvements: ['Test improvement'],
        optimizedOutline: 'Test optimized outline',
        optimizedContent: 'Test optimized content'
      };
    }
    
    const prompt = `
You are an SEO expert. Analyze this ${type} for SEO quality:

${content}

Target keywords: ${keywords.join(', ')}

Evaluate: keyword usage, structure, search visibility, content depth.
Score from 1-10 and provide improvements.
JSON format: {"score": 7, "analysis": "Brief analysis", "improvements": ["Improvement 1"], "optimized${type.charAt(0).toUpperCase() + type.slice(1)}": "Improved version"}`;

    try {
      const response = await this.call({ prompt });
      return JSON.parse(response);
    } catch (e) {
      return {
        score: 5,
        analysis: 'Failed to parse response',
        improvements: ['Check formatting'],
        optimizedOutline: content,
        optimizedContent: content
      };
    }
  }
}();

export const copywritingQualityTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'checkCopywritingQuality',
      description: 'Check copywriting quality of content',
      input: [
        param('content', ParamType.STRING, 'Content to check'),
        param('audience', ParamType.STRING, 'Target audience'),
        param('tone', ParamType.STRING, 'Desired tone'),
        param('type', ParamType.STRING, 'Content type (outline or content)', { optional: true })
      ],
      temperature: 0.3
    });
  }
  
  async execute({ content, audience, tone, type = 'outline' }) {
    if (isTestMode) {
      return {
        score: 8,
        analysis: 'Test copywriting analysis',
        improvements: ['Test improvement'],
        optimizedOutline: 'Test optimized outline',
        optimizedContent: 'Test optimized content'
      };
    }
    
    const prompt = `
You are a copywriting expert. Analyze this ${type} for copywriting quality:

${content}

Target audience: ${audience}
Desired tone: ${tone}

Evaluate: engagement, clarity, persuasiveness, emotional appeal, audience alignment.
Score from 1-10 and provide improvements.
JSON format: {"score": 7, "analysis": "Brief analysis", "improvements": ["Improvement 1"], "optimized${type.charAt(0).toUpperCase() + type.slice(1)}": "Improved version"}`;

    try {
      const response = await this.call({ prompt });
      return JSON.parse(response);
    } catch (e) {
      return {
        score: 5,
        analysis: 'Failed to parse response',
        improvements: ['Check formatting'],
        optimizedOutline: content,
        optimizedContent: content
      };
    }
  }
}();

export const saveToDiskTool = new class extends Tool {
  constructor() {
    super({
      name: 'saveToDisk',
      description: 'Save article to disk',
      input: [
        param('content', ParamType.STRING, 'Article content'),
        param('metadata', ParamType.OBJECT, 'Article metadata')
      ]
    });
  }
  
  async execute({ content, metadata }) {
    if (isTestMode) return { filePath: '/test/path/article.md' };
    
    try {
      await fs.mkdir(outputDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeTitle = (metadata.title || 'article').replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const fileName = `${safeTitle}-${timestamp}.md`;
      const filePath = path.join(outputDir, fileName);
      
      // Add metadata as YAML front matter
      const frontMatter = Object.entries(metadata)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? `[${value.join(', ')}]` : value}`)
        .join('\n');
        
      const fileContent = `---\n${frontMatter}\n---\n\n${content}`;
      
      await fs.writeFile(filePath, fileContent, 'utf8');
      
      return { filePath };
    } catch (error) {
      this.error(`Failed to save article: ${error.message}`);
      throw error;
    }
  }
}();

// Create the outline tool as a standalone tool
export const outlineTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'createOutline',
      description: 'Create an article outline',
      temperature: 0.7
    });
  }
  
  async execute({ topic, audience, tone, keywords, wordCount, research }) {
    if (isTestMode) {
      return {
        outline: {
          title: `Test Article about ${topic}`,
          sections: [
            { heading: 'Introduction', keyPoints: ['Key point 1', 'Key point 2'] },
            { heading: 'Section 1', keyPoints: ['Key point 1', 'Key point 2'] },
            { heading: 'Conclusion', keyPoints: ['Key point 1', 'Key point 2'] }
          ]
        }
      };
    }
    
    const prompt = `
Create a detailed outline for a ${wordCount}-word article about "${topic}".

RESEARCH:
${research}

REQUIREMENTS:
- Target audience: ${audience}
- Tone: ${tone}
- Include keywords naturally: ${keywords.join(', ')}
- Create 4-6 sections with clear headings
- Include key points for each section
- Ensure logical flow and progression

Format as JSON:
{
  "title": "Compelling Article Title",
  "sections": [
    {
      "heading": "Section Heading",
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
    }
  ]
}`;

    try {
      const response = await this.call({ prompt });
      return { outline: JSON.parse(response) };
    } catch (e) {
      this.error(`Failed to parse outline: ${e.message}`);
      // Create a fallback outline
      return {
        outline: {
          title: `Article about ${topic}`,
          sections: [
            { heading: 'Introduction', keyPoints: ['Introduction to the topic'] },
            { heading: 'Main Content', keyPoints: ['Key information about the topic'] },
            { heading: 'Conclusion', keyPoints: ['Summary of key points'] }
          ]
        }
      };
    }
  }
}();

// Create the article writing tool as a standalone tool
export const articleTool = new class extends LLMTool {
  constructor() {
    super({
      name: 'writeArticle',
      description: 'Write full article'
    });
  }
  
  async execute({ outline, research, audience, tone, keywords, wordCount, model, temperature }) {
    if (isTestMode) return { article: 'Test article content' };
    
    const outlineText = outline.sections.map(s => 
      `# ${s.heading}\n${s.keyPoints.map(p => `- ${p}`).join('\n')}`
    ).join('\n\n');
    
    const prompt = `
Write a ${wordCount}-word article based on this research and outline:

RESEARCH:
${research}

OUTLINE:
Title: ${outline.title}
${outlineText}

REQUIREMENTS:
- Target audience: ${audience}
- Tone: ${tone}
- Include keywords naturally: ${keywords.join(', ')}
- Format in Markdown with proper headings
- Create engaging introduction and strong conclusion
- Approximately ${wordCount} words`;

    const response = await this.call({ 
      prompt,
      model,
      temperature
    });
    
    return { article: response };
  }
}();

// Create tools for displaying progress
const logProgressTool = new Tool({ name: 'logProgress' })
  .withExecute(async ({ message, ...state }) => {
    console.log(message);
    return state;
  });

// Register segments for the article writer flow
flowRegistry.createSegment('research', 
  logProgressTool
    .withExecute(async (state) => {
      console.log(chalk.blue('🔎 Researching topic...'));
      return state;
    })
    .then(researchTool)
);

flowRegistry.createSegment('createOutline', 
  logProgressTool
    .withExecute(async (state) => {
      console.log(chalk.green('📝 Creating outline...'));
      return state;
    })
    .then(outlineTool)
);

flowRegistry.createSegment('checkOutlineSEO', 
  logProgressTool
    .withExecute(async (state) => {
      console.log(chalk.magenta('🔍 Checking outline for SEO quality...'));
      
      const outlineText = `Title: ${state.outline.title}\n\n` + 
        state.outline.sections.map(s => 
          `# ${s.heading}\n${s.keyPoints.map(p => `- ${p}`).join('\n')}`
        ).join('\n\n');
      
      return { ...state, outlineText };
    })
    .then(async ({ outlineText, keywords, ...state }) => {
      const seoCheck = await seoQualityTool.call({
        content: outlineText,
        keywords,
        type: 'outline'
      });
      
      // Update outline if score is low
      const updatedOutline = seoCheck.score < 7 && seoCheck.optimizedOutline
        ? JSON.parse(seoCheck.optimizedOutline) 
        : state.outline;
      
      return { 
        ...state, 
        outline: updatedOutline,
        outlineSEOScore: seoCheck.score,
        outlineSEOAnalysis: seoCheck.analysis,
        keywords
      };
    })
);

flowRegistry.createSegment('checkOutlineCopywriting', 
  logProgressTool
    .withExecute(async (state) => {
      console.log(chalk.magenta('✍️ Checking outline for copywriting quality...'));
      
      const outlineText = `Title: ${state.outline.title}\n\n` + 
        state.outline.sections.map(s => 
          `# ${s.heading}\n${s.keyPoints.map(p => `- ${p}`).join('\n')}`
        ).join('\n\n');
      
      return { ...state, outlineText };
    })
    .then(async ({ outlineText, audience, tone, ...state }) => {
      const copyCheck = await copywritingQualityTool.call({
        content: outlineText,
        audience,
        tone,
        type: 'outline'
      });
      
      // Update outline if score is low
      const updatedOutline = copyCheck.score < 7 && copyCheck.optimizedOutline
        ? JSON.parse(copyCheck.optimizedOutline)
        : state.outline;
      
      return { 
        ...state, 
        outline: updatedOutline,
        outlineCopyScore: copyCheck.score,
        outlineCopyAnalysis: copyCheck.analysis,
        audience,
        tone
      };
    })
);

flowRegistry.createSegment('writeArticle', 
  logProgressTool
    .withExecute(async (state) => {
      console.log(chalk.green('📝 Writing article...'));
      return state;
    })
    .then(articleTool)
);

flowRegistry.createSegment('checkContentCopywriting', 
  logProgressTool
    .withExecute(async (state) => {
      console.log(chalk.magenta('✍️ Checking content for copywriting quality...'));
      return state;
    })
    .then(async ({ article, audience, tone, ...state }) => {
      const copyCheck = await copywritingQualityTool.call({
        content: article,
        audience,
        tone,
        type: 'content'
      });
      
      return { 
        ...state, 
        article: copyCheck.score < 7 ? copyCheck.optimizedContent : article,
        contentCopyScore: copyCheck.score,
        contentCopyAnalysis: copyCheck.analysis,
        audience,
        tone
      };
    })
);

flowRegistry.createSegment('checkContentSEO', 
  logProgressTool
    .withExecute(async (state) => {
      console.log(chalk.magenta('🔍 Checking content for SEO quality...'));
      return state;
    })
    .then(async ({ article, keywords, ...state }) => {
      const seoCheck = await seoQualityTool.call({
        content: article,
        keywords,
        type: 'content'
      });
      
      return { 
        ...state, 
        article: seoCheck.score < 7 ? seoCheck.optimizedContent : article,
        contentSEOScore: seoCheck.score,
        contentSEOAnalysis: seoCheck.analysis,
        keywords
      };
    })
);

flowRegistry.createSegment('saveArticle', 
  logProgressTool
    .withExecute(async (state) => {
      console.log(chalk.green('💾 Saving article...'));
      return state;
    })
    .then(async ({ article, outline, topic, audience, keywords, contentSEOScore, contentCopyScore, ...state }) => {
      const saveResult = await saveToDiskTool.call({
        content: article,
        metadata: {
          title: outline.title || state.title,
          topic,
          audience,
          keywords,
          seoScore: contentSEOScore,
          copywritingScore: contentCopyScore
        }
      });
      
      console.log(chalk.bold.green(`✅ Article saved to: ${saveResult.filePath}`));
      console.log(chalk.bold.yellow(`📊 SEO Score: ${contentSEOScore}/10`));
      console.log(chalk.bold.yellow(`📊 Copywriting Score: ${contentCopyScore}/10`));
      
      return { 
        ...state, 
        filePath: saveResult.filePath, 
        success: true,
        article,
        outline,
        topic,
        audience,
        keywords,
        contentSEOScore,
        contentCopyScore
      };
    })
);

// Create the main article writer chain
export const articleWriterChain = new Tool({ 
  name: 'articleWriter',
  description: 'Generate high-quality articles with AI assistance'
})
.withExecute(async (initialState) => {
  // Initialize state with defaults
  const state = {
    title: initialState.title || 'Untitled Article',
    topic: initialState.topic || initialState.title || 'General Topic',
    keywords: initialState.keywords || [],
    audience: initialState.audience || 'General',
    tone: initialState.tone || 'Informative',
    wordCount: initialState.wordCount || 1500,
    model: initialState.model || 'gpt-4',
    temperature: initialState.temperature || 0.7,
    ...initialState
  };
  
  return { _goto: 'research', ...state };
});

// Export the main function with a terse implementation
export const generateArticle = async (articleDetails) => {
  try {
    return await flowRegistry.execute('research', articleDetails);
  } catch (error) {
    console.error(chalk.bold.red(`❌ Error: ${error.message}`));
    throw error;
  }
};
