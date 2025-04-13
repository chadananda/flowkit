/**
 * Prompt Template Tool Tests
 * Tests the PromptTemplateTool functionality for filling templates with variables
 */
import { describe, it, expect } from 'vitest';
import { PromptTemplateTool } from '../../flowtools.js';

describe('PromptTemplateTool', () => {
  let promptTemplateTool;
  
  beforeEach(() => {
    promptTemplateTool = new PromptTemplateTool();
  });
  
  it('should fill a template with simple variables', async () => {
    const template = 'Hello, {{name}}!';
    const variables = { name: 'World' };
    
    const result = await promptTemplateTool.call({
      template,
      variables
    });
    
    expect(result).toBe('Hello, World!');
  });
  
  it('should fill a template with multiple variables', async () => {
    const template = 'My name is {{name}} and I am {{age}} years old.';
    const variables = { name: 'John', age: 30 };
    
    const result = await promptTemplateTool.call({
      template,
      variables
    });
    
    expect(result).toBe('My name is John and I am 30 years old.');
  });
  
  it('should handle nested variables', async () => {
    const template = 'User: {{user.name}}, Role: {{user.profile.role}}';
    const variables = {
      user: {
        name: 'Alice',
        profile: {
          role: 'Admin'
        }
      }
    };
    
    const result = await promptTemplateTool.call({
      template,
      variables
    });
    
    expect(result).toBe('User: Alice, Role: Admin');
  });
  
  it('should handle array variables', async () => {
    const template = 'Items: {{items.0}}, {{items.1}}, {{items.2}}';
    const variables = {
      items: ['Apple', 'Banana', 'Cherry']
    };
    
    const result = await promptTemplateTool.call({
      template,
      variables
    });
    
    expect(result).toBe('Items: Apple, Banana, Cherry');
  });
  
  it('should handle missing variables', async () => {
    const template = 'Hello, {{name}}! Your age is {{age}}.';
    const variables = { name: 'John' }; // age is missing
    
    const result = await promptTemplateTool.call({
      template,
      variables
    });
    
    expect(result).toBe('Hello, John! Your age is .');
  });
  
  it('should handle custom delimiters', async () => {
    const template = 'Hello, {name}! Your age is {age}.';
    const variables = { name: 'John', age: 30 };
    const delimiters = ['{', '}'];
    
    const result = await promptTemplateTool.call({
      template,
      variables,
      delimiters
    });
    
    expect(result).toBe('Hello, John! Your age is 30.');
  });
  
  it('should handle empty template', async () => {
    const template = '';
    const variables = { name: 'John' };
    
    const result = await promptTemplateTool.call({
      template,
      variables
    });
    
    expect(result).toBe('');
  });
  
  it('should handle template with no variables', async () => {
    const template = 'This is a static template with no variables.';
    const variables = { name: 'John' };
    
    const result = await promptTemplateTool.call({
      template,
      variables
    });
    
    expect(result).toBe('This is a static template with no variables.');
  });
  
  it('should handle null or undefined variables', async () => {
    const template = 'Name: {{name}}, Age: {{age}}, Active: {{isActive}}';
    const variables = { name: 'John', age: null, isActive: undefined };
    
    const result = await promptTemplateTool.call({
      template,
      variables
    });
    
    expect(result).toBe('Name: John, Age: , Active: ');
  });
  
  it('should handle boolean and numeric variables', async () => {
    const template = 'Age: {{age}}, Active: {{isActive}}, Score: {{score}}';
    const variables = { age: 30, isActive: true, score: 0 };
    
    const result = await promptTemplateTool.call({
      template,
      variables
    });
    
    expect(result).toBe('Age: 30, Active: true, Score: 0');
  });
  
  it('should handle complex templates with multiple occurrences of the same variable', async () => {
    const template = '{{name}} is {{age}} years old. Hello, {{name}}!';
    const variables = { name: 'John', age: 30 };
    
    const result = await promptTemplateTool.call({
      template,
      variables
    });
    
    expect(result).toBe('John is 30 years old. Hello, John!');
  });
});
