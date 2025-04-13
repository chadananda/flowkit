/**
 * Test utilities for Flowlite tests
 */

// Mock ParamType for tests
export const MockParamType = { 
  STRING: 'string', 
  NUMBER: 'number', 
  BOOLEAN: 'boolean', 
  OBJECT: 'object', 
  ARRAY: 'array', 
  ANY: 'any' 
};

// Mock param function for tests
export const mockParam = (name, type, description, optional = false) => ({ 
  name, 
  type, 
  description, 
  optional 
});
