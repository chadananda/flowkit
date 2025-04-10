**Proposal: `flowkit` — A Minimal, Composable, and Powerful JS Framework for Building Multi-Component Programs (MCPs)**

---

## 🔎 Overview

`flowkit` is a lightweight and ergonomic JavaScript/TypeScript framework for building **agentic flows** and **LLM-driven MCPs** with optional persistent state, composable nodes, and powerful control abstractions.

It enables developers to:
- Compose structured, retry-safe LLM calls
- Define compact or extended flows
- Support both stateless and stateful agent logic
- Use shared memory/state for learning or session tracking
- Automatically plan flows from a natural language goal using available tools
- Optionally expand into batch, loop, parallel and nested subflows

---

## 🔧 Core Concepts

### 1. **Node**
Encapsulates a single unit of work.
```js
new Node('summarize', async state => { ... })
```
Supports:
- `run(state)` method
- Per-node max runs
- Outcome routing with `.next()` and `.on(outcome, node)`
- Function inference: `new Node(fn)` auto-names from `fn.name`

### 2. **Flow**
Controls flow execution.
```js
Flow.start(loadPDF)
  .next(ocrTesseract)
  .all([ocrAI1, ocrAI2])
  .next(reconcile)
  .run(state)
```
Supports:
- Compact, chainable syntax
- Branching and looping with `.on(outcome, node)`
- `.all([...])` for parallel execution
- `.tools([...])` for assigning a tool registry
- `.plan(prompt)` for AI-generated flows
- Subflows and nested execution
- Step hooks, timeouts, watchdogs

### 3. **State**
Shared memory object.
```js
state.user = { knownWords: [], quizHistory: [] }
```
Optional wrapper utilities for:
- Namespacing
- Snapshots and rollback
- Memory persistence

### 4. **LLM Call Utility**
Built-in helper for consistent structured output from LLMs.
```js
await callLLM({
  prompt: `Summarize: ${text}`,
  schema: { title: 'string', summary: 'string' },
  retries: 2,
  validate: o => o.title && o.summary
})
```
- JSON formatting hint injection
- Retry with exponential backoff or constant delay
- Auto-validation or user-defined
- Multi-model fallback support
- Optional rate limiting

### 5. **Tool Registry**
Declare and describe callable tools.
```js
registerTool(research, {
  name: 'research',
  description: 'Search and summarize information on a topic',
  inputs: { query: 'string' },
  returns: { summary: 'string' }
})
```
Registered tools can:
- Be referenced in `plan()` calls
- Expose metadata for planning
- Be used directly in nodes or by name

### 6. **Flow Planner (LLM-Guided)**
Generate a runnable Flow based on a prompt and the active tool stack.
```js
Flow.start()
  .tools([loadPDF, ocrTesseract, reconcile])
  .plan("Extract text layer from a PDF using redundant OCR and save PDF/A")
  .run({ path: 'file.pdf' })
```
The planner will:
- Use the provided tool metadata
- Generate a valid sequence of tool calls
- Add branching, retries, and loops if necessary

### 7. **Storage Layer (Optional)**
Built-in support for session persistence.
```js
await storeSession(state, { userId: 'xyz', adapter: 'postgres' })
```
Adapters can be swapped or extended:
- Memory (default)
- PostgreSQL
- Redis
- File system

---

## 🤖 Example Use Case: Stateless API-style MCP
```js
const flow = Flow.start(fetchTask)
  .next(solveTask)
  .next(formatOutput)
  .run({ input })
```

---

## 🧒 Example Use Case: Stateful Tutor
```js
Flow.start(assessKnowledge)
  .next(chooseSkill)
  .next(teachSkill)
  .next(askQuestion)
  .next(reinforce)
  .run(state)
```

---

## 📝 Example Use Case: Article Generation Agent
```js
import { Researcher, ArticlePlanner, ArticleWriter, CopyWriter, ArticleEditor, SEOExpert, FAQWriter } from './articleTools'

Flow.start()
  .tools([Researcher, ArticlePlanner, ArticleWriter, CopyWriter, ArticleEditor, SEOExpert, FAQWriter])
  .plan("Given a writer persona and concept, thoroughly research the topic, write a compelling 2000-word article with title and FAQ. Ensure review by editor, SEO pass, and copy edit. Save to output.")
  .run({ persona, concept, keywords, output: 'article.md' })
```

---

## 🌐 Goals

### ✅ Simplicity First
- Linear flows: `Flow.start(fn).next(fn)...`
- Auto-wiring for `.next()`
- Function name inference for Node ID
- Defaults to stateless but allows long-running state

### 📊 Extendable
- Optional use of `agent()` registry for multi-agent support
- Add `mapReduce()` for batch tasks
- Add `SubFlowNode()` for nested flows
- Add `generateFlow()` for dynamic task planning
- Support `.all([...])` for parallel node execution
- Support `.tools([...])` and `.plan(prompt)` for dynamic AI-based graphs

### 🔒 Safe by Default
- `maxSteps`, `maxRuns`, timeouts
- Retry limits and validation checks
- Shared memory with locking or pruning

### 🌱 Grows With You
- Start simple, stay simple
- Opt into complexity (parallel, RAG, planner, etc.)
- Works well with any LLM, local or cloud

---

## 🔹 MVP Feature Set

- [x] `Node` class with branching and name inference
- [x] `Flow` engine with maxSteps
- [x] Shared mutable state object
- [x] LLM calling helper with schema+validation
- [x] Retry logic for LLMs
- [x] Compact and extended flow DSL with chaining
- [x] Tool registry with metadata
- [ ] Subflows
- [ ] Agent registry (multi-agent model)
- [ ] MapReduce
- [ ] State wrapper for snapshotting/history
- [ ] Built-in debug/log hooks
- [ ] Persistent memory (session storage, Redis)
- [x] `.tools([...])` registry API
- [x] `.plan()` flow generation API
- [ ] `.all([...])` parallel flow control

---

## ✨ Long-Term Vision
- `flowkit-server` for persistent workflows
- Visual editor / inspector / debugger
- Playground for custom LLM + agent flows
- Edge-compatible + server-mode + CLI batch runner
- Optional persistence adapters (Redis, SQLite, Firestore)
- Auto-doc + flow visualization from tool metadata

---

## 🚀 Summary

`flowkit` empowers developers to go from:
- A simple one-shot LLM function
- → to a full-fledged autonomous tutor
- → to an intelligent article writer or assistant

...with a consistent, terse, and extensible syntax designed for real-world iteration.
