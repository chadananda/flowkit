/**
 * Flowkit - A Minimal, Composable Framework for Building LLM-Powered Agent Flows
 * Enables structured, chainable agent workflows with branching, parallel execution, and state management
 */

// Node class - Encapsulates a single unit of work
export class Node {
  constructor(nameOrFn, fn) {
    this.name = typeof nameOrFn === 'function' ? (nameOrFn.name || 'anonymous') : nameOrFn;
    this.fn = typeof nameOrFn === 'function' ? nameOrFn : fn;
    this.outcomes = new Map();
    this.maxRuns = Infinity;
    this.runCount = 0;
  }

  async run(state) {
    if (this.runCount++ >= this.maxRuns) throw new Error(`Node '${this.name}' max runs (${this.maxRuns})`);
    return await this.fn(state);
  }

  on(outcome, node) { this.outcomes.set(outcome, node); return this; }
  next(node) { return this.on('default', node); }
  setMaxRuns(max) { this.maxRuns = max; return this; }
}

// Flow class - Controls flow execution
export class Flow {
  constructor() {
    this.startNode = this.lastNode = null;
    this.maxSteps = 100;
    this.toolRegistry = [];
    this.debug = false;
  }

  static start(nodeOrFn) {
    const flow = new Flow();
    if (nodeOrFn) flow.startNode = flow.lastNode = nodeOrFn instanceof Node ? nodeOrFn : new Node(nodeOrFn);
    return flow;
  }

  next(nodeOrFn) {
    const node = nodeOrFn instanceof Node ? nodeOrFn : new Node(nodeOrFn);
    !this.startNode ? this.startNode = node : this.lastNode?.next(node);
    return this.lastNode = node;
  }

  on(outcome, nodeOrFn) {
    if (!this.lastNode) throw new Error('Cannot call .on() before defining a node');
    this.lastNode.on(outcome, nodeOrFn instanceof Node ? nodeOrFn : new Node(nodeOrFn));
    return this;
  }

  onPrompt(prompt, trueNode, falseNode) {
    if (!this.lastNode) throw new Error('Cannot call .onPrompt() before defining a node');
    
    // Create a decision node that will evaluate the prompt using an LLM
    const decisionNode = new Node('promptDecision', async (state) => {
      // Import callLLM from tools.js
      const { callLLM } = await import('./tools.js');
      
      // Create a prompt that asks for a yes/no decision
      const fullPrompt = `
Given the following context, please answer with ONLY "true" or "false":

${prompt}

Context:
${JSON.stringify(state, null, 2)}

Answer (true/false):`;
      
      // Call the LLM and get the result
      const response = await callLLM({
        prompt: fullPrompt,
        temperature: 0.1 // Low temperature for more deterministic responses
      });
      
      // Parse the response to get a boolean
      const result = response.toLowerCase().includes('true');
      
      // Return the outcome based on the result
      return result ? 'true' : 'false';
    });
    
    // Connect the decision node to the current last node
    this.lastNode.next(decisionNode);
    
    // Connect the true and false branches
    const trueNodeInstance = new Node(trueNode);
    const falseNodeInstance = new Node(falseNode);
    
    decisionNode.on('true', trueNodeInstance);
    decisionNode.on('false', falseNodeInstance);
    
    // Update the last node to be the decision node
    // Note: We don't set a specific branch as the last node since both are valid paths
    this.lastNode = decisionNode;
    
    return this;
  }

  all(nodesOrFns) {
    return this.next(new Node('parallel', async state => 
      await Promise.all(nodesOrFns.map(n => (n instanceof Node ? n : new Node(n)).run(state)))
    ));
  }

  tools(toolArray) {
    this.toolRegistry = [...this.toolRegistry, ...toolArray];
    return this;
  }

  plan(prompt) {
    if (!this.toolRegistry || this.toolRegistry.length === 0) {
      throw new Error('Cannot call .plan() without registering tools first. Use .tools([...]) before .plan()');
    }
    
    // Create a planning node that will generate a flow plan using an LLM
    const planningNode = new Node('flowPlanner', async (state) => {
      // Import callLLM from tools.js
      const { callLLM } = await import('./tools.js');
      
      // Generate tool descriptions for the prompt
      const toolDescriptions = this.toolRegistry.map(tool => {
        const metadata = tool.metadata || {};
        const params = metadata.parameters || [];
        const paramString = params.map(p => p.endsWith('?') ? `[${p.slice(0, -1)}]` : p).join(', ');
        
        return `${metadata.name || 'unnamed'}: ${metadata.description || 'No description'} 
Parameters: ${paramString || 'None'}`;
      }).join('\n\n');
      
      // Create a prompt that asks the LLM to plan a workflow
      const planningPrompt = `
You are an expert workflow planner for LLM-powered agent systems. Design a flow to accomplish the following goal:

${prompt}

Available tools:
${toolDescriptions}

First, provide a high-level plan with these components:
1. Input: What initial data is needed
2. Steps: The sequence of operations needed
3. Output: The expected final result

Then, provide the flow as executable JavaScript code using the Flowkit framework.

Use this format:
\`\`\`
// High-level Plan
Input: [describe input data]
Steps:
1. [Step 1 description]
2. [Step 2 description]
...
Output: [describe output]

// Flow Implementation
const flow = Flow.start(step1)
  .next(step2)
  ...
  .tools([tool1, tool2, ...]);

// Step Implementations
const step1 = async (state) => {
  // Implementation details
};
\`\`\`

Make sure your plan uses the available tools effectively and follows a logical sequence.
`;
      
      // Call the LLM to generate the plan
      const plan = await callLLM({
        prompt: planningPrompt,
        temperature: 0.7,
        maxTokens: 2000
      });
      
      // Log the plan
      console.log('\n===== FLOW PLAN =====\n');
      console.log(plan);
      console.log('\n=====================\n');
      
      // Store the plan in the state
      return { ...state, flowPlan: plan };
    });
    
    // If there's no start node yet, set this as the start
    if (!this.startNode) {
      this.startNode = this.lastNode = planningNode;
    } else {
      // Otherwise connect it to the current last node
      this.lastNode.next(planningNode);
      this.lastNode = planningNode;
    }
    
    return this;
  }

  setDebug(enabled = true) { this.debug = enabled; return this; }
  setMaxSteps(max) { this.maxSteps = max; return this; }

  async run(initialState = {}) {
    if (!this.startNode) throw new Error('Cannot run flow without a start node');
    let state = { ...initialState }, currentNode = this.startNode, steps = 0;
    while (currentNode && steps++ < this.maxSteps) {
      this.debug && console.log(`Running node: ${currentNode.name}`);
      const result = await currentNode.run(state);
      if (result && typeof result === 'object') state = { ...state, ...result };
      currentNode = result && currentNode.outcomes.has(result) ? currentNode.outcomes.get(result) : currentNode.outcomes.get('default') || null;
    }
    if (steps > this.maxSteps) throw new Error(`Flow exceeded maximum steps (${this.maxSteps})`);
    return state;
  }
}

// Map-reduce utility for processing collections
export const mapReduce = (items, mapFn, reduceFn, { concurrency = 1 } = {}) => async state => {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency)
    results.push(...await Promise.all(items.slice(i, i + concurrency).map(item => mapFn(item, state))));
  return reduceFn ? reduceFn(results, state) : results;
};

// Register a tool with metadata
export const registerTool = (fn, metadata) => Object.assign(fn, { metadata });
