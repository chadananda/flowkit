/**
 * Memory Tool Tests
 * Tests the MemoryTool functionality for storing and retrieving values
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryTool } from '../../flowtools.js';

describe('MemoryTool', () => {
  let memoryTool;
  
  beforeEach(() => {
    memoryTool = new MemoryTool();
  });
  
  it('should store and retrieve string values', async () => {
    await memoryTool.call({ key: 'testKey', value: 'testValue', action: 'set' });
    const result = await memoryTool.call('testKey');
    expect(result).toBe('testValue');
  });
  
  it('should store and retrieve numeric values', async () => {
    await memoryTool.call({ key: 'numKey', value: 42, action: 'set' });
    const result = await memoryTool.call('numKey');
    expect(result).toBe(42);
  });
  
  it('should store and retrieve boolean values', async () => {
    await memoryTool.call({ key: 'boolKey', value: true, action: 'set' });
    const result = await memoryTool.call('boolKey');
    expect(result).toBe(true);
  });
  
  it('should store and retrieve complex objects', async () => {
    const complexObject = { 
      nested: { 
        array: [1, 2, 3],
        value: true
      },
      count: 42
    };
    
    await memoryTool.call({ key: 'complex', value: complexObject, action: 'set' });
    const result = await memoryTool.call('complex');
    
    expect(result).toEqual(complexObject);
  });
  
  it('should update existing values', async () => {
    await memoryTool.call({ key: 'counter', value: 1, action: 'set' });
    await memoryTool.call({ key: 'counter', value: 2, action: 'set' });
    const result = await memoryTool.call('counter');
    expect(result).toBe(2);
  });
  
  it('should delete values', async () => {
    await memoryTool.call({ key: 'toDelete', value: 'value', action: 'set' });
    expect(await memoryTool.call('toDelete')).toBe('value');
    
    await memoryTool.call({ key: 'toDelete', action: 'delete' });
    expect(await memoryTool.call('toDelete')).toBeUndefined();
  });
  
  it('should return undefined for non-existent keys', async () => {
    const result = await memoryTool.call('nonExistentKey');
    expect(result).toBeUndefined();
  });
  
  it('should handle the "has" action correctly', async () => {
    await memoryTool.call({ key: 'existingKey', value: 'exists', action: 'set' });
    
    const hasExisting = await memoryTool.call({ key: 'existingKey', action: 'has' });
    expect(hasExisting).toBe(true);
    
    const hasNonExistent = await memoryTool.call({ key: 'nonExistentKey', action: 'has' });
    expect(hasNonExistent).toBe(false);
  });
  
  it('should handle the "keys" action correctly', async () => {
    await memoryTool.call({ key: 'key1', value: 'value1', action: 'set' });
    await memoryTool.call({ key: 'key2', value: 'value2', action: 'set' });
    
    const keys = await memoryTool.call({ action: 'keys' });
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
  });
  
  it('should handle the "clear" action correctly', async () => {
    await memoryTool.call({ key: 'key1', value: 'value1', action: 'set' });
    await memoryTool.call({ key: 'key2', value: 'value2', action: 'set' });
    
    await memoryTool.call({ action: 'clear' });
    
    expect(await memoryTool.call('key1')).toBeUndefined();
    expect(await memoryTool.call('key2')).toBeUndefined();
    
    const keys = await memoryTool.call({ action: 'keys' });
    expect(keys.length).toBe(0);
  });
  
  it('should handle invalid actions gracefully', async () => {
    await expect(memoryTool.call({ action: 'invalidAction' }))
      .rejects.toThrow(/Invalid action/);
  });
});
