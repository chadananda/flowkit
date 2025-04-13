/**
 * Text Chunker Tool Tests
 * Tests the TextChunkerTool functionality for splitting text into overlapping chunks
 */
import { describe, it, expect } from 'vitest';
import { TextChunkerTool } from '../../flowtools.js';

describe('TextChunkerTool', () => {
  let textChunkerTool;
  
  beforeEach(() => {
    textChunkerTool = new TextChunkerTool();
  });
  
  it('should return the original text if it is shorter than maxChunkSize', async () => {
    const shortText = 'This is a short text.';
    const result = await textChunkerTool.call({
      text: shortText,
      maxChunkSize: 100
    });
    
    expect(result).toEqual([shortText]);
  });
  
  it('should split text into chunks of specified size with overlap', async () => {
    // Create a text with 300 characters
    const text = 'A'.repeat(100) + '. ' + 'B'.repeat(100) + '. ' + 'C'.repeat(100);
    
    const result = await textChunkerTool.call({
      text,
      maxChunkSize: 150,
      overlap: 50
    });
    
    // Should create 3 chunks with overlap
    expect(result.length).toBe(3);
    
    // First chunk should contain mostly A's and some B's
    expect(result[0].startsWith('A'.repeat(100))).toBe(true);
    
    // Second chunk should contain mostly B's and some A's and C's
    expect(result[1].includes('A')).toBe(true);
    expect(result[1].includes('B')).toBe(true);
    expect(result[1].includes('C')).toBe(true);
    
    // Third chunk should contain mostly C's and some B's
    expect(result[2].endsWith('C'.repeat(100))).toBe(true);
  });
  
  it('should try to end chunks at sentence boundaries', async () => {
    const text = 'This is sentence one. This is sentence two. This is sentence three.';
    
    const result = await textChunkerTool.call({
      text,
      maxChunkSize: 25,
      overlap: 5
    });
    
    // Should create chunks that end with periods
    expect(result[0].endsWith('.')).toBe(true);
    expect(result[1].endsWith('.')).toBe(true);
  });
  
  it('should try to end chunks at paragraph boundaries', async () => {
    const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
    
    const result = await textChunkerTool.call({
      text,
      maxChunkSize: 20,
      overlap: 5
    });
    
    // Should create chunks that end with newlines when possible
    expect(result.some(chunk => chunk.includes('\n\n'))).toBe(true);
  });
  
  it('should handle text with no natural boundaries', async () => {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(10); // No periods or newlines
    
    const result = await textChunkerTool.call({
      text,
      maxChunkSize: 100,
      overlap: 20
    });
    
    // Should still create chunks of appropriate size
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].length).toBeLessThanOrEqual(100 + 100); // maxChunkSize + potential boundary extension
  });
  
  it('should accept string input directly', async () => {
    const text = 'This is a test string.';
    
    const result = await textChunkerTool.call(text);
    
    expect(result).toEqual([text]);
  });
  
  it('should handle empty text', async () => {
    const result = await textChunkerTool.call({
      text: ''
    });
    
    expect(result).toEqual(['']);
  });
  
  it('should handle very small maxChunkSize', async () => {
    const text = 'This is a test.';
    
    const result = await textChunkerTool.call({
      text,
      maxChunkSize: 2,
      overlap: 0
    });
    
    // Should create many small chunks
    expect(result.length).toBeGreaterThan(5);
  });
  
  it('should handle zero overlap', async () => {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(4);
    
    const result = await textChunkerTool.call({
      text,
      maxChunkSize: 26,
      overlap: 0
    });
    
    // Should create 4 chunks with no overlap
    expect(result.length).toBe(4);
    expect(result[0]).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(result[1]).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });
  
  it('should handle overlap larger than maxChunkSize', async () => {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(4);
    
    const result = await textChunkerTool.call({
      text,
      maxChunkSize: 26,
      overlap: 30 // Overlap larger than chunk size
    });
    
    // Should still create chunks, but with full overlap
    expect(result.length).toBeGreaterThan(1);
  });
});
