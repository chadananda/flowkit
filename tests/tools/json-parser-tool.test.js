/**
 * JSON Parser Tool Tests
 * Tests the JSONParserTool functionality for parsing and validating JSON
 */
import { describe, it, expect } from 'vitest';
import { JSONParserTool } from '../../flowtools.js';

describe('JSONParserTool', () => {
  let jsonParserTool;
  
  beforeEach(() => {
    jsonParserTool = new JSONParserTool();
  });
  
  it('should parse valid JSON string', async () => {
    const validJSON = '{"name": "John", "age": 30, "isActive": true}';
    const result = await jsonParserTool.call({
      text: validJSON
    });
    
    expect(result).toEqual({
      name: 'John',
      age: 30,
      isActive: true
    });
  });
  
  it('should parse JSON with arrays', async () => {
    const arrayJSON = '{"items": [1, 2, 3], "names": ["Alice", "Bob"]}';
    const result = await jsonParserTool.call({
      text: arrayJSON
    });
    
    expect(result).toEqual({
      items: [1, 2, 3],
      names: ['Alice', 'Bob']
    });
  });
  
  it('should parse nested JSON objects', async () => {
    const nestedJSON = '{"user": {"name": "Jane", "profile": {"role": "admin"}}}';
    const result = await jsonParserTool.call({
      text: nestedJSON
    });
    
    expect(result).toEqual({
      user: {
        name: 'Jane',
        profile: {
          role: 'admin'
        }
      }
    });
  });
  
  it('should extract JSON from text with surrounding content', async () => {
    const textWithJSON = 'Here is the data: {"key": "value"} End of message.';
    const result = await jsonParserTool.call({
      text: textWithJSON,
      extractFromText: true
    });
    
    expect(result).toEqual({
      key: 'value'
    });
  });
  
  it('should return fallback value for invalid JSON', async () => {
    const invalidJSON = '{name: "Missing quotes"}';
    const fallback = { error: 'Invalid JSON' };
    
    const result = await jsonParserTool.call({
      text: invalidJSON,
      fallback
    });
    
    expect(result).toEqual(fallback);
  });
  
  it('should throw error for invalid JSON when no fallback is provided', async () => {
    const invalidJSON = '{this is not valid JSON}';
    
    await expect(jsonParserTool.call({
      text: invalidJSON
    })).rejects.toThrow(/Failed to parse JSON/);
  });
  
  it('should handle empty input', async () => {
    const emptyInput = '';
    const fallback = { empty: true };
    
    const result = await jsonParserTool.call({
      text: emptyInput,
      fallback
    });
    
    expect(result).toEqual(fallback);
  });
  
  it('should handle null and undefined input', async () => {
    const fallback = { nullOrUndefined: true };
    
    const resultNull = await jsonParserTool.call({
      text: null,
      fallback
    });
    
    const resultUndefined = await jsonParserTool.call({
      text: undefined,
      fallback
    });
    
    expect(resultNull).toEqual(fallback);
    expect(resultUndefined).toEqual(fallback);
  });
  
  it('should handle already parsed JSON objects', async () => {
    const alreadyParsed = { key: 'value', nested: { prop: true } };
    
    const result = await jsonParserTool.call({
      text: alreadyParsed
    });
    
    expect(result).toEqual(alreadyParsed);
  });
  
  it('should validate JSON against schema if provided', async () => {
    const validJSON = '{"name": "John", "age": 30}';
    const schema = {
      type: 'object',
      required: ['name', 'age'],
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      }
    };
    
    const result = await jsonParserTool.call({
      text: validJSON,
      schema
    });
    
    expect(result).toEqual({
      name: 'John',
      age: 30
    });
  });
  
  it('should throw error if JSON does not match schema', async () => {
    const invalidJSON = '{"name": "John", "age": "thirty"}'; // age should be number
    const schema = {
      type: 'object',
      required: ['name', 'age'],
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      }
    };
    
    await expect(jsonParserTool.call({
      text: invalidJSON,
      schema
    })).rejects.toThrow(/Schema validation failed/);
  });
  
  it('should use fallback if JSON does not match schema', async () => {
    const invalidJSON = '{"name": "John"}'; // missing required age
    const schema = {
      type: 'object',
      required: ['name', 'age'],
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      }
    };
    const fallback = { name: 'Default', age: 0 };
    
    const result = await jsonParserTool.call({
      text: invalidJSON,
      schema,
      fallback
    });
    
    expect(result).toEqual(fallback);
  });
});
