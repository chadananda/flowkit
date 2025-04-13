/**
 * Flowlite Tools - A collection of useful tools and utilities for AI agent flows
 * Consolidates memory management, LLM integration, and data processing
 */

import { LogLevel, ParamType, param, goto, apiKey } from './constants.js';

// ======== Base Tool Classes ========

/**
 * Base Tool class - all tools inherit from this
 */
export class Tool {
  constructor(metadata = {}) {
    this.metadata = {
      name: metadata.name || 'unnamed_tool',
      description: metadata.description || 'No description provided',
      input: metadata.input || [],
      output: metadata.output || [],
      examples: metadata.examples || [],
      apiKeys: metadata.apiKeys || [],
      tags: metadata.tags || []
    };
    this.stats = { calls: 0, errors: 0, totalTime: 0 };
    this.logLevel = metadata.logLevel || LogLevel.INFO;
    this.logger = metadata.logger || console;
    this.startTime = 0;
    
    // Properties for chaining
    this.nextTools = [];
    this.branchConfig = null;
    this.switchConfig = null;
    this.errorHandler = null;
    this.toolId = `tool_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Chainable configuration methods
  setLogLevel = (level) => { this.logLevel = level; return this; };
  setLogger = (logger) => { this.logger = logger; return this; };
  withApiKey = (name, description, required = true) => { 
    this.metadata.apiKeys.push(apiKey(name, description, required)); 
    return this; 
  };
  withExample = (input, output) => { 
    this.metadata.examples.push({ input, output }); 
    return this; 
  };
  withTag = (tag) => { 
    this.metadata.tags.push(tag); 
    return this; 
  };

  // Logging methods
  log = (message, ...args) => this.logger.log(message, ...args);
  error = (message, ...args) => this.logLevel >= LogLevel.ERROR && this.logger.error(message, ...args);
  warn = (message, ...args) => this.logLevel >= LogLevel.WARN && this.logger.warn(message, ...args);
  info = (message, ...args) => this.logLevel >= LogLevel.INFO && this.logger.info(message, ...args);
  debug = (message, ...args) => this.logLevel >= LogLevel.DEBUG && this.logger.debug(message, ...args);
  trace = (message, ...args) => this.logLevel >= LogLevel.TRACE && this.logger.trace(message, ...args);

  // Statistics methods
  getStats = () => ({ 
    ...this.stats, 
    avgTime: this.stats.calls ? this.stats.totalTime / this.stats.calls : 0,
    errorRate: this.stats.calls ? this.stats.errors / this.stats.calls : 0
  });
  resetStats = () => { this.stats = { calls: 0, errors: 0, totalTime: 0 }; return this; };

  // Core execution method - must be implemented by subclasses
  async execute(input) { throw new Error('Tool.execute() must be implemented by subclass'); }

  // Chaining methods
  /**
   * Chain this tool with another tool or function
   * @param {Tool|Function} nextTool - The next tool or function to execute
   * @param {Object} options - Options for the chaining
   * @returns {Tool} - Returns this tool for chaining
   */
  then(nextTool, options = {}) {
    // If nextTool is a function, convert it to a Tool
    if (typeof nextTool === 'function' && !(nextTool instanceof Tool)) {
      const wrappedTool = new Tool({
        name: nextTool.name || 'anonymous_function',
        description: 'Function wrapped as a tool'
      });
      wrappedTool.execute = async (input) => await nextTool(input);
      nextTool = wrappedTool;
    }
    
    this.nextTools.push({ tool: nextTool, options });
    return this;
  }
  
  /**
   * Add an error handler to the chain
   * @param {Function} handler - Error handler function
   * @returns {Tool} - Returns this tool for chaining
   */
  catch(handler) {
    this.errorHandler = handler;
    return this;
  }
  
  /**
   * Add conditional branching to the chain
   * @param {Function} condition - Function that returns true or false
   * @param {Tool|Function} truePath - Tool or function to execute if condition is true
   * @param {Tool|Function} falsePath - Tool or function to execute if condition is false
   * @returns {Tool} - Returns this tool for chaining
   */
  branch(condition, truePath, falsePath) {
    this.branchConfig = { condition, truePath, falsePath };
    return this;
  }
  
  /**
   * Add switch-case branching to the chain
   * @param {Function|String} keySelector - Function or property name to select the key
   * @param {Object} cases - Map of key values to tools or functions
   * @param {Tool|Function} defaultCase - Default tool or function if no case matches
   * @returns {Tool} - Returns this tool for chaining
   */
  switch(keySelector, cases, defaultCase = null) {
    this.switchConfig = { keySelector, cases, defaultCase };
    return this;
  }
  
  /**
   * Jump to a named segment in the flow
   * @param {String} segmentId - ID of the segment to jump to
   * @returns {Tool} - Returns a special goto instruction
   */
  goto(segmentId) {
    return { _goto: segmentId };
  }
  
  /**
   * Conditionally jump to a named segment
   * @param {Function} condition - Function that returns true or false
   * @param {String} segmentId - ID of the segment to jump to if condition is true
   * @returns {Tool} - Returns this tool for chaining
   */
  gotoIf(condition, segmentId) {
    this.branchConfig = { 
      condition, 
      truePath: { _goto: segmentId },
      falsePath: null
    };
    return this;
  }

  // Call method - handles statistics and logging
  async call(input) {
    this.stats.calls++;
    this.startTime = performance.now();
    
    try {
      this.debug(`[${this.metadata.name}] Executing with input:`, input);
      let result = await this.execute(input);
      const duration = performance.now() - this.startTime;
      this.stats.totalTime += duration;
      this.debug(`[${this.metadata.name}] Completed in ${duration.toFixed(2)}ms`);
      
      // Handle goto instruction
      if (result && typeof result === 'object' && result._goto) {
        return result; // Pass the goto instruction up the chain
      }
      
      // Handle branching if configured
      if (this.branchConfig) {
        const { condition, truePath, falsePath } = this.branchConfig;
        const conditionResult = typeof condition === 'function' 
          ? await condition(result) 
          : !!result[condition];
        
        if (conditionResult && truePath) {
          if (typeof truePath === 'object' && truePath._goto) {
            return truePath; // Return goto instruction
          }
          
          const nextTool = typeof truePath === 'function' && !(truePath instanceof Tool)
            ? new Tool({ name: 'branch_true' }).withExecute(truePath)
            : truePath;
            
          result = await nextTool.call(typeof result === 'object' ? { ...input, ...result } : result);
        } else if (!conditionResult && falsePath) {
          if (typeof falsePath === 'object' && falsePath._goto) {
            return falsePath; // Return goto instruction
          }
          
          const nextTool = typeof falsePath === 'function' && !(falsePath instanceof Tool)
            ? new Tool({ name: 'branch_false' }).withExecute(falsePath)
            : falsePath;
            
          result = await nextTool.call(typeof result === 'object' ? { ...input, ...result } : result);
        }
      }
      
      // Handle switch if configured
      if (this.switchConfig) {
        const { keySelector, cases, defaultCase } = this.switchConfig;
        const key = typeof keySelector === 'function'
          ? await keySelector(result)
          : result[keySelector];
          
        if (key in cases) {
          const caseTool = cases[key];
          
          if (typeof caseTool === 'object' && caseTool._goto) {
            return caseTool; // Return goto instruction
          }
          
          const nextTool = typeof caseTool === 'function' && !(caseTool instanceof Tool)
            ? new Tool({ name: `case_${key}` }).withExecute(caseTool)
            : caseTool;
            
          result = await nextTool.call(typeof result === 'object' ? { ...input, ...result } : result);
        } else if (defaultCase) {
          if (typeof defaultCase === 'object' && defaultCase._goto) {
            return defaultCase; // Return goto instruction
          }
          
          const nextTool = typeof defaultCase === 'function' && !(defaultCase instanceof Tool)
            ? new Tool({ name: 'default_case' }).withExecute(defaultCase)
            : defaultCase;
            
          result = await nextTool.call(typeof result === 'object' ? { ...input, ...result } : result);
        }
      }
      
      // Handle chaining if there are next tools
      if (this.nextTools.length > 0) {
        // Process the chain
        for (const { tool, options } of this.nextTools) {
          // Update state with result if it's an object
          const nextInput = typeof result === 'object' && result !== null 
            ? { ...input, ...result }
            : result;
          
          result = await tool.call(nextInput);
          
          // If result is a goto instruction, break the chain and return it
          if (result && typeof result === 'object' && result._goto) {
            break;
          }
        }
      }
      
      return result;
    } catch (error) {
      this.stats.errors++;
      this.error(`[${this.metadata.name}] Error:`, error);
      
      // Handle error with error handler if available
      if (this.errorHandler) {
        try {
          return await this.errorHandler(error, input);
        } catch (handlerError) {
          this.error(`[${this.metadata.name}] Error handler failed:`, handlerError);
          throw handlerError;
        }
      }
      
      throw error;
    }
  }

  // Helper method to set execute function
  withExecute(fn) {
    this.execute = fn;
    return this;
  }

  // Convert tool to a function with metadata
  asFunction() {
    const fn = async input => await this.call(input);
    fn.metadata = this.metadata;
    return fn;
  }
}

/**
 * FlowRegistry - Manages named segments and tools for complex flows
 */
export class FlowRegistry {
  constructor() {
    this.segments = new Map();
    this.tools = new Map();
  }
  
  /**
   * Register a tool with the registry
   * @param {Tool} tool - The tool to register
   * @param {String} segmentId - Optional segment ID
   * @returns {Tool} - Returns the registered tool
   */
  register(tool, segmentId = null) {
    if (!(tool instanceof Tool)) {
      throw new Error('Only Tool instances can be registered');
    }
    
    this.tools.set(tool.toolId, tool);
    
    if (segmentId) {
      this.segments.set(segmentId, tool);
    }
    
    return tool;
  }
  
  /**
   * Get a tool by its ID
   * @param {String} toolId - ID of the tool
   * @returns {Tool|null} - The tool or null if not found
   */
  getTool(toolId) {
    return this.tools.get(toolId) || null;
  }
  
  /**
   * Get a segment by its ID
   * @param {String} segmentId - ID of the segment
   * @returns {Tool|null} - The tool at the segment or null if not found
   */
  getSegment(segmentId) {
    return this.segments.get(segmentId) || null;
  }
  
  /**
   * Create a new segment in the registry
   * @param {String} segmentId - ID of the segment
   * @param {Tool} tool - The tool to register at this segment
   * @returns {Tool} - Returns the registered tool
   */
  createSegment(segmentId, tool) {
    if (this.segments.has(segmentId)) {
      throw new Error(`Segment with ID ${segmentId} already exists`);
    }
    
    return this.register(tool, segmentId);
  }
  
  /**
   * Execute a flow starting from a specific segment
   * @param {String} segmentId - ID of the segment to start from
   * @param {Object} input - Input state for the flow
   * @returns {Promise<Object>} - Result of the flow execution
   */
  async execute(segmentId, input = {}) {
    const startTool = this.getSegment(segmentId);
    
    if (!startTool) {
      throw new Error(`Segment with ID ${segmentId} not found`);
    }
    
    let currentTool = startTool;
    let currentInput = input;
    let result;
    
    while (currentTool) {
      result = await currentTool.call(currentInput);
      
      // Handle goto instructions
      if (result && typeof result === 'object' && result._goto) {
        const nextTool = this.getSegment(result._goto);
        
        if (!nextTool) {
          throw new Error(`Segment with ID ${result._goto} not found`);
        }
        
        currentTool = nextTool;
        currentInput = typeof result === 'object' ? { ...input, ...result } : result;
        delete currentInput._goto; // Remove the goto instruction
      } else {
        // No more jumps, we're done
        break;
      }
    }
    
    return result;
  }
}

// Create a global registry instance
export const flowRegistry = new FlowRegistry();

/**
 * API Tool class - specialized for external API calls
 */
export class APITool extends Tool {
  constructor(metadata = {}) {
    super(metadata);
    this.retries = metadata.retries || 1;
    this.retryDelay = metadata.retryDelay || 1000;
  }

  async execute(input) {
    // Implementation would go here
    throw new Error('APITool.execute() must be implemented by subclass');
  }
}

// ======== Memory Management ========

/**
 * Memory Tool - Store and retrieve values from memory
 */
export class MemoryTool extends Tool {
  constructor(options = {}) {
    super({
      name: 'memory',
      description: 'Store and retrieve values from memory',
      input: [
        param('input', ParamType.STRING, 'Key string or object with key, value, and action')
      ],
      output: [
        param('result', ParamType.OBJECT, 'The stored value or operation result')
      ],
      ...options
    });
    this.store = new Map();
  }
  
  async execute(input) {
    const { key, value, action = 'get' } = typeof input === 'string' ? { key: input } : input;
    
    switch (action) {
      case 'get':
        const storedValue = this.store.get(key);
        return storedValue !== undefined ? JSON.parse(JSON.stringify(storedValue)) : undefined;
      
      case 'set':
        this.store.set(key, JSON.parse(JSON.stringify(value)));
        return true;
      
      case 'delete':
        return this.store.delete(key);
      
      case 'clear':
        this.store.clear();
        return true;
      
      case 'keys':
        return Array.from(this.store.keys());
      
      case 'all':
        return Object.fromEntries(Array.from(this.store.entries()).map(
          ([k, v]) => [k, JSON.parse(JSON.stringify(v))]
        ));
      
      default:
        throw new Error(`Unknown memory action: ${action}`);
    }
  }
}

/**
 * Creates a memory store instance
 */
export const createMemoryStore = () => new MemoryTool();

// ======== LLM Integration ========

/**
 * LLM Tool - Enhanced tool for LLM interactions with structured output parsing and validation
 */
export class LLMTool extends Tool {
  constructor(options = {}) {
    super({
      name: 'llm',
      description: 'Call an LLM with structured output parsing and validation',
      apiKeys: [...(options.apiKeys || []), apiKey('OPENAI_API_KEY', 'OpenAI API Key')],
      ...options
    });
    
    // Default model settings
    this.defaultModel = options.defaultModel || 'gpt-4';
    this.defaultTemperature = options.defaultTemperature || 0.7;
    this.defaultMaxTokens = options.defaultMaxTokens || 1000;
    this.defaultProvider = options.defaultProvider || 'openai';
    
    // Retry and throttling settings
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000; // Base delay in ms
    this.maxRetryDelay = options.maxRetryDelay || 30000; // Max delay (30s)
    this.useExponentialBackoff = options.useExponentialBackoff !== false; // Default true
    
    // Rate limiting
    this.rateLimit = options.rateLimit || {
      openai: { tokensPerMinute: 10000, requestsPerMinute: 60 },
      anthropic: { tokensPerMinute: 10000, requestsPerMinute: 60 },
      mistral: { tokensPerMinute: 10000, requestsPerMinute: 60 }
    };
    
    // Request tracking for rate limiting
    this.requestLog = {
      openai: { requests: [], tokens: [] },
      anthropic: { requests: [], tokens: [] },
      mistral: { requests: [], tokens: [] }
    };
    
    // Response validation
    this.defaultValidation = {
      validateJSON: options.validateJSON !== false, // Default true
      validateSchema: options.validateSchema !== false, // Default true
      allowPartialJSON: options.allowPartialJSON || false, // Default false
      repairJSON: options.repairJSON || false // Default false
    };
  }
  
  async execute(input) {
    // Handle string input as prompt
    const {
      // Basic LLM parameters
      prompt, 
      model = this.defaultModel, 
      temperature = this.defaultTemperature, 
      maxTokens = this.defaultMaxTokens,
      provider = this.defaultProvider,
      
      // Output format and validation
      format = null, // Can be 'json', 'text', or a JSON schema
      validateJSON = this.defaultValidation.validateJSON,
      validateSchema = this.defaultValidation.validateSchema,
      allowPartialJSON = this.defaultValidation.allowPartialJSON,
      repairJSON = this.defaultValidation.repairJSON,
      
      // Custom validation function
      validate = null,
      
      // Retry settings
      retries = this.retries,
      retryCondition = null, // Custom function to determine if retry is needed
      
      // Additional provider-specific options
      options = {}
    } = typeof input === 'string' ? { prompt: input } : input;
    
    // Validate API keys based on provider
    this.validateApiKeys(provider);
    
    // Check rate limits and wait if necessary
    await this.checkRateLimits(provider);
    
    let attempt = 0;
    let error = null;
    let lastResponse = null;
    
    while (attempt < retries) {
      try {
        this.debug(`[${provider}] Calling LLM API (attempt ${attempt + 1}/${retries})`);
        
        // Call the appropriate LLM API based on provider
        const response = await this.callLLMAPI(prompt, model, temperature, maxTokens, provider, options);
        lastResponse = response;
        
        // Process the response based on requested format
        let result;
        
        if (format === 'json' || (format && typeof format === 'object')) {
          // Parse and validate JSON
          result = this.parseStructuredOutput(response, format, {
            validateJSON,
            validateSchema,
            allowPartialJSON,
            repairJSON
          });
        } else {
          // Return raw text
          result = response;
        }
        
        // Run custom validation if provided
        if (validate && !validate(result)) {
          throw new Error('Custom validation failed');
        }
        
        // Log the successful request for rate limiting
        this.logRequest(provider, prompt.length, response.length);
        
        return result;
      } catch (err) {
        error = err;
        attempt++;
        
        // Check if we should retry based on the error and custom condition
        const shouldRetry = this.shouldRetry(err, attempt, retries, retryCondition, lastResponse);
        
        if (shouldRetry && attempt < retries) {
          const delay = this.calculateRetryDelay(attempt);
          this.warn(`LLM call failed, retrying in ${delay}ms (${attempt}/${retries}): ${err.message}`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          break;
        }
      }
    }
    
    throw new Error(`LLM call failed after ${attempt} attempts: ${error?.message}`);
  }
  
  validateApiKeys(provider) {
    switch (provider.toLowerCase()) {
      case 'openai':
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY environment variable is required');
        }
        break;
      case 'anthropic':
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error('ANTHROPIC_API_KEY environment variable is required');
        }
        break;
      case 'mistral':
        if (!process.env.MISTRAL_API_KEY) {
          throw new Error('MISTRAL_API_KEY environment variable is required');
        }
        break;
      // Add more providers as needed
    }
  }
  
  shouldRetry(error, attempt, maxRetries, retryCondition, lastResponse) {
    // Don't retry if we've reached max attempts
    if (attempt >= maxRetries) return false;
    
    // Check custom retry condition if provided
    if (retryCondition && typeof retryCondition === 'function') {
      return retryCondition(error, attempt, lastResponse);
    }
    
    // Default retry logic based on error type
    const errorMessage = error.message.toLowerCase();
    
    // Retry on rate limit errors
    if (errorMessage.includes('rate limit') || 
        errorMessage.includes('too many requests') ||
        error.status === 429) {
      return true;
    }
    
    // Retry on timeout or network errors
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('network') ||
        errorMessage.includes('econnrefused') ||
        errorMessage.includes('econnreset')) {
      return true;
    }
    
    // Retry on server errors (5xx)
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    return false;
  }
  
  calculateRetryDelay(attempt) {
    if (this.useExponentialBackoff) {
      // Exponential backoff with jitter
      const baseDelay = this.retryDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.3 * baseDelay; // 0-30% jitter
      return Math.min(baseDelay + jitter, this.maxRetryDelay);
    } else {
      // Linear backoff
      return Math.min(this.retryDelay * attempt, this.maxRetryDelay);
    }
  }
  
  async checkRateLimits(provider) {
    const providerLimits = this.rateLimit[provider.toLowerCase()];
    const providerLog = this.requestLog[provider.toLowerCase()];
    
    if (!providerLimits || !providerLog) return;
    
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean up old entries
    providerLog.requests = providerLog.requests.filter(time => time > oneMinuteAgo);
    providerLog.tokens = providerLog.tokens.filter(entry => entry.time > oneMinuteAgo);
    
    // Check request rate limit
    if (providerLog.requests.length >= providerLimits.requestsPerMinute) {
      const oldestRequest = providerLog.requests[0];
      const waitTime = 60000 - (now - oldestRequest);
      
      if (waitTime > 0) {
        this.warn(`Rate limit approaching for ${provider}. Waiting ${waitTime}ms before next request.`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Check token rate limit
    const recentTokens = providerLog.tokens.reduce((sum, entry) => sum + entry.count, 0);
    if (recentTokens >= providerLimits.tokensPerMinute) {
      const oldestTokenEntry = providerLog.tokens[0];
      const waitTime = 60000 - (now - oldestTokenEntry.time);
      
      if (waitTime > 0) {
        this.warn(`Token rate limit approaching for ${provider}. Waiting ${waitTime}ms before next request.`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  logRequest(provider, promptLength, responseLength) {
    const now = Date.now();
    const providerLog = this.requestLog[provider.toLowerCase()];
    
    if (!providerLog) return;
    
    // Log request time
    providerLog.requests.push(now);
    
    // Estimate token count (very rough approximation)
    const estimatedTokens = Math.ceil((promptLength + responseLength) / 4);
    providerLog.tokens.push({ time: now, count: estimatedTokens });
  }
  
  async callLLMAPI(prompt, model, temperature, maxTokens, provider, options = {}) {
    // This would be replaced with actual API call in production
    // For now, we'll simulate a response
    this.info(`Calling ${provider} API with model ${model}`);
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    
    // Simulate different provider responses
    switch (provider.toLowerCase()) {
      case 'openai':
        return `{"result": "This is a simulated OpenAI response", "details": {"model": "${model}", "prompt_tokens": 100, "completion_tokens": 50}}`;
      
      case 'anthropic':
        return `{"result": "This is a simulated Anthropic response", "details": {"model": "${model}"}}`;
      
      case 'mistral':
        return `{"result": "This is a simulated Mistral response", "details": {"model": "${model}"}}`;
      
      default:
        return `Response to: ${prompt}`;
    }
  }
  
  parseStructuredOutput(text, schema, options = {}) {
    const {
      validateJSON = true,
      validateSchema = true,
      allowPartialJSON = false,
      repairJSON = false
    } = options;
    
    try {
      // Extract JSON if it's embedded in other text
      let jsonStr = text;
      
      // Try to extract JSON from markdown code blocks or plain text
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                       text.match(/{[\s\S]*?}/);
      
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      // Parse the JSON
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        if (repairJSON) {
          // Attempt to repair common JSON issues
          const repaired = this.repairJSON(jsonStr);
          parsed = JSON.parse(repaired);
          this.warn('Repaired malformed JSON:', parseError.message);
        } else if (allowPartialJSON) {
          // Extract partial JSON if allowed
          parsed = this.extractPartialJSON(text);
          this.warn('Extracted partial JSON due to parse error:', parseError.message);
        } else {
          throw parseError;
        }
      }
      
      // Validate against schema if provided and validation is enabled
      if (validateSchema && schema && typeof schema === 'object') {
        this.validateAgainstSchema(parsed, schema);
      }
      
      return parsed;
    } catch (error) {
      if (validateJSON) {
        throw new Error(`Failed to parse structured output: ${error.message}`);
      } else {
        this.warn(`JSON parsing error (ignored due to validateJSON=false): ${error.message}`);
        return text; // Return raw text if validation is disabled
      }
    }
  }
  
  repairJSON(text) {
    // Simple JSON repair for common issues
    let repaired = text;
    
    // Replace single quotes with double quotes
    repaired = repaired.replace(/'/g, '"');
    
    // Add missing quotes around property names
    repaired = repaired.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    
    // Fix trailing commas in objects and arrays
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
    
    return repaired;
  }
  
  extractPartialJSON(text) {
    // Very simple partial JSON extraction
    // This would be more sophisticated in a real implementation
    const result = {};
    
    // Look for key-value patterns
    const keyValuePattern = /"([^"]+)"\s*:\s*(?:"([^"]+)"|(\d+)|true|false|null|\{[^}]*\}|\[[^\]]*\])/g;
    let match;
    
    while ((match = keyValuePattern.exec(text)) !== null) {
      const key = match[1];
      const value = match[2] !== undefined ? match[2] : 
                   match[3] !== undefined ? Number(match[3]) :
                   match[0].substring(match[0].indexOf(':') + 1).trim();
                   
      try {
        result[key] = JSON.parse(value);
      } catch (e) {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  validateAgainstSchema(data, schema) {
    // This would use a proper JSON Schema validator in production
    // For now, we'll do a very simple check
    
    // Check required properties
    if (schema.required && Array.isArray(schema.required)) {
      for (const prop of schema.required) {
        if (data[prop] === undefined) {
          throw new Error(`Required property '${prop}' is missing`);
        }
      }
    }
    
    // Check property types
    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (data[prop] !== undefined) {
          const type = propSchema.type;
          
          if (type === 'string' && typeof data[prop] !== 'string') {
            throw new Error(`Property '${prop}' should be a string`);
          } else if (type === 'number' && typeof data[prop] !== 'number') {
            throw new Error(`Property '${prop}' should be a number`);
          } else if (type === 'boolean' && typeof data[prop] !== 'boolean') {
            throw new Error(`Property '${prop}' should be a boolean`);
          } else if (type === 'array' && !Array.isArray(data[prop])) {
            throw new Error(`Property '${prop}' should be an array`);
          } else if (type === 'object' && (typeof data[prop] !== 'object' || Array.isArray(data[prop]))) {
            throw new Error(`Property '${prop}' should be an object`);
          }
        }
      }
    }
    
    return true;
  }
}

// ======== Data Processing ========

/**
 * Prompt Template Tool - Fill a template with variables
 */
export class PromptTemplateTool extends Tool {
  constructor(options = {}) {
    super({
      name: 'promptTemplate',
      description: 'Fill a template with variables',
      input: [
        param('input', ParamType.ANY, 'Template string or object with template and variables')
      ],
      output: [
        param('result', ParamType.STRING, 'The filled template with variables replaced')
      ],
      ...options
    });
  }
  
  async execute(input) {
    const { template, variables = {} } = typeof input === 'string' ? { template: input } : input;
    
    // Replace variables in the template
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value);
    }
    
    return result;
  }
}

/**
 * JSON Parser Tool - Extract and parse JSON from text
 */
export class JSONParserTool extends Tool {
  constructor(options = {}) {
    super({
      name: 'jsonParser',
      description: 'Extract and parse JSON from text, with fallback for errors',
      input: [
        param('input', ParamType.STRING, 'Text string or object with text and fallback')
      ],
      output: [
        param('result', ParamType.OBJECT, 'The parsed JSON object or fallback value')
      ],
      ...options
    });
  }
  
  async execute(input) {
    const { text, fallback = {} } = typeof input === 'string' ? { text: input } : input;
    
    try {
      // Try to extract JSON from text if it's embedded in other content
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                       text.match(/{[\s\S]*?}/);
      
      return jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch (error) {
      return fallback;
    }
  }
}

/**
 * Text Chunker Tool - Split text into overlapping chunks
 */
export class TextChunkerTool extends Tool {
  constructor(options = {}) {
    super({
      name: 'textChunker',
      description: 'Split text into overlapping chunks for processing',
      input: [
        param('input', ParamType.STRING, 'Text string or object with text and options')
      ],
      output: [
        param('chunks', ParamType.ARRAY, 'Array of text chunks with overlap')
      ],
      ...options
    });
  }
  
  async execute(input) {
    const { text, maxChunkSize = 1000, overlap = 200 } = typeof input === 'string' 
      ? { text: input } 
      : input;
    
    if (!text || text.length <= maxChunkSize) return [text];
    
    const chunks = [];
    let position = 0;
    
    while (position < text.length) {
      let chunkEnd = Math.min(position + maxChunkSize, text.length);
      
      // Try to end at a sentence or paragraph boundary if possible
      if (chunkEnd < text.length) {
        const nextPeriod = text.indexOf('.', chunkEnd - 100);
        const nextNewline = text.indexOf('\n', chunkEnd - 100);
        
        if (nextPeriod !== -1 && nextPeriod < chunkEnd + 100) {
          chunkEnd = nextPeriod + 1;
        } else if (nextNewline !== -1 && nextNewline < chunkEnd + 100) {
          chunkEnd = nextNewline + 1;
        }
      }
      
      chunks.push(text.substring(position, chunkEnd));
      position = chunkEnd - overlap;
    }
    
    return chunks;
  }
}

/**
 * State Snapshot Tool - Create a deep copy of an object
 */
export class StateSnapshotTool extends Tool {
  constructor(options = {}) {
    super({
      name: 'stateSnapshot',
      description: 'Create a deep copy snapshot of the current state',
      input: [
        param('state', ParamType.OBJECT, 'The state object to snapshot')
      ],
      output: [
        param('snapshot', ParamType.OBJECT, 'A deep copy of the state object')
      ],
      ...options
    });
  }
  
  async execute(state) {
    return JSON.parse(JSON.stringify(state));
  }
}

// ======== Web and API Tools ========

/**
 * Web Fetch Tool - Fetch data from a URL with retry capability
 */
export class WebFetchTool extends APITool {
  constructor(options = {}) {
    super({
      name: 'webFetch',
      description: 'Fetch data from a URL with retry capability',
      ...options
    });
  }
  
  async execute(input) {
    const { url, method = 'GET', headers = {}, body = null, responseType = 'json' } = 
      typeof input === 'string' ? { url: input } : input;
    
    const options = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
    };
    
    let attempt = 0;
    let error;
    
    while (attempt <= this.retries) {
      try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`API returned error status: ${response.status}`);
        }
        
        switch (responseType) {
          case 'json': return await response.json();
          case 'text': return await response.text();
          case 'blob': return await response.blob();
          case 'arrayBuffer': return await response.arrayBuffer();
          default: return await response.json();
        }
      } catch (err) {
        error = err;
        attempt++;
        
        if (attempt <= this.retries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          this.warn(`API call failed, retrying in ${delay}ms (${attempt}/${this.retries}):`, err);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    
    throw error;
  }
}

// Export all tools as a collection
export const tools = {
  memory: new MemoryTool(),
  llm: new LLMTool(),
  prompt: new PromptTemplateTool(),
  json: new JSONParserTool(),
  chunks: new TextChunkerTool(),
  snapshot: new StateSnapshotTool(),
  fetch: new WebFetchTool()
};
