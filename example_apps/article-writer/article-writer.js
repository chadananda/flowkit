/**
 * article-writer.js - Terse core implementation for generating articles using Flowkit
 */
import { Flow, registerTool } from '../../flowkit.js';
import { callLLM, promptTemplate, jsonParser } from '../../tools.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import chalk from 'chalk';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, 'articles');
export const isTestMode = process.env.NODE_ENV === 'test';

// Register tools with terse implementations
const researchWithPerplexity = registerTool(async (topic, keywords = []) => {
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
    return callLLM({ 
      prompt: `Research the topic "${topic}" with keywords: ${keywords.join(', ')}. Provide 3-5 main points.`,
      temperature: 0.3 
    });
  }
});

const checkSEOQuality = registerTool(async (content, keywords = [], type = 'outline') => {
  if (isTestMode) return {
    score: 8,
    analysis: 'Test SEO analysis',
    improvements: ['Test improvement'],
    [`optimized${type.charAt(0).toUpperCase() + type.slice(1)}`]: content
  };
  const prompt = `
You are an SEO expert. Analyze this ${type} for SEO quality:

${content}

Target keywords: ${keywords.join(', ')}

Evaluate: keyword usage, structure, search visibility, content depth.
Score from 1-10 and provide improvements.
JSON format: {"score": 7, "analysis": "Brief analysis", "improvements": ["Improvement 1"], "optimized${type.charAt(0).toUpperCase() + type.slice(1)}": "Improved version"}`;
  return callLLM({ 
    prompt, 
    temperature: 0.3, 
    schema: { 
      score: 'number', 
      analysis: 'string', 
      improvements: 'array', 
      [`optimized${type.charAt(0).toUpperCase() + type.slice(1)}`]: 'string' 
    } 
  });
});

const checkCopywritingQuality = registerTool(async (content, audience, tone, type = 'outline') => {
  if (isTestMode) return {
    score: 9,
    analysis: 'Test copywriting analysis',
    improvements: ['Test improvement'],
    [`optimized${type.charAt(0).toUpperCase() + type.slice(1)}`]: content
  };
  const prompt = `
You are an expert copywriter. Analyze this ${type}:

${content}

Target audience: ${audience}
Desired tone: ${tone}

Evaluate: engagement, readability, tone consistency, persuasiveness, impact.
Score from 1-10 and provide improvements.
JSON format: {"score": 7, "analysis": "Brief analysis", "improvements": ["Improvement 1"], "optimized${type.charAt(0).toUpperCase() + type.slice(1)}": "Improved version"}`;
  return callLLM({ 
    prompt, 
    temperature: 0.3, 
    schema: { 
      score: 'number', 
      analysis: 'string', 
      improvements: 'array', 
      [`optimized${type.charAt(0).toUpperCase() + type.slice(1)}`]: 'string' 
    } 
  });
});

const saveToDisk = registerTool(async (content, metadata) => {
  if (isTestMode) return { filePath: '/test/path/test-article.md' };
  await fs.mkdir(outputDir, { recursive: true });
  const filename = `${metadata.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
  const filePath = path.join(outputDir, filename);
  const frontMatter = [
    '---',
    `title: "${metadata.title}"`,
    `date: "${new Date().toISOString()}"`,
    `keywords: [${metadata.keywords.map(k => `"${k}"`).join(', ')}]`,
    `topic: "${metadata.topic}"`,
    `audience: "${metadata.audience}"`,
    `seoScore: ${metadata.seoScore}`,
    `copywritingScore: ${metadata.copywritingScore}`,
    '---',
    '',
    content
  ].join('\n');
  await fs.writeFile(filePath, frontMatter, 'utf8');
  return { filePath };
});

// Flow nodes with terse implementations
const analyzeRequest = state => ({
  title: state.title,
  topic: state.topic || state.title,
  audience: state.audience || 'General readers',
  keywords: state.keywords || [],
  tone: state.tone || 'Informative',
  wordCount: state.wordCount || 800,
  model: process.env.DEFAULT_MODEL || 'gpt-4',
  temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7')
});

const performResearch = async state => {
  console.log(chalk.blue('🔍 Researching topic...'));
  return { ...state, research: await researchWithPerplexity(state.topic, state.keywords) };
};

const createOutline = async state => {
  console.log(chalk.blue('📋 Creating outline...'));
  if (isTestMode) return {
    ...state,
    outline: {
      title: 'Test Outline Title',
      sections: [
        { heading: 'Test Section 1', keyPoints: ['Test point 1', 'Test point 2'] },
        { heading: 'Test Section 2', keyPoints: ['Test point 3', 'Test point 4'] }
      ]
    }
  };
  const prompt = promptTemplate(`
Create a detailed outline based on this research:

RESEARCH:
{{research}}

ARTICLE PARAMETERS:
Title: {{title}}
Topic: {{topic}}
Audience: {{audience}}
Tone: {{tone}}
Keywords: {{keywords}}
Word count: {{wordCount}}

Create a comprehensive outline with engaging title, 3-5 main sections with headings, key points for each section, and a conclusion.
JSON format: {"title": "Final title", "sections": [{"heading": "Section heading", "keyPoints": ["Key point 1"]}]}`, 
  { ...state, keywords: state.keywords.join(', ') });
  return { 
    ...state, 
    outline: await callLLM({ 
      prompt, 
      model: state.model,
      temperature: state.temperature,
      schema: { title: 'string', sections: 'array' } 
    })
  };
};

const checkOutlineSEO = async state => {
  console.log(chalk.magenta('🔍 Checking outline for SEO quality...'));
  const outlineText = `Title: ${state.outline.title}\n\n` + 
    state.outline.sections.map(s => 
      `# ${s.heading}\n${s.keyPoints.map(p => `- ${p}`).join('\n')}`
    ).join('\n\n');
  const seoCheck = await checkSEOQuality(outlineText, state.keywords, 'outline');
  const updatedOutline = seoCheck.score < 7 ? jsonParser(seoCheck.optimizedOutline) || state.outline : state.outline;
  return { 
    ...state, 
    outline: updatedOutline,
    outlineSEOScore: seoCheck.score,
    outlineSEOAnalysis: seoCheck.analysis
  };
};

const checkOutlineCopywriting = async state => {
  console.log(chalk.magenta('✍️ Checking outline for copywriting quality...'));
  const outlineText = `Title: ${state.outline.title}\n\n` + 
    state.outline.sections.map(s => 
      `# ${s.heading}\n${s.keyPoints.map(p => `- ${p}`).join('\n')}`
    ).join('\n\n');
  const copyCheck = await checkCopywritingQuality(outlineText, state.audience, state.tone, 'outline');
  const updatedOutline = copyCheck.score < 7 ? jsonParser(copyCheck.optimizedOutline) || state.outline : state.outline;
  return { 
    ...state, 
    outline: updatedOutline,
    outlineCopyScore: copyCheck.score,
    outlineCopyAnalysis: copyCheck.analysis
  };
};

const writeArticle = async state => {
  console.log(chalk.green('📝 Writing article...'));
  if (isTestMode) return { ...state, article: 'Test article content' };
  const outlineText = state.outline.sections.map(s => 
    `# ${s.heading}\n${s.keyPoints.map(p => `- ${p}`).join('\n')}`
  ).join('\n\n');
  const prompt = `
Write a ${state.wordCount}-word article based on this research and outline:

RESEARCH:
${state.research}

OUTLINE:
Title: ${state.outline.title}
${outlineText}

REQUIREMENTS:
- Target audience: ${state.audience}
- Tone: ${state.tone}
- Include keywords naturally: ${state.keywords.join(', ')}
- Format in Markdown with proper headings
- Create engaging introduction and strong conclusion
- Approximately ${state.wordCount} words`;
  return { 
    ...state, 
    article: await callLLM({ 
      prompt, 
      model: state.model,
      temperature: state.temperature 
    })
  };
};

const checkContentCopywriting = async state => {
  console.log(chalk.magenta('✍️ Checking content for copywriting quality...'));
  const copyCheck = await checkCopywritingQuality(state.article, state.audience, state.tone, 'content');
  return { 
    ...state, 
    article: copyCheck.score < 7 ? copyCheck.optimizedContent : state.article,
    contentCopyScore: copyCheck.score,
    contentCopyAnalysis: copyCheck.analysis
  };
};

const checkContentSEO = async state => {
  console.log(chalk.magenta('🔍 Checking content for SEO quality...'));
  const seoCheck = await checkSEOQuality(state.article, state.keywords, 'content');
  return { 
    ...state, 
    article: seoCheck.score < 7 ? seoCheck.optimizedContent : state.article,
    contentSEOScore: seoCheck.score,
    contentSEOAnalysis: seoCheck.analysis
  };
};

const finalizeArticle = async state => {
  console.log(chalk.green('💾 Saving article...'));
  const saveResult = await saveToDisk(state.article, {
    title: state.outline.title || state.title,
    topic: state.topic,
    audience: state.audience,
    keywords: state.keywords,
    seoScore: state.contentSEOScore,
    copywritingScore: state.contentCopyScore
  });
  console.log(chalk.bold.green(`✅ Article saved to: ${saveResult.filePath}`));
  console.log(chalk.bold.yellow(`📊 SEO Score: ${state.contentSEOScore}/10`));
  console.log(chalk.bold.yellow(`📊 Copywriting Score: ${state.contentCopyScore}/10`));
  return { ...state, filePath: saveResult.filePath, success: true };
};

// Export the main function with a terse implementation
export const generateArticle = async articleDetails => {
  try {
    return await Flow.start(analyzeRequest)
      .next(performResearch)
      .next(createOutline)
      .next(checkOutlineSEO)
      .next(checkOutlineCopywriting)
      .next(writeArticle)
      .next(checkContentCopywriting)
      .next(checkContentSEO)
      .next(finalizeArticle)
      .run(articleDetails);
  } catch (error) {
    console.error(chalk.bold.red(`❌ Error: ${error.message}`));
    throw error;
  }
};
