/**
 * memory.js - Memory management tools for Flowkit
 * 
 * This module provides memory management utilities for LLM-powered agent flows,
 * allowing agents to store and retrieve information across multiple interactions.
 */

import { registerTool } from './flowkit.js';

/**
 * Creates a memory store for persisting data across flow executions
 * @returns {Function} A memory function that can store and retrieve values
 */
export const createMemoryStore = () => {
  const store = new Map();
  
  const memoryTool = registerTool(
    (key, value) => {
      // If value is undefined, retrieve the stored value
      if (value === undefined) {
        const storedValue = store.get(key);
        // Return a deep copy to prevent unintended mutations
        return storedValue !== undefined ? JSON.parse(JSON.stringify(storedValue)) : undefined;
      }
      
      // Store the value (as a deep copy)
      store.set(key, JSON.parse(JSON.stringify(value)));
      return true;
    },
    {
      name: 'memory',
      description: 'Store and retrieve values from memory',
      parameters: ['key', 'value?']
    }
  );
  
  // Add additional methods
  memoryTool.getAll = () => Object.fromEntries(store.entries());
  memoryTool.clear = () => store.clear();
  memoryTool.has = key => store.has(key);
  memoryTool.delete = key => store.delete(key);
  memoryTool.size = () => store.size;
  
  return memoryTool;
};

/**
 * Creates a conversation memory for storing chat history
 * @param {Object} options Configuration options
 * @param {number} options.maxMessages Maximum number of messages to store (default: 100)
 * @returns {Object} Conversation memory object with methods to manage chat history
 */
export const createConversationMemory = (options = {}) => {
  const { maxMessages = 100 } = options;
  const messages = [];
  
  return registerTool({
    addMessage: (role, content) => {
      const message = { role, content, timestamp: Date.now() };
      messages.push(message);
      
      // Trim if exceeding max size
      if (messages.length > maxMessages) {
        messages.shift();
      }
      
      return message;
    },
    
    getMessages: (limit) => {
      if (limit && typeof limit === 'number') {
        return [...messages].slice(-limit);
      }
      return [...messages];
    },
    
    clear: () => {
      messages.length = 0;
      return true;
    },
    
    getLastMessage: () => {
      return messages.length > 0 ? messages[messages.length - 1] : null;
    },
    
    getMessagesByRole: (role) => {
      return messages.filter(msg => msg.role === role);
    },
    
    size: () => messages.length
  }, {
    name: 'conversationMemory',
    description: 'Manage conversation history for LLM-powered agents'
  });
};

/**
 * Creates a vector store for semantic search capabilities
 * Note: This is a simple implementation - for production use, consider using
 * dedicated vector databases or libraries
 * @returns {Object} Vector store object with methods for storing and retrieving embeddings
 */
export const createVectorStore = () => {
  const vectors = [];
  
  // Simple dot product for cosine similarity
  const dotProduct = (vecA, vecB) => {
    return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
  };
  
  // Normalize a vector (L2 norm)
  const normalize = (vec) => {
    const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    return vec.map(val => val / magnitude);
  };
  
  // Calculate cosine similarity between two vectors
  const cosineSimilarity = (vecA, vecB) => {
    const normA = normalize(vecA);
    const normB = normalize(vecB);
    return dotProduct(normA, normB);
  };
  
  return registerTool({
    // Add a vector with associated metadata
    addVector: (vector, metadata = {}) => {
      vectors.push({ vector, metadata, id: crypto.randomUUID() });
      return vectors.length - 1;
    },
    
    // Find similar vectors based on cosine similarity
    findSimilar: (queryVector, limit = 5, threshold = 0.7) => {
      const results = vectors
        .map(item => ({
          ...item,
          similarity: cosineSimilarity(queryVector, item.vector)
        }))
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      return results;
    },
    
    // Get all vectors
    getAll: () => [...vectors],
    
    // Clear all vectors
    clear: () => {
      vectors.length = 0;
      return true;
    },
    
    // Delete a vector by ID
    delete: (id) => {
      const index = vectors.findIndex(v => v.id === id);
      if (index !== -1) {
        vectors.splice(index, 1);
        return true;
      }
      return false;
    },
    
    // Get vector count
    size: () => vectors.length
  }, {
    name: 'vectorStore',
    description: 'Store and retrieve vector embeddings for semantic search'
  });
};

// Export all memory tools
export const memoryTools = {
  createMemoryStore,
  createConversationMemory,
  createVectorStore
};
