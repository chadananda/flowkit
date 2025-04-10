import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  Node, Flow, Tool, LLMTool, APITool, 
  createTool, mapReduce, LogLevel, 
  param, ParamType, apiKey, goto 
} from '../flowlite.js';

// Mock performance.now for consistent timing tests
global.performance = { 
  now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(200) 
};

describe('Node', () => {
  it('should create a node with a function', () => {
    function testFn() {}
    const node = new Node(testFn);
    expect(node.name).toBe('testFn');
    expect(node.fn).toBe(testFn);
    expect(node.outcomes.size).toBe(0);
    expect(node.runCount).toBe(0);
  });

  it('should create a node with a Tool instance', () => {
    class TestTool extends Tool {
      constructor() {
        super({ name: 'testTool' });
      }
      async execute() { return { result: true }; }
    }
    
    const tool = new TestTool();
    const node = new Node(tool);
    
    expect(node.name).toBe('testTool');
    expect(node.fn).toBe(tool);
  });

  it('should run the node function with state', async () => {
    const fn = vi.fn(state => ({ ...state, result: 'success' }));
    const node = new Node(fn);
    const initialState = { input: 'test' };
    const result = await node.run(initialState);
    
    expect(fn).toHaveBeenCalledWith(initialState);
    expect(result).toEqual({ input: 'test', result: 'success' });
    expect(node.runCount).toBe(1);
  });

  it('should run a Tool instance when provided', async () => {
    class TestTool extends Tool {
      async execute(input) { 
        return { processed: input.value * 2 }; 
      }
    }
    
    const tool = new TestTool();
    const callSpy = vi.spyOn(tool, 'call');
    
    const node = new Node(tool);
    const result = await node.run({ value: 21 });
    
    expect(callSpy).toHaveBeenCalledWith({ value: 21 });
    expect(result).toEqual({ processed: 42 });
  });

  it('should throw error when max runs is reached', async () => {
    const node = new Node(() => {});
    node.setMaxRuns(2);
    
    await node.run({});
    await node.run({});
    
    await expect(node.run({})).rejects.toThrow(/max runs/);
  });

  it('should set outcome nodes by ID', () => {
    const node1 = new Node(() => {});
    const node2 = new Node(() => {});
    
    node1.on('success', node2.id);
    expect(node1.outcomes.get('success')).toBe(node2.id);
    
    node1.next(node2.id);
    expect(node1.outcomes.get('default')).toBe(node2.id);
  });
});

describe('Flow', () => {
  it('should create a flow with metadata', () => {
    const flow = Flow.create({
      name: 'testFlow',
      description: 'Test flow',
      input: [param('test', ParamType.STRING)],
      output: [param('result', ParamType.STRING)]
    });
    
    expect(flow.metadata.name).toBe('testFlow');
    expect(flow.metadata.input.length).toBe(1);
    expect(flow.metadata.output.length).toBe(1);
  });

  it('should create a flow with a start node', () => {
    const fn = () => {};
    const flow = Flow.start(fn);
    
    expect(flow.startNodeId).not.toBeNull();
    expect(flow.nodes.size).toBe(1);
  });

  it('should add a Tool instance as a node', () => {
    class TestTool extends Tool {
      constructor() {
        super({ name: 'testTool' });
      }
      async execute() { return { result: true }; }
    }
    
    const tool = new TestTool();
    const flow = Flow.start().next(tool);
    
    expect(flow.nodes.size).toBe(2);
    expect(flow.lastNodeId).not.toBeNull();
  });

  it('should run a simple linear flow', async () => {
    const flow = Flow.create()
      .next(state => ({ ...state, step1: true }))
      .next(state => ({ ...state, step2: true }));
    
    const result = await flow.run({ initial: true });
    
    expect(result).toEqual({
      initial: true,
      step1: true,
      step2: true
    });
  });

  it('should follow conditional branches', async () => {
    const flow = Flow.create()
      .next(state => state.condition ? 'trueCase' : 'falseCase')
      .on('trueCase', state => ({ ...state, result: 'true path taken' }))
      .on('falseCase', state => ({ ...state, result: 'false path taken' }));
    
    const trueResult = await flow.run({ condition: true });
    expect(trueResult.result).toBe('true path taken');
    
    const falseResult = await flow.run({ condition: false });
    expect(falseResult.result).toBe('false path taken');
  });

  it('should run nodes in parallel with .all()', async () => {
    const fn1 = vi.fn().mockImplementation(state => ({ ...state, fn1: 'ran' }));
    const fn2 = vi.fn().mockImplementation(state => ({ ...state, fn2: 'ran' }));
    
    const flow = Flow.create()
      .all([fn1, fn2])
      .next(state => ({ ...state, final: 'done' }));
    
    const result = await flow.run({ initial: true });
    
    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
    expect(result).toEqual({
      initial: true,
      fn1: 'ran',
      fn2: 'ran',
      final: 'done'
    });
  });

  it('should run Tool instances in parallel', async () => {
    class Tool1 extends Tool {
      async execute(input) { return { tool1: 'executed' }; }
    }
    
    class Tool2 extends Tool {
      async execute(input) { return { tool2: 'executed' }; }
    }
    
    const tool1 = new Tool1();
    const tool2 = new Tool2();
    
    const flow = Flow.create().all([tool1, tool2]);
    const result = await flow.run({ initial: true });
    
    expect(result).toEqual({
      initial: true,
      tool1: 'executed',
      tool2: 'executed'
    });
  });

  it('should log execution details at different levels', async () => {
    // Mock console methods
    const mockConsole = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      log: vi.fn()
    };
    
    const originalConsole = { ...console };
    console.error = mockConsole.error;
    console.warn = mockConsole.warn;
    console.info = mockConsole.info;
    console.debug = mockConsole.debug;
    console.trace = mockConsole.trace;
    console.log = mockConsole.log;
    
    try {
      const flow = Flow.create({ name: 'loggingFlow', logLevel: LogLevel.DEBUG })
        .next(state => ({ ...state, step1: true }))
        .next(state => ({ ...state, step2: true }));
      
      await flow.run({ test: true });
      
      // Should log debug info
      expect(mockConsole.info).toHaveBeenCalled();
      expect(mockConsole.debug).toHaveBeenCalled();
      
      // Reset mocks
      vi.clearAllMocks();
      
      // Set to ERROR level
      flow.setLogLevel(LogLevel.ERROR);
      await flow.run({ test: true });
      
      // Should not log info or debug
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.debug).not.toHaveBeenCalled();
    } finally {
      // Restore console methods
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
      console.debug = originalConsole.debug;
      console.trace = originalConsole.trace;
      console.log = originalConsole.log;
    }
  });

  it('should track execution statistics', async () => {
    // Mock performance.now for this specific test
    const originalPerformance = global.performance;
    
    // Create a mock that returns increasing values to simulate time passing
    let timeCounter = 100;
    global.performance = { 
      now: vi.fn(() => {
        const currentTime = timeCounter;
        timeCounter += 100; // Increment by 100ms each call
        return currentTime;
      })
    };
    
    try {
      const flow = Flow.create({ name: 'statsFlow' })
        .next(state => ({ ...state, step1: true }))
        .next(state => ({ ...state, step2: true }));
      
      await flow.run({ test: true });
      
      const stats = flow.getStats();
      expect(stats.runs).toBe(1);
      expect(stats.errors).toBe(0);
      expect(stats.totalTime).toBeGreaterThan(0); // Just check that we have a positive time
      expect(stats.nodeStats).toBeDefined();
    } finally {
      // Restore original performance
      global.performance = originalPerformance;
    }
  });

  it('should convert a flow to a Tool instance', async () => {
    const flow = Flow.create({ 
      name: 'toolFlow',
      description: 'A flow that can be used as a tool',
      input: [param('value', ParamType.NUMBER)],
      output: [param('result', ParamType.NUMBER)]
    })
    .next(state => ({ result: state.value })); // Only return the result property
    
    const flowTool = flow.asTool();
    
    expect(flowTool).toBeInstanceOf(Tool);
    expect(flowTool.metadata.name).toBe('toolFlow');
    
    const result = await flowTool.call({ value: 42 });
    expect(result).toEqual({ value: 42, result: 42 });
  });
});

describe('mapReduce', () => {
  it('should process items in parallel by default', async () => {
    const items = [1, 2, 3, 4, 5];
    const mapFn = vi.fn(item => item * 2);
    const reduceFn = vi.fn(results => ({ results }));
    
    const processor = mapReduce(items, mapFn, reduceFn);
    const result = await processor({});
    
    expect(mapFn).toHaveBeenCalledTimes(5);
    expect(reduceFn).toHaveBeenCalledWith([2, 4, 6, 8, 10], {});
    expect(result).toEqual({ results: [2, 4, 6, 8, 10] });
  });

  it('should process items in batches with concurrency limit', async () => {
    const items = [1, 2, 3, 4, 5];
    const mapFn = vi.fn(item => item * 2);
    
    const processor = mapReduce(items, mapFn, null, { concurrency: 2 });
    const result = await processor({});
    
    expect(mapFn).toHaveBeenCalledTimes(5);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });
});

describe('createTool', () => {
  it('should create a Tool instance from a function', async () => {
    const fn = async ({ x, y }) => ({ sum: x + y });
    
    const tool = createTool(fn, {
      name: 'calculator',
      description: 'Adds two numbers'
    });
    
    expect(tool).toBeInstanceOf(Tool);
    expect(tool.metadata.name).toBe('calculator');
    
    const result = await tool.call({ x: 2, y: 3 });
    expect(result).toEqual({ sum: 5 });
  });
});

describe('goto', () => {
  it('should create a goto instruction', () => {
    const instruction = goto('targetNode');
    expect(instruction).toEqual({ _goto: 'targetNode' });
  });
  
  it('should allow flow to jump to a specific node', async () => {
    const flow = Flow.create()
      .next(state => goto('finalNode'))
      .next(state => ({ skipped: true }))
      .next(state => ({ skipped: true }));
    
    // Add a node with ID 'finalNode'
    const finalNode = new Node(state => ({ final: true }), 'finalNode');
    flow.nodes.set(finalNode.id, finalNode);
    
    const result = await flow.run({});
    
    expect(result.skipped).toBeUndefined();
    expect(result.final).toBe(true);
  });
});
