/**
 * tool-chain-example.js - Demonstrates the new tool-centric approach in Flowlite
 * 
 * This example shows how to use the chainable API to create flexible, expressive workflows
 * with minimal boilerplate. It covers:
 * 
 * 1. Basic tool chaining with .then()
 * 2. Conditional branching with .branch()
 * 3. Multi-path routing with .switch()
 * 4. Error handling with .catch()
 * 5. Non-linear navigation with FlowRegistry
 */
import { Tool, LLMTool, param, ParamType, flowRegistry } from '../flowlite.js';
import chalk from 'chalk';

// Create some simple tools to demonstrate the chainable API
const fetchDataTool = new Tool({ 
  name: 'fetchData',
  description: 'Fetch data from an API or database'
})
.withExecute(async ({ dataSource, query, ...state }) => {
  console.log(chalk.blue(`🔍 Fetching data from ${dataSource} with query: ${query}`));
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return simulated data
  return { 
    ...state,
    data: {
      results: ['Result 1', 'Result 2', 'Result 3'],
      count: 3,
      source: dataSource,
      query
    }
  };
});

const processDataTool = new Tool({
  name: 'processData',
  description: 'Process the fetched data'
})
.withExecute(async ({ data, processingType = 'standard', ...state }) => {
  console.log(chalk.green(`⚙️ Processing data with ${processingType} processing`));
  
  // Simulate processing
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Return processed data
  return {
    ...state,
    processedData: {
      ...data,
      processed: true,
      processingType,
      timestamp: new Date().toISOString()
    }
  };
});

const formatResultTool = new Tool({
  name: 'formatResult',
  description: 'Format the processed data'
})
.withExecute(async ({ processedData, format = 'json', ...state }) => {
  console.log(chalk.magenta(`📋 Formatting results as ${format}`));
  
  // Simulate formatting
  await new Promise(resolve => setTimeout(resolve, 200));
  
  let formattedData;
  
  switch (format) {
    case 'json':
      formattedData = JSON.stringify(processedData, null, 2);
      break;
    case 'text':
      formattedData = `Results from ${processedData.source}:\n` +
        processedData.results.map(r => `- ${r}`).join('\n');
      break;
    case 'html':
      formattedData = `<div class="results">
  <h2>Results from ${processedData.source}</h2>
  <ul>
    ${processedData.results.map(r => `<li>${r}</li>`).join('\n    ')}
  </ul>
</div>`;
      break;
    default:
      formattedData = processedData;
  }
  
  return {
    ...state,
    formattedData,
    format
  };
});

const saveResultTool = new Tool({
  name: 'saveResult',
  description: 'Save the formatted result'
})
.withExecute(async ({ formattedData, destination = 'console', ...state }) => {
  console.log(chalk.yellow(`💾 Saving result to ${destination}`));
  
  // Simulate saving
  await new Promise(resolve => setTimeout(resolve, 300));
  
  if (destination === 'console') {
    console.log('\nResult:');
    console.log(chalk.cyan('='.repeat(50)));
    console.log(formattedData);
    console.log(chalk.cyan('='.repeat(50)));
  } else {
    console.log(`Result would be saved to ${destination}`);
  }
  
  return {
    ...state,
    saved: true,
    destination
  };
});

const errorTool = new Tool({
  name: 'errorTool',
  description: 'A tool that always throws an error'
})
.withExecute(async ({ errorMessage = 'Something went wrong', ...state }) => {
  throw new Error(errorMessage);
});

// Example 1: Basic Tool Chaining with then()
console.log(chalk.bold('\n📚 Example 1: Basic Tool Chaining'));
const basicChain = fetchDataTool
  .then(processDataTool)
  .then(formatResultTool)
  .then(saveResultTool);

// Example 2: Conditional Branching with branch()
console.log(chalk.bold('\n📚 Example 2: Conditional Branching'));
const branchingChain = fetchDataTool
  .then(processDataTool)
  .branch(
    // Condition function
    (state) => state.processedData.count > 2,
    // True branch
    formatResultTool.withExecute(async (state) => {
      console.log(chalk.green('✅ Many results found, using detailed format'));
      return { ...state, format: 'html' };
    })
    .then(saveResultTool),
    // False branch
    formatResultTool.withExecute(async (state) => {
      console.log(chalk.yellow('⚠️ Few results found, using simple format'));
      return { ...state, format: 'text' };
    })
    .then(saveResultTool)
  );

// Example 3: Multi-path Routing with switch()
console.log(chalk.bold('\n📚 Example 3: Multi-path Routing'));
const switchChain = fetchDataTool
  .then(processDataTool)
  .switch(
    // Selector function
    (state) => state.processedData.count,
    // Cases
    {
      0: new Tool({ name: 'noResults' })
        .withExecute(async (state) => {
          console.log(chalk.red('❌ No results found'));
          return { ...state, status: 'empty' };
        }),
      1: formatResultTool.withExecute(async (state) => {
        console.log(chalk.yellow('⚠️ Single result found, using simple format'));
        return { ...state, format: 'text' };
      }),
      default: formatResultTool.withExecute(async (state) => {
        console.log(chalk.green('✅ Multiple results found, using detailed format'));
        return { ...state, format: 'html' };
      })
    }
  )
  .then(saveResultTool);

// Example 4: Error Handling with catch()
console.log(chalk.bold('\n📚 Example 4: Error Handling'));
const errorHandlingChain = fetchDataTool
  .then(errorTool)
  .catch(async (error, state) => {
    console.error(chalk.red(`❌ Error caught: ${error.message}`));
    console.log(chalk.yellow('⚠️ Continuing with fallback data'));
    
    return { 
      ...state, 
      processedData: {
        results: ['Fallback Result'],
        count: 1,
        source: state.dataSource || 'fallback',
        processed: true,
        error: error.message
      }
    };
  })
  .then(formatResultTool)
  .then(saveResultTool);

// Example 5: Non-linear Navigation with FlowRegistry
console.log(chalk.bold('\n📚 Example 5: Non-linear Navigation'));

// Register segments
flowRegistry.createSegment('fetch', fetchDataTool);
flowRegistry.createSegment('process', processDataTool);
flowRegistry.createSegment('format', formatResultTool);
flowRegistry.createSegment('save', saveResultTool);
flowRegistry.createSegment('error', errorTool);

// Create a tool that uses the registry for non-linear navigation
const nonLinearChain = new Tool({
  name: 'nonLinearFlow',
  description: 'Demonstrates non-linear navigation'
})
.withExecute(async (initialState) => {
  console.log(chalk.blue('🚀 Starting non-linear flow'));
  
  // Start with the fetch segment
  return { _goto: 'fetch', ...initialState };
});

// Run the examples
const runExamples = async () => {
  try {
    // Example 1: Basic Tool Chaining
    console.log(chalk.bold.blue('\n🔍 Running Example 1: Basic Tool Chaining'));
    await basicChain.call({
      dataSource: 'api.example.com',
      query: 'flowlite',
      format: 'json',
      destination: 'console'
    });
    
    // Example 2: Conditional Branching
    console.log(chalk.bold.blue('\n🔍 Running Example 2: Conditional Branching'));
    await branchingChain.call({
      dataSource: 'api.example.com',
      query: 'flowlite branching',
      destination: 'console'
    });
    
    // Example 3: Multi-path Routing
    console.log(chalk.bold.blue('\n🔍 Running Example 3: Multi-path Routing'));
    await switchChain.call({
      dataSource: 'api.example.com',
      query: 'flowlite switch',
      destination: 'console'
    });
    
    // Example 4: Error Handling
    console.log(chalk.bold.blue('\n🔍 Running Example 4: Error Handling'));
    await errorHandlingChain.call({
      dataSource: 'api.example.com',
      query: 'flowlite error',
      errorMessage: 'Simulated error for demonstration',
      destination: 'console'
    });
    
    // Example 5: Non-linear Navigation
    console.log(chalk.bold.blue('\n🔍 Running Example 5: Non-linear Navigation'));
    
    // This will start at 'fetch' and then follow the normal flow
    let result = await flowRegistry.execute('fetch', {
      dataSource: 'api.example.com',
      query: 'flowlite registry',
      format: 'text',
      destination: 'console'
    });
    
    // Demonstrate jumping to a specific segment
    console.log(chalk.bold.yellow('\n🔄 Jumping directly to format segment'));
    result = await flowRegistry.execute('format', {
      processedData: {
        results: ['Direct Jump Result 1', 'Direct Jump Result 2'],
        count: 2,
        source: 'direct-jump',
        processed: true
      },
      format: 'html',
      destination: 'console'
    });
    
  } catch (error) {
    console.error(chalk.bold.red(`❌ Unhandled error: ${error.message}`));
  }
};

// Run all examples
runExamples();

// Export the example chains for testing or reuse
export {
  basicChain,
  branchingChain,
  switchChain,
  errorHandlingChain,
  nonLinearChain
};
