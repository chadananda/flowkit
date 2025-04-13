/**
 * State Snapshot Tool Tests
 * Tests the StateSnapshotTool functionality for creating deep copies of state objects
 */
import { describe, it, expect } from 'vitest';
import { StateSnapshotTool } from '../../flowtools.js';

describe('StateSnapshotTool', () => {
  let stateSnapshotTool;
  
  beforeEach(() => {
    stateSnapshotTool = new StateSnapshotTool();
  });
  
  it('should create a deep copy of a simple object', async () => {
    const state = { name: 'John', age: 30 };
    
    const snapshot = await stateSnapshotTool.call(state);
    
    // Should be equal in value
    expect(snapshot).toEqual(state);
    
    // But not the same object reference
    expect(snapshot).not.toBe(state);
  });
  
  it('should create a deep copy of a nested object', async () => {
    const state = {
      user: {
        name: 'John',
        profile: {
          role: 'admin',
          permissions: ['read', 'write', 'delete']
        }
      },
      settings: {
        theme: 'dark',
        notifications: true
      }
    };
    
    const snapshot = await stateSnapshotTool.call(state);
    
    // Should be equal in value
    expect(snapshot).toEqual(state);
    
    // But not the same object references
    expect(snapshot).not.toBe(state);
    expect(snapshot.user).not.toBe(state.user);
    expect(snapshot.user.profile).not.toBe(state.user.profile);
    expect(snapshot.settings).not.toBe(state.settings);
  });
  
  it('should create a deep copy of arrays', async () => {
    const state = {
      items: [1, 2, 3],
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]
    };
    
    const snapshot = await stateSnapshotTool.call(state);
    
    // Should be equal in value
    expect(snapshot).toEqual(state);
    
    // But not the same array references
    expect(snapshot.items).not.toBe(state.items);
    expect(snapshot.users).not.toBe(state.users);
    expect(snapshot.users[0]).not.toBe(state.users[0]);
  });
  
  it('should handle circular references', async () => {
    const state = { name: 'Circular' };
    state.self = state; // Create circular reference
    
    // Should throw an error due to circular reference
    await expect(stateSnapshotTool.call(state)).rejects.toThrow(/circular/i);
  });
  
  it('should handle null and undefined values', async () => {
    const state = {
      nullValue: null,
      undefinedValue: undefined
    };
    
    const snapshot = await stateSnapshotTool.call(state);
    
    expect(snapshot.nullValue).toBeNull();
    expect(snapshot.undefinedValue).toBeUndefined();
  });
  
  it('should handle empty objects and arrays', async () => {
    const state = {
      emptyObject: {},
      emptyArray: []
    };
    
    const snapshot = await stateSnapshotTool.call(state);
    
    expect(snapshot.emptyObject).toEqual({});
    expect(snapshot.emptyArray).toEqual([]);
    expect(snapshot.emptyObject).not.toBe(state.emptyObject);
    expect(snapshot.emptyArray).not.toBe(state.emptyArray);
  });
  
  it('should handle date objects', async () => {
    const date = new Date('2023-01-01');
    const state = {
      createdAt: date
    };
    
    const snapshot = await stateSnapshotTool.call(state);
    
    // JSON.parse/stringify converts dates to strings
    expect(snapshot.createdAt).toEqual(date.toISOString());
  });
  
  it('should handle special number values', async () => {
    const state = {
      infinity: Infinity,
      negativeInfinity: -Infinity,
      nan: NaN
    };
    
    const snapshot = await stateSnapshotTool.call(state);
    
    // JSON.parse/stringify converts Infinity and NaN to null
    expect(snapshot.infinity).toBeNull();
    expect(snapshot.negativeInfinity).toBeNull();
    expect(snapshot.nan).toBeNull();
  });
  
  it('should handle functions (which are lost in JSON serialization)', async () => {
    const state = {
      func: function() { return 'test'; },
      arrowFunc: () => 'test'
    };
    
    const snapshot = await stateSnapshotTool.call(state);
    
    // Functions are lost in JSON serialization
    expect(snapshot.func).toBeUndefined();
    expect(snapshot.arrowFunc).toBeUndefined();
  });
});
