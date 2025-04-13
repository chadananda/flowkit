/**
 * article-writer.flow.js - Ultra-compact flow for generating articles
 */
import { Flow, Tool, APITool, LLMTool, param, ParamType, LogLevel } from '../../../flowlite.js';
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
    if (isTestMode) return 'Test research data for ' + topic;
    
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
      return (await response.json()).choices[0].message.content;
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
        
        buildPrompt({ topic, keywords }) {
          return `Research the topic "${topic}" with keywords: ${keywords.join(', ')}. Provide 3-5 main points.`;
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
  
  buildPrompt({ content, keywords = [], type = 'outline' }) {
    if (isTestMode) {
      return 'Test SEO prompt';
    }
    
    return `
You are an SEO expert. Analyze this ${type} for SEO quality:

${content}

Target keywords: ${keywords.join(', ')}

Evaluate: keyword usage, structure, search visibility, content depth.
Score from 1-10 and provide improvements.
JSON format: {"score": 7, "analysis": "Brief analysis", "improvements": ["Improvement 1"], "optimized${type.charAt(0).toUpperCase() + type.slice(1)}": "Improved version"}`;
  }
  
  processResponse(response) {
    if (isTestMode) {
      return {
        score: 8,
        analysis: 'Test SEO analysis',
        improvements: ['Test improvement'],
        optimizedOutline: 'Test optimized outline',
        optimizedContent: 'Test optimized content'
      };
    }
    
    try {
      return JSON.parse(response);
    } catch (e) {
      return {
        score: 5,
        analysis: 'Failed to parse response',
        improvements: ['Check formatting'],
        optimizedOutline: response,
        optimizedContent: response
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
  
  buildPrompt({ content, audience, tone, type = 'outline' }) {
    if (isTestMode) {
      return 'Test copywriting prompt';
    }
    
    return `
You are an expert copywriter. Analyze this ${type}:

${content}

Target audience: ${audience}
Desired tone: ${tone}

Evaluate: engagement, readability, tone consistency, persuasiveness, impact.
Score from 1-10 and provide improvements.
JSON format: {"score": 7, "analysis": "Brief analysis", "improvements": ["Improvement 1"], "optimized${type.charAt(0).toUpperCase() + type.slice(1)}": "Improved version"}`;
  }
  
  processResponse(response) {
    if (isTestMode) {
      return {
        score: 8,
        analysis: 'Test copywriting analysis',
        improvements: ['Test improvement'],
        optimizedOutline: 'Test optimized outline',
        optimizedContent: 'Improved content'
      };
    }
    
    try {
      return JSON.parse(response);
    } catch (e) {
      return {
        score: 5,
        analysis: 'Failed to parse response',
        improvements: ['Check formatting'],
        optimizedOutline: response,
        optimizedContent: response
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
    if (isTestMode) return { filePath: '/test/path/test-article.md' };
    
    await fs.mkdir(outputDir, { recursive: true });
    const filename = `${metadata.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    const filePath = path.join(outputDir, filename);
    
    const frontMatter = [
      '---',
      `title: "${metadata.title}"`,
      `topic: "${metadata.topic}"`,
      `audience: "${metadata.audience}"`,
      `keywords: [${metadata.keywords.map(k => `"${k}"`).join(', ')}]`,
      `seoScore: ${metadata.seoScore}`,
      `copywritingScore: ${metadata.copywritingScore}`,
      '---',
      '',
      content
    ].join('\n');
    
    await fs.writeFile(filePath, frontMatter, 'utf8');
    return { filePath };
  }
}();

// Ultra-compact article writer flow
export const articleWriterFlow = Flow.create({ 
  name: 'articleWriter',
  input: [
    param('title', ParamType.STRING, 'Article title'),
    param('topic', ParamType.STRING, 'Article topic', { optional: true }),
    param('audience', ParamType.STRING, 'Target audience', { optional: true }),
    param('keywords', ParamType.ARRAY, 'Keywords', { optional: true }),
    param('tone', ParamType.STRING, 'Content tone', { optional: true }),
    param('wordCount', ParamType.NUMBER, 'Word count', { optional: true }),
    param('model', ParamType.STRING, 'LLM model', { optional: true }),
    param('temperature', ParamType.NUMBER, 'LLM temperature', { optional: true })
  ]
})
.next(({ title, topic, audience, keywords, tone, wordCount, model, temperature }) => {
  console.log(chalk.blue('🔍 Analyzing request...'));
  return {
    title,
    topic: topic || title,
    audience: audience || 'General readers',
    keywords: keywords || [],
    tone: tone || 'Informative',
    wordCount: wordCount || 800,
    model: model || process.env.DEFAULT_MODEL || 'gpt-4',
    temperature: temperature || parseFloat(process.env.DEFAULT_TEMPERATURE) || 0.7
  };
})
.next(async (state) => {
  console.log(chalk.blue('🔎 Researching topic...'));
  const research = await researchTool.call({ 
    topic: state.topic, 
    keywords: state.keywords 
  });
  return { ...state, research };
})
.next(async (state) => {
  console.log(chalk.green('📝 Creating outline...'));
  
  const outlineTool = new class extends LLMTool {
    constructor() {
      super({
        name: 'createOutline',
        description: 'Create article outline',
        temperature: 0.7
      });
    }
    
    buildPrompt({ topic, audience, tone, keywords, wordCount, research }) {
      return `
Based on this research:
${research}

Create an outline for an article on:
Title: ${topic}
Audience: ${audience}
Tone: ${tone}
Keywords: ${keywords.join(', ')}
Word count: ${wordCount}

Create a comprehensive outline with engaging title, 3-5 main sections with headings, key points for each section, and a conclusion.
JSON format: {"title": "Final title", "sections": [{"heading": "Section heading", "keyPoints": ["Key point 1"]}]}`;
    }
    
    processResponse(response) {
      try {
        return { outline: JSON.parse(response) };
      } catch (e) {
        console.warn(chalk.yellow('Failed to parse outline JSON. Using fallback parsing.'));
        // Fallback parsing logic would go here
        return { 
          outline: { 
            title: topic,
            sections: [{ heading: 'Introduction', keyPoints: ['Overview of topic'] }]
          }
        };
      }
    }
  }();
  
  const { outline } = await outlineTool.call(state);
  return { ...state, outline };
})
.next(async (state) => {
  console.log(chalk.magenta('🔍 Checking outline for SEO quality...'));
  
  const outlineText = `Title: ${state.outline.title}\n\n` + 
    state.outline.sections.map(s => 
      `# ${s.heading}\n${s.keyPoints.map(p => `- ${p}`).join('\n')}`
    ).join('\n\n');
  
  const seoCheck = await seoQualityTool.call({
    content: outlineText,
    keywords: state.keywords,
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
    outlineSEOAnalysis: seoCheck.analysis
  };
})
.next(async (state) => {
  console.log(chalk.magenta('✍️ Checking outline for copywriting quality...'));
  
  const outlineText = `Title: ${state.outline.title}\n\n` + 
    state.outline.sections.map(s => 
      `# ${s.heading}\n${s.keyPoints.map(p => `- ${p}`).join('\n')}`
    ).join('\n\n');
  
  const copyCheck = await copywritingQualityTool.call({
    content: outlineText,
    audience: state.audience,
    tone: state.tone,
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
    outlineCopyAnalysis: copyCheck.analysis
  };
})
.next(async (state) => {
  console.log(chalk.green('📝 Writing article...'));
  
  const articleTool = new class extends LLMTool {
    constructor() {
      super({
        name: 'writeArticle',
        description: 'Write full article'
      });
    }
    
    buildPrompt({ outline, research, audience, tone, keywords, wordCount }) {
      const outlineText = outline.sections.map(s => 
        `# ${s.heading}\n${s.keyPoints.map(p => `- ${p}`).join('\n')}`
      ).join('\n\n');
      
      return `
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
    }
  }();
  
  if (isTestMode) return { ...state, article: 'Test article content' };
  
  const { response } = await articleTool.call({
    ...state,
    model: state.model,
    temperature: state.temperature
  });
  
  return { ...state, article: response };
})
.next(async (state) => {
  console.log(chalk.magenta('✍️ Checking content for copywriting quality...'));
  
  const copyCheck = await copywritingQualityTool.call({
    content: state.article,
    audience: state.audience,
    tone: state.tone,
    type: 'content'
  });
  
  return { 
    ...state, 
    article: copyCheck.score < 7 ? copyCheck.optimizedContent : state.article,
    contentCopyScore: copyCheck.score,
    contentCopyAnalysis: copyCheck.analysis
  };
})
.next(async (state) => {
  console.log(chalk.magenta('🔍 Checking content for SEO quality...'));
  
  const seoCheck = await seoQualityTool.call({
    content: state.article,
    keywords: state.keywords,
    type: 'content'
  });
  
  return { 
    ...state, 
    article: seoCheck.score < 7 ? seoCheck.optimizedContent : state.article,
    contentSEOScore: seoCheck.score,
    contentSEOAnalysis: seoCheck.analysis
  };
})
.next(async (state) => {
  console.log(chalk.green('💾 Saving article...'));
  
  const saveResult = await saveToDiskTool.call({
    content: state.article,
    metadata: {
      title: state.outline.title || state.title,
      topic: state.topic,
      audience: state.audience,
      keywords: state.keywords,
      seoScore: state.contentSEOScore,
      copywritingScore: state.contentCopyScore
    }
  });
  
  console.log(chalk.bold.green(`✅ Article saved to: ${saveResult.filePath}`));
  console.log(chalk.bold.yellow(`📊 SEO Score: ${state.contentSEOScore}/10`));
  console.log(chalk.bold.yellow(`📊 Copywriting Score: ${state.contentCopyScore}/10`));
  
  return { 
    ...state, 
    filePath: saveResult.filePath, 
    success: true 
  };
});

// Export the main function with a terse implementation
export const generateArticle = async (articleDetails) => {
  try {
    return await articleWriterFlow.run(articleDetails);
  } catch (error) {
    console.error(chalk.bold.red(`❌ Error: ${error.message}`));
    throw error;
  }
};
