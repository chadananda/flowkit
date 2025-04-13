/**
 * Mock implementation of flowlite for testing
 */

// Create basic mock classes and functions
export class Flow {
  static create(options = {}) {
    const flow = new Flow();
    flow.metadata = options;
    flow.nodes = new Map();
    return flow;
  }

  constructor() {
    this.metadata = {};
    this.nodes = new Map();
  }

  start(fn) {
    return this;
  }

  next(fn) {
    return this;
  }

  branch(condition, truePath, falsePath) {
    return this;
  }

  all(fns) {
    return this;
  }

  async run(initialState = {}) {
    return { ...initialState, success: true };
  }

  toToolChain() {
    return new Tool();
  }
}

export class Tool {
  constructor(options = {}) {
    this.metadata = options;
    this.stats = { calls: 0, errors: 0 };
  }

  async call(input) {
    return input;
  }

  async execute(input) {
    return input;
  }

  then(fn) {
    return this;
  }

  branch(condition, truePath, falsePath) {
    return this;
  }

  switch(selector, cases, defaultCase) {
    return this;
  }

  catch(handler) {
    return this;
  }

  withExecute(fn) {
    this.execute = fn;
    return this;
  }
}

export class LLMTool extends Tool {
  constructor(options = {}) {
    super(options);
  }
}

export class APITool extends Tool {
  constructor(options = {}) {
    super(options);
  }
}

export const ParamType = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  OBJECT: 'object',
  ARRAY: 'array',
  ANY: 'any'
};

export const param = (name, type, description, options = {}) => ({
  name,
  type,
  description,
  ...options
});

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

export const flowRegistry = {
  register(name, flow) {
    return this;
  },
  execute(name, initialState) {
    return Promise.resolve(initialState);
  }
};

export const apiKey = (name, value) => ({ name, value });
