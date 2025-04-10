# Flowlite Article Writer

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)
![Flowlite](https://img.shields.io/badge/powered%20by-Flowlite-orange.svg?style=flat-square)

**Supercharge your content creation with AI-powered article generation!**

Research → Outline → Write → Optimize → Publish

</div>

---

## Features

- **AI-Powered Research** - Automatically gathers facts via Perplexity API
- **SEO Optimization** - Analyzes and improves content for search visibility
- **Professional Copywriting** - Ensures engaging, well-written content
- **Quality Scoring** - Provides detailed SEO and readability metrics
- **Beautiful Markdown** - Generates perfectly formatted articles with metadata
- **Lightning Fast** - Creates publish-ready content in minutes, not hours

## Installation

```bash
# Clone the repository
git clone https://github.com/chadananda/flowkit.git
cd flowkit/example_apps/article-writer

# Install dependencies
npm install

# Set up environment variables
cp .env-example .env
# Edit .env with your API keys
```

## Quick Start

```bash
# Run the article writer
npm start
```

<details>
<summary>The interactive CLI will guide you through the process</summary>

You'll be prompted for:
- Article title
- Main topic
- Target audience
- Keywords
- Tone (Informative, Conversational, Professional)
- Word count

</details>

## How It Works

<div align="center">

```mermaid
graph LR
    A[Research] --> B[Create Outline]
    B --> C[SEO Check]
    C --> D[Copywriting Check]
    D --> E[Generate Content]
    E --> F[Optimize Copy]
    F --> G[Optimize SEO]
    G --> H[Publish]
    
    style A fill:#ff9900,stroke:#333,stroke-width:2px
    style B fill:#42b883,stroke:#333,stroke-width:2px
    style C fill:#1e88e5,stroke:#333,stroke-width:2px
    style D fill:#8e44ad,stroke:#333,stroke-width:2px
    style E fill:#e91e63,stroke:#333,stroke-width:2px
    style F fill:#8e44ad,stroke:#333,stroke-width:2px
    style G fill:#1e88e5,stroke:#333,stroke-width:2px
    style H fill:#4caf50,stroke:#333,stroke-width:2px
```

</div>

The article writer demonstrates Flowlite's powerful chainable workflow capabilities:

1. **Research** - Gathers factual information via Perplexity API (with LLM fallback)
2. **Outline Creation** - Generates structured outline based on research
3. **SEO Check (Outline)** - Analyzes outline for search optimization
4. **Copywriting Check (Outline)** - Ensures engaging structure and flow
5. **Content Generation** - Creates full article based on optimized outline
6. **Copywriting Check (Content)** - Improves readability and engagement
7. **SEO Check (Content)** - Optimizes for search visibility
8. **Output** - Saves as Markdown with metadata

## Flow Implementation

The application showcases Flowlite's elegant chaining capabilities:

```javascript
Flow.start(analyzeRequest)
  .next(performResearch)
  .next(createOutline)
  .next(checkOutlineSEO)
  .next(checkOutlineCopywriting)
  .next(writeArticle)
  .next(checkContentCopywriting)
  .next(checkContentSEO)
  .next(finalizeArticle)
```

## Environment Variables

```
# OpenAI API Key for GPT models
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic API Key for Claude models (optional)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Perplexity API Key for research
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# Default model to use
DEFAULT_MODEL=gpt-4

# Default temperature setting (0.0 - 1.0)
DEFAULT_TEMPERATURE=0.7

# Output directory for generated articles
OUTPUT_DIR=./articles
```

## Development

```bash
# Run tests
npm test
```

## Example Output

Articles are saved as beautiful Markdown files with frontmatter:

<details>
<summary>View sample article output</summary>

```markdown
---
title: "10 Ways AI is Transforming Content Creation"
date: "2025-04-09T20:55:34-07:00"
keywords: ["AI", "content creation", "machine learning", "productivity"]
topic: "AI in Content Creation"
audience: "Marketing professionals"
seoScore: 9.2
copywritingScore: 8.7
---

# 10 Ways AI is Transforming Content Creation

In today's fast-paced digital landscape, content creators are constantly seeking ways to enhance productivity without sacrificing quality. Artificial Intelligence has emerged as a game-changing technology in this domain...

## 1. Automated Research and Fact-Finding

AI-powered tools can now scan thousands of sources in seconds, extracting relevant information and statistics that would take human researchers hours to compile...
```

</details>

## Extending

<details>
<summary>Ways to extend this application</summary>

- Add new quality checks in the flow
- Implement additional research sources
- Create output formats beyond Markdown
- Add publishing capabilities to WordPress, Medium, etc.
- Build a web interface with real-time previews
- Add analytics for content performance tracking

</details>

## Contributing

This project is part of the [Flowlite](https://github.com/chadananda/flowlite) framework. Contributions are welcome!

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request at https://github.com/chadananda/flowlite/pulls

### Development Setup

```bash
# Clone the repository
git clone https://github.com/chadananda/flowkit.git
cd flowkit/example_apps/article-writer

# Install dependencies
npm install

# Run the application
npm start

# Run tests
npm test
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">

### Powered by [Flowlite](https://github.com/chadananda/flowlite)

**Build sophisticated AI workflows with elegant, chainable code**

</div>
