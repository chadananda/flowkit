/**
 * Flowlite Constants - Shared constants for the Flowlite framework
 */

// Enum for log levels
export const LogLevel = { NONE: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5 };

// Parameter type definitions
export const ParamType = { STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean', OBJECT: 'object', ARRAY: 'array', ANY: 'any' };

// Helper for creating parameter definitions
export const param = (name, type, description, optional = false) => ({ name, type, description, optional });

// Helper for creating goto instructions
export const goto = (nodeId) => ({ _goto: nodeId });

// Helper for defining API keys
export const apiKey = (name, description, required = true) => ({ name, description, required });
