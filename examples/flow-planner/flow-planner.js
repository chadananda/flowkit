/**
 * flow-planner.js - Demonstrates Flowkit's plan method for workflow generation
 * 
 * This example shows how to use the plan method to generate a workflow based on 
 * available tools and a natural language description of the goal.
 */

import { Flow, registerTool } from '../../flowkit.js';
import { callLLM, promptTemplate, jsonParser } from '../../tools.js';
import { createMemoryStore } from '../../memory.js';
import fs from 'fs/promises';
import path from 'path';

// Register a set of tools that could be used in various workflows
const fetchWebPage = registerTool(
  async (url) => {
    console.log(`📥 Fetching webpage: ${url}`);
    // Simulate fetching a webpage
    return `<html><body><h1>Content from ${url}</h1><p>This is simulated webpage content.</p></body></html>`;
  },
  {
    name: 'fetchWebPage',
    description: 'Fetch content from a URL',
    parameters: ['url']
  }
);

const extractText = registerTool(
  (html) => {
    console.log('📄 Extracting text from HTML');
    // Simulate extracting text from HTML
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  },
  {
    name: 'extractText',
    description: 'Extract plain text from HTML content',
    parameters: ['html']
  }
);

const summarizeText = registerTool(
  async (text, maxLength = 200) => {
    console.log(`📝 Summarizing text (max length: ${maxLength})`);
    
    // Import callLLM dynamically
    const { callLLM } = await import('../../tools.js');
    
    const prompt = `Summarize the following text in ${maxLength} characters or less:

${text}

Summary:`;
    
    return await callLLM({ prompt, temperature: 0.3 });
  },
  {
    name: 'summarizeText',
    description: 'Create a concise summary of text',
    parameters: ['text', 'maxLength?']
  }
);

const translateText = registerTool(
  async (text, targetLanguage = 'Spanish') => {
    console.log(`🌐 Translating text to ${targetLanguage}`);
    
    // Import callLLM dynamically
    const { callLLM } = await import('../../tools.js');
    
    const prompt = `Translate the following text to ${targetLanguage}:

${text}

Translation:`;
    
    return await callLLM({ prompt, temperature: 0.3 });
  },
  {
    name: 'translateText',
    description: 'Translate text to another language',
    parameters: ['text', 'targetLanguage?']
  }
);

const saveToFile = registerTool(
  async (content, filePath) => {
    console.log(`💾 Saving content to ${filePath}`);
    
    try {
      // Ensure the directory exists
      const directory = path.dirname(filePath);
      await fs.mkdir(directory, { recursive: true });
      
      // Write the content to the file
      await fs.writeFile(filePath, content);
      return { success: true, filePath };
    } catch (error) {
      console.error(`Error saving file: ${error.message}`);
      return { success: false, error: error.message };
    }
  },
  {
    name: 'saveToFile',
    description: 'Save content to a file',
    parameters: ['content', 'filePath']
  }
);

const analyzeKeywords = registerTool(
  async (text) => {
    console.log('🔑 Analyzing keywords in text');
    
    // Import callLLM dynamically
    const { callLLM } = await import('../../tools.js');
    
    const prompt = `Extract the 5-10 most important keywords or phrases from the following text:

${text}

Format the keywords as a comma-separated list:`;
    
    const response = await callLLM({ prompt, temperature: 0.3 });
    return response.split(',').map(keyword => keyword.trim());
  },
  {
    name: 'analyzeKeywords',
    description: 'Extract important keywords from text',
    parameters: ['text']
  }
);

// Example 1: Generate a plan for a web content summarizer
const planWebContentSummarizer = async () => {
  console.log('\n🚀 EXAMPLE 1: Web Content Summarizer\n');
  
  // Create a flow with the available tools
  const flow = Flow.start()
    .tools([
      fetchWebPage,
      extractText,
      summarizeText,
      saveToFile
    ])
    .plan(
      "Create a workflow that fetches content from a URL, extracts the text, " +
      "summarizes it, and saves the summary to a file. The workflow should " +
      "take a URL and output file path as input."
    );
  
  // Run the flow to generate the plan
  await flow.run({});
  
  console.log('\nThe plan above shows how to implement a web content summarizer using Flowkit.\n');
};

// Example 2: Generate a plan for a content translator
const planContentTranslator = async () => {
  console.log('\n🚀 EXAMPLE 2: Content Translator\n');
  
  // Create a flow with the available tools
  const flow = Flow.start()
    .tools([
      fetchWebPage,
      extractText,
      translateText,
      saveToFile
    ])
    .plan(
      "Create a workflow that fetches content from a URL, extracts the text, " +
      "translates it to a specified language, and saves both the original and " +
      "translated text to separate files. The workflow should take a URL, " +
      "target language, and output directory as input."
    );
  
  // Run the flow to generate the plan
  await flow.run({});
  
  console.log('\nThe plan above shows how to implement a content translator using Flowkit.\n');
};

// Example 3: Generate a plan for a keyword analyzer with conditional branching
const planKeywordAnalyzer = async () => {
  console.log('\n🚀 EXAMPLE 3: Keyword Analyzer with Conditional Branching\n');
  
  // Create a flow with the available tools
  const flow = Flow.start()
    .tools([
      fetchWebPage,
      extractText,
      analyzeKeywords,
      summarizeText,
      saveToFile
    ])
    .plan(
      "Create a workflow that fetches content from a URL, extracts the text, " +
      "analyzes the keywords, and then makes a decision: if there are more than " +
      "5 keywords, create a detailed summary; otherwise, create a brief summary. " +
      "Save both the keywords and the summary to files. The workflow should take " +
      "a URL and output directory as input."
    );
  
  // Run the flow to generate the plan
  await flow.run({});
  
  console.log('\nThe plan above shows how to implement a keyword analyzer with conditional branching using Flowkit.\n');
};

// Run all the examples
const runAllExamples = async () => {
  try {
    await planWebContentSummarizer();
    await planContentTranslator();
    await planKeywordAnalyzer();
    
    console.log('✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
};

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export { 
  planWebContentSummarizer, 
  planContentTranslator, 
  planKeywordAnalyzer 
};
