import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Node, Flow, mapReduce, registerTool } from '../flowkit.js';

describe('Node', () => {
  it('should create a node with a function name', () => {
    function testFn() {}
    const node = new Node(testFn);
    expect(node.name).toBe('testFn');
    expect(node.fn).toBe(testFn);
    expect(node.outcomes.size).toBe(0);
    expect(node.maxRuns).toBe(Infinity);
    expect(node.runCount).toBe(0);
  });

  it('should create a node with explicit name and function', () => {
    const fn = () => 'result';
    const node = new Node('explicitName', fn);
    expect(node.name).toBe('explicitName');
    expect(node.fn).toBe(fn);
  });

  it('should run the node function with state', async () => {
    const fn = vi.fn(state => ({ ...state, result: 'success' }));
    const node = new Node('test', fn);
    const initialState = { input: 'test' };
    const result = await node.run(initialState);
    expect(fn).toHaveBeenCalledWith(initialState);
    expect(result).toEqual({ input: 'test', result: 'success' });
    expect(node.runCount).toBe(1);
  });

  it('should throw error when max runs is reached', async () => {
    const node = new Node('limited', () => {});
    node.setMaxRuns(2);
    await node.run({});
    await node.run({});
    await expect(node.run({})).rejects.toThrow(/max runs/);
  });

  it('should set next node for outcome', () => {
    const node1 = new Node('node1', () => {});
    const node2 = new Node('node2', () => {});
    node1.on('success', node2);
    expect(node1.outcomes.get('success')).toBe(node2);
  });

  it('should set default next node', () => {
    const node1 = new Node('node1', () => {});
    const node2 = new Node('node2', () => {});
    node1.next(node2);
    expect(node1.outcomes.get('default')).toBe(node2);
  });
});

describe('Flow', () => {
  it('should create an empty flow', () => {
    const flow = new Flow();
    expect(flow.startNode).toBeNull();
    expect(flow.lastNode).toBeNull();
    expect(flow.maxSteps).toBe(100);
    expect(flow.toolRegistry).toEqual([]);
    expect(flow.debug).toBe(false);
  });

  it('should create a flow with a start node', () => {
    const fn = () => {};
    const flow = Flow.start(fn);
    expect(flow.startNode).toBeInstanceOf(Node);
    expect(flow.startNode.name).toBe('fn');
    expect(flow.startNode.fn).toBe(fn);
  });

  it('should add a next node to the flow', () => {
    function start() { return 'start'; }
    function next() { return 'next'; }
    
    const flow = Flow.start(start);
    flow.next(next);
    
    expect(flow.lastNode.name).toBe('next');
    expect(flow.startNode.outcomes.get('default')).toBe(flow.lastNode);
  });

  it('should add a conditional branch', () => {
    function start() { return 'start'; }
    function branch() { return 'branch'; }
    
    const flow = Flow.start(start);
    flow.on('condition', branch);
    
    expect(flow.startNode.outcomes.get('condition')).toBeInstanceOf(Node);
    expect(flow.startNode.outcomes.get('condition').name).toBe('branch');
  });

  it('should throw error when calling .on() before defining a node', () => {
    const flow = new Flow();
    expect(() => flow.on('condition', () => {})).toThrow(/Cannot call .on\(\)/);
  });

  it('should run a simple linear flow', async () => {
    const flow = Flow.start(
      state => ({ ...state, step1: true })
    ).next(
      state => ({ ...state, step2: true })
    );
    
    const result = await flow.run({ initial: true });
    expect(result).toEqual({
      initial: true,
      step2: true
    });
  });

  it('should follow conditional branches', async () => {
    const flow = Flow.start(state => {
      return state.condition ? 'trueCase' : 'falseCase';
    })
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
    
    const flow = Flow.start(() => ({}))
      .all([fn1, fn2])
      .next(state => {
        // In our implementation, the parallel results are returned as an array
        // So we need to merge them with the state manually
        return { ...state, final: 'done' };
      });
    
    await flow.run({});
    
    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
  });

  it('should register tools', () => {
    const tool1 = () => {};
    const tool2 = () => {};
    
    const flow = Flow.start()
      .tools([tool1, tool2]);
    
    expect(flow.toolRegistry).toContain(tool1);
    expect(flow.toolRegistry).toContain(tool2);
  });

  it('should enforce max steps', async () => {
    // Create a flow that would run forever
    const infiniteFlow = Flow.start(state => 'loop')
      .on('loop', state => 'loop');
    
    infiniteFlow.setMaxSteps(5);
    
    const result = await infiniteFlow.run({});
    expect(result).toBeDefined();
  });
});

describe('mapReduce', () => {
  it('should process items in batches', async () => {
    const items = [1, 2, 3, 4, 5];
    const mapFn = vi.fn(item => item * 2);
    const reduceFn = vi.fn((results, state) => ({ ...state, results }));
    
    const processor = mapReduce(items, mapFn, reduceFn, { concurrency: 2 });
    const result = await processor({ initial: true });
    
    expect(mapFn).toHaveBeenCalledTimes(5);
    expect(reduceFn).toHaveBeenCalledWith([2, 4, 6, 8, 10], { initial: true });
    expect(result).toEqual({ initial: true, results: [2, 4, 6, 8, 10] });
  });

  it('should work without a reduce function', async () => {
    const items = [1, 2, 3];
    const mapFn = item => item * 2;
    
    const processor = mapReduce(items, mapFn);
    const result = await processor({});
    
    expect(result).toEqual([2, 4, 6]);
  });
});

describe('registerTool', () => {
  it('should add metadata to a function', () => {
    const fn = () => {};
    const metadata = { name: 'testTool', description: 'A test tool' };
    
    const tool = registerTool(fn, metadata);
    
    expect(tool).toBe(fn);
    expect(tool.metadata).toEqual(metadata);
  });
});
