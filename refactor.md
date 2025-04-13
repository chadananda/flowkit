Migration Instructions: Converting Flowlite to Tool-Centric Architecture
Why Make This Change
This migration transforms the Flowlite architecture from a dedicated Flow orchestrator to a tool-centric chaining approach, offering:

A simplified mental model ("this, then that") for developers
Reduced boilerplate and fewer abstractions
A familiar pattern resembling JavaScript Promises
Better composability of flows and improved reusability
A more intuitive and expressive API

Core Architecture Changes

Make the base Tool class chainable with methods like then(), branch(), and switch()
Add a FlowRegistry to manage named segments for complex flows
Modify execution logic to support both linear chaining and non-linear jumps
Ensure tool metadata is propagated correctly for API discovery

Detailed Migration Steps
1. Enhance the Base Tool Class

Add properties for chaining: nextTools, branchConfig, switchConfig, and errorHandler
Implement then(nextTool, options) method for linear chaining
Add catch(handler) for error handling
Implement branching methods: branch(condition, truePath, falsePath) and switch(key, cases, defaultCase)
Modify the call() method to handle chain execution, branching logic, and error handling

2. Create a FlowRegistry for Non-Linear Navigation

Implement a registry to track tools by ID and labeled segments
Add support for goto operations between different parts of a flow
Support conditional jumps with gotoIf() functionality

3. Modify Existing Flow API (Optional Compatibility Layer)

Update the existing Flow class to use the new Tool chaining internally
Maintain backward compatibility for existing flows
Add conversion methods: flow.toToolChain() and Tool.fromFlow(flow)

4. Update Core Tools

Ensure all existing tools work with the new chaining pattern
Update tools to propagate state correctly between chain links
Add specialized junction tools for complex convergence patterns

5. Update Documentation and Examples

Create new examples showing the tool-centric approach
Document the transition from Flow objects to tool chains
Provide patterns for common scenarios: sequential, conditional, loops

Test Migration Strategy

Create parallel implementations for critical flows
Update test fixtures to work with both approaches during transition
Add specific tests for new chaining features:

Test sequential chaining behavior
Test conditional branching and convergence
Test error handling within chains
Test complex non-linear flows with goto operations


Ensure backward compatibility for existing flows

Implementation Notes

Maintain the same state management principles throughout the chain
Ensure proper handling of input/output mappings between tools
Consider performance impacts for long chains
Preserve metadata for tool discovery and reflection

These instructions provide a comprehensive roadmap for transitioning Flowlite to a more intuitive, chainable architecture while maintaining compatibility with existing code.