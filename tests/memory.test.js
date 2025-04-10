import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTool } from '../flowkit.js';

// Mock implementation of a memory tool
const createMemoryStore = () => {
  const store = new Map();
  
  const memoryTool = registerTool(
    (key, value) => {
      if (value === undefined) {
        return store.get(key);
      }
      store.set(key, value);
      return true;
    },
    {
      name: 'memory',
      description: 'Store and retrieve values from memory',
      parameters: ['key', 'value?']
    }
  );
  
  // Add additional methods for testing
  memoryTool.getAll = () => Object.fromEntries(store.entries());
  memoryTool.clear = () => store.clear();
  memoryTool.has = (key) => store.has(key);
  
  return memoryTool;
};

describe('Memory Tool', () => {
  let memory;
  
  beforeEach(() => {
    memory = createMemoryStore();
  });
  
  it('should store and retrieve values', () => {
    memory('testKey', 'testValue');
    expect(memory('testKey')).toBe('testValue');
  });
  
  it('should return undefined for non-existent keys', () => {
    expect(memory('nonExistentKey')).toBeUndefined();
  });
  
  it('should store complex objects', () => {
    const complexObject = { 
      nested: { 
        array: [1, 2, 3],
        value: true
      },
      count: 42
    };
    
    memory('complex', complexObject);
    const retrieved = memory('complex');
    
    expect(retrieved).toEqual(complexObject);
    // But it should be a copy, not the same reference
    expect(retrieved).not.toBe(complexObject);
  });
  
  it('should update existing values', () => {
    memory('counter', 1);
    memory('counter', 2);
    expect(memory('counter')).toBe(2);
  });
  
  it('should check if a key exists', () => {
    memory('exists', true);
    expect(memory.has('exists')).toBe(true);
    expect(memory.has('doesNotExist')).toBe(false);
  });
  
  it('should clear all values', () => {
    memory('key1', 'value1');
    memory('key2', 'value2');
    
    memory.clear();
    
    expect(memory('key1')).toBeUndefined();
    expect(memory('key2')).toBeUndefined();
  });
  
  it('should get all stored values', () => {
    memory('key1', 'value1');
    memory('key2', 'value2');
    
    const all = memory.getAll();
    
    expect(all).toEqual({
      key1: 'value1',
      key2: 'value2'
    });
  });
  
  it('should have metadata from registerTool', () => {
    expect(memory.metadata).toEqual({
      name: 'memory',
      description: 'Store and retrieve values from memory',
      parameters: ['key', 'value?']
    });
  });
});
