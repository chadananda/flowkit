/**
 * Flowlite - A minimal, elegant flow-based framework for AI agents
 * Inspired by functional programming and modern ES6+ features
 */

// Import constants from constants.js
import { LogLevel, ParamType, param, goto, apiKey } from './constants.js';

// Export constants for convenience
export { LogLevel, ParamType, param, goto, apiKey };

// Import the Tool class and FlowRegistry for the new approach
import { Tool, flowRegistry } from './flowtools.js';

// Node class - represents a step in the flow
export class Node {
  constructor(fnOrTool, id, options = {}) {
    this.fn = fnOrTool;
    this.id = id || `node_${Math.random().toString(36).substring(2, 9)}`;
    this.name = options.name || (fnOrTool.metadata ? fnOrTool.metadata.name : this.id);
    this.description = options.description || (fnOrTool.metadata ? fnOrTool.metadata.description : '');
    this.outcomes = new Map();
    this.outcomes.set('default', options.next || null);
    this.maxRuns = options.maxRuns || Infinity;
    this.runCount = 0;
  }

  // Add a default next node
  next(nodeId) {
    this.outcomes.set('default', nodeId);
    return this;
  }

  // Add a conditional outcome
  on(outcome, nodeId) {
    this.outcomes.set(outcome, nodeId);
    return this;
  }

  // Set maximum runs for this node
  setMaxRuns(max) {
    this.maxRuns = max;
    return this;
  }

  // Execute the node function with the current state
  async run(state) {
    if (this.runCount >= this.maxRuns) {
      throw new Error(`Node ${this.name} (${this.id}) has reached maximum runs (${this.maxRuns})`);
    }
    
    this.runCount++;
    
    // Ensure state is always an object
    const safeState = state || {};
    
    // If the function is a Tool instance, call it with the state
    if (this.fn.call && typeof this.fn.call === 'function') {
      return await this.fn.call(safeState);
    }
    
    // If the function has metadata, it's a tool function
    if (this.fn.metadata) {
      return await this.fn(safeState);
    }
    
    // Otherwise, it's a regular function
    return await this.fn(safeState);
  }
}

// Flow class - manages the execution of nodes
export class Flow {
  constructor(metadata = {}) {
    this.metadata = {
      name: metadata.name || 'unnamed_flow',
      description: metadata.description || '',
      input: metadata.input || [],
      output: metadata.output || [],
      apiKeys: metadata.apiKeys || []
    };
    this.nodes = new Map();
    this.startNodeId = null;
    this.lastNodeId = null;
    this.stats = { 
      runs: 0, 
      errors: 0, 
      totalTime: 0,
      nodeStats: {}
    };
    this.logLevel = metadata.logLevel || LogLevel.INFO;
    this.logger = metadata.logger || console;
    
    // For the new tool-centric approach
    this.toolChain = null;
    this.flowId = `flow_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  // Static factory methods
  static create(metadata = {}) {
    return new Flow(metadata);
  }
  
  static start(fnOrTool, options = {}) {
    const flow = new Flow(options);
    flow.start(fnOrTool, options);
    return flow;
  }
  
  // Chainable configuration methods
  setLogLevel = (level) => { this.logLevel = level; return this; };
  setLogger = (logger) => { this.logger = logger; return this; };
  withApiKey = (name, description, required = true) => { 
    this.metadata.apiKeys.push(apiKey(name, description, required)); 
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
    avgTime: this.stats.runs ? this.stats.totalTime / this.stats.runs : 0,
    errorRate: this.stats.runs ? this.stats.errors / this.stats.runs : 0
  });
  resetStats = () => { this.stats = { runs: 0, errors: 0, totalTime: 0, nodeStats: {} }; return this; };
  
  // Add a starting node to the flow
  start(nodeOrFn, options = {}) {
    const node = this.createNode(nodeOrFn, options);
    this.startNodeId = node.id;
    this.lastNodeId = node.id;
    
    // Initialize the tool chain with the first node
    if (nodeOrFn instanceof Tool) {
      this.toolChain = nodeOrFn;
    } else {
      // Create a tool from the function
      this.toolChain = new Tool({
        name: options.name || (typeof nodeOrFn === 'function' ? nodeOrFn.name : 'start_node'),
        description: options.description || 'Start node of the flow'
      }).withExecute(async (input) => await nodeOrFn(input));
    }
    
    // Register the flow with the registry
    flowRegistry.createSegment(this.flowId, this.toolChain);
    
    return this;
  }
  
  // Add a node to the flow
  next(nodeOrFn, options = {}) {
    // Traditional flow approach
    const node = this.createNode(nodeOrFn, options);
    
    if (this.lastNodeId) {
      const lastNode = this.nodes.get(this.lastNodeId);
      lastNode.next(node.id);
    } else {
      this.startNodeId = node.id;
    }
    
    this.lastNodeId = node.id;
    
    // Tool-centric approach
    if (this.toolChain) {
      if (nodeOrFn instanceof Tool) {
        this.toolChain = this.toolChain.then(nodeOrFn);
      } else {
        // Create a tool from the function
        const nextTool = new Tool({
          name: options.name || (typeof nodeOrFn === 'function' ? nodeOrFn.name : 'next_node'),
          description: options.description || 'Flow node'
        }).withExecute(async (input) => await nodeOrFn(input));
        
        this.toolChain = this.toolChain.then(nextTool);
      }
    }
    
    return this;
  }
  
  // Add conditional branch based on outcome
  on(outcome, nodeOrFn, options = {}) {
    const node = this.createNode(nodeOrFn, options);
    
    if (!this.lastNodeId) {
      throw new Error('Cannot add conditional branch without a previous node');
    }
    
    const lastNode = this.nodes.get(this.lastNodeId);
    lastNode.on(outcome, node.id);
    
    // Tool-centric approach - implement using branch
    if (this.toolChain) {
      // Create a tool for this branch
      let branchTool;
      if (nodeOrFn instanceof Tool) {
        branchTool = nodeOrFn;
      } else {
        branchTool = new Tool({
          name: options.name || (typeof nodeOrFn === 'function' ? nodeOrFn.name : `branch_${outcome}`),
          description: options.description || `Branch for outcome ${outcome}`
        }).withExecute(async (input) => await nodeOrFn(input));
      }
      
      // Create a segment for this branch
      const branchId = `${this.flowId}_branch_${outcome}`;
      flowRegistry.createSegment(branchId, branchTool);
      
      // Add branching logic to the current chain
      this.toolChain = this.toolChain.branch(
        (result) => result === outcome,
        { _goto: branchId },
        null
      );
    }
    
    return this;
  }
  
  // Add parallel execution of multiple nodes
  all(nodesOrFns, options = {}) {
    const parallelFn = this.parallelFn(nodesOrFns);
    return this.next(parallelFn, options);
  }
  
  parallelFn(nodesOrFns) {
    return async (state) => {
      const tasks = nodesOrFns.map(nodeOrFn => {
        if (nodeOrFn instanceof Node) {
          return nodeOrFn.run(state);
        } else if (nodeOrFn instanceof Tool) {
          return nodeOrFn.call(state);
        } else if (typeof nodeOrFn === 'function') {
          return nodeOrFn(state);
        } else {
          throw new Error('Invalid node or function in parallel execution');
        }
      });
      
      const results = await Promise.all(tasks);
      
      // Merge results if they are objects
      const mergedResult = {};
      for (const result of results) {
        if (result && typeof result === 'object') {
          Object.assign(mergedResult, result);
        }
      }
      
      return mergedResult;
    };
  }
  
  // Convert flow to a Tool instance
  asTool(options = {}) {
    const tool = new Tool({
      name: options.name || this.metadata.name,
      description: options.description || this.metadata.description,
      input: options.input || this.metadata.input,
      output: options.output || this.metadata.output,
      apiKeys: options.apiKeys || this.metadata.apiKeys,
      logLevel: options.logLevel || this.logLevel
    });
    
    // Set the execute method to run the flow
    tool.execute = async (input) => {
      // If we have a tool chain, use it
      if (this.toolChain) {
        return await this.toolChain.call(input);
      }
      
      // Otherwise, fall back to the traditional flow execution
      return await this.run(input);
    };
    
    return tool;
  }
  
  // Convert to a tool chain
  toToolChain() {
    // Create a wrapper tool that will execute the flow
    const flowTool = new Tool({
      name: this.metadata.name,
      description: this.metadata.description,
      input: this.metadata.input,
      output: this.metadata.output
    });
    
    // Set the execute method to run the flow
    flowTool.withExecute(async (input) => {
      return await this.run(input);
    });
    
    return flowTool;
  }
  
  // Create a flow from a tool chain
  static fromToolChain(toolChain, metadata = {}) {
    // Create a new flow with the tool chain's metadata
    const flow = new Flow({
      name: toolChain.metadata.name,
      description: toolChain.metadata.description,
      input: toolChain.metadata.input,
      output: toolChain.metadata.output,
      ...metadata
    });
    
    // Add a single node that executes the tool chain
    flow.next(async (state) => {
      return await toolChain.call(state);
    });
    
    return flow;
  }

  execute(input) {
    return this.run(input);
  }
  
  // Execute the flow with the given initial state
  async run(initialState = {}) {
    // If we have a tool chain, use it
    if (this.toolChain) {
      const startTime = performance.now();
      try {
        const result = await this.toolChain.call(initialState);
        const duration = performance.now() - startTime;
        this.stats.runs++;
        this.stats.totalTime += duration;
        this.info(`[${this.metadata.name}] Flow completed in ${duration.toFixed(2)}ms`);
        return result;
      } catch (error) {
        this.stats.errors++;
        this.error(`[${this.metadata.name}] Flow error:`, error);
        throw error;
      }
    }
    
    // Traditional flow execution
    if (!this.startNodeId) {
      throw new Error('Flow has no starting node');
    }
    
    this.stats.runs++;
    let state = { ...initialState };
    let currentNodeId = this.startNodeId;
    let steps = 0;
    const startTime = performance.now();
    
    while (currentNodeId) {
      steps++;
      const currentNode = this.nodes.get(currentNodeId);
      
      if (!currentNode) {
        throw new Error(`Node not found: ${currentNodeId}`);
      }
      
      let nextNodeId = null;
      
      try {
        this.debug(`[${this.metadata.name}] Executing node: ${currentNode.name} (${currentNodeId})`);
        
        if (!this.stats.nodeStats[currentNodeId]) {
          this.stats.nodeStats[currentNodeId] = { 
            name: currentNode.name,
            calls: 0, 
            errors: 0, 
            totalTime: 0 
          };
        }
        
        const nodeStats = this.stats.nodeStats[currentNodeId];
        nodeStats.calls++;
        
        const nodeStartTime = performance.now();
        const result = await currentNode.run(state);
        const nodeDuration = performance.now() - nodeStartTime;
        
        nodeStats.totalTime += nodeDuration;
        this.debug(`[${this.metadata.name}] Node ${currentNode.name} completed in ${nodeDuration.toFixed(2)}ms`);
        
        // Handle goto instructions
        if (result && typeof result === 'object' && result._goto) {
          nextNodeId = result._goto;
          this.debug(`[${this.metadata.name}] Goto instruction: ${nextNodeId}`);
        } 
        // Handle outcome-based routing
        else if (result && currentNode.outcomes.has(result)) {
          nextNodeId = currentNode.outcomes.get(result);
          this.debug(`[${this.metadata.name}] Following outcome: ${result} -> ${nextNodeId}`);
        }
        // Default to next node
        else if (currentNode.outcomes.has('default')) {
          nextNodeId = currentNode.outcomes.get('default');
          this.debug(`[${this.metadata.name}] Following default outcome -> ${nextNodeId}`);
        }
        
        // Update state with result if it's an object
        if (result && typeof result === 'object' && !result._goto) {
          state = { ...state, ...result };
        }
        
        currentNodeId = nextNodeId;
      } catch (error) {
        if (this.stats.nodeStats[currentNodeId]) {
          this.stats.nodeStats[currentNodeId].errors++;
        }
        this.error(`[${this.metadata.name}] Error in node ${currentNode.name} (${currentNodeId}):`, error);
        throw error;
      }
    }
    
    const duration = performance.now() - startTime;
    this.stats.totalTime += duration;
    
    this.info(`[${this.metadata.name}] Flow completed in ${isNaN(duration) ? 'unknown' : duration.toFixed(2)}ms after ${steps} steps`);
    this.debug(`[${this.metadata.name}] Final state:`, state);
    
    return state;
  }
  
  createNode(nodeOrFn, options = {}) {
    const node = nodeOrFn instanceof Node 
      ? nodeOrFn 
      : new Node(nodeOrFn, options.id, options);
    
    this.nodes.set(node.id, node);
    
    return node;
  }
}

// Map-reduce utility for processing collections
export const mapReduce = (items, mapFn, reduceFn = null, options = {}) => {
  const { concurrency = Infinity } = options;
  
  return async (state) => {
    // Process items in batches if concurrency is limited
    const processItems = async () => {
      if (concurrency === Infinity) {
        return await Promise.all(items.map(item => mapFn(item, state)));
      }
      
      const results = [];
      for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(item => mapFn(item, state)));
        results.push(...batchResults);
      }
      return results;
    };
    
    const mappedResults = await processItems();
    
    // Apply reducer function if provided
    if (reduceFn) {
      return await reduceFn(mappedResults, state);
    }
    
    return mappedResults;
  };
};

// Re-export all tools from flowtools.js
export * from './flowtools.js';

// Helper function to create a Tool from a function
export const createTool = (fn, metadata = {}) => {
  const tool = new Tool({
    name: metadata.name || fn.name || 'anonymous_tool',
    description: metadata.description || 'Tool created from function',
    input: metadata.input || [],
    output: metadata.output || [],
    ...metadata
  });
  
  tool.withExecute(fn);
  
  return tool;
};
