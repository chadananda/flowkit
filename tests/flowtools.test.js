import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMemoryStore } from '../flowtools.js';

describe('Flow Tools', () => {
  describe('Memory Store', () => {
    let memoryStore;
    
    beforeEach(() => {
      memoryStore = createMemoryStore();
    });
    
    it('should store and retrieve values', async () => {
      await memoryStore.call({ key: 'testKey', value: 'testValue', action: 'set' });
      expect(await memoryStore.call('testKey')).toBe('testValue');
    });
    
    it('should return undefined for non-existent keys', async () => {
      expect(await memoryStore.call('nonExistentKey')).toBeUndefined();
    });
    
    it('should store complex objects', async () => {
      const complexObject = { 
        nested: { 
          array: [1, 2, 3],
          value: true
        },
        count: 42
      };
      
      await memoryStore.call({ key: 'complex', value: complexObject, action: 'set' });
      const retrieved = await memoryStore.call('complex');
      
      expect(retrieved).toEqual(complexObject);
    });
    
    it('should update existing values', async () => {
      await memoryStore.call({ key: 'counter', value: 1, action: 'set' });
      await memoryStore.call({ key: 'counter', value: 2, action: 'set' });
      expect(await memoryStore.call('counter')).toBe(2);
    });
    
    it('should delete values', async () => {
      await memoryStore.call({ key: 'toDelete', value: 'value', action: 'set' });
      expect(await memoryStore.call('toDelete')).toBe('value');
      
      await memoryStore.call({ key: 'toDelete', action: 'delete' });
      expect(await memoryStore.call('toDelete')).toBeUndefined();
    });
  });
});
