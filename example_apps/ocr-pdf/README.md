# OCR PDF Example App

This is an example application built with the Flowlite framework that demonstrates how to create a PDF OCR processing pipeline.

## Features

- Load and process PDF files
- Extract text using multiple OCR engines:
  - Tesseract.js (local)
  - Google Cloud Vision API
  - ABBYY OCR API (placeholder)
  - Mistral AI OCR (placeholder)
- Reconcile results using Claude API (placeholder)
- Generate a new PDF with the extracted text
- Parallel processing of PDF pages

## Flow Architecture

```ditaa
+---------------+      +---------------+      +---------------+
| Input PDF     |----->| Load PDF      |----->| Extract Pages |
|               |      |               |      |               |
+---------------+      +---------------+      +---------------+
                                                     |
                                                     v
                                             +---------------+
                                             | Process Pages |
                                             | (Parallel)    |
                                             +---------------+
                                                     |
                                                     v
+---------------+      +---------------+      +---------------+
| Output PDF    |<-----| Merge Pages   |<-----| OCR Processing|
|               |      |               |      | Pipeline      |
+---------------+      +---------------+      +---------------+
                                                     ^
                                                     |
                       +---------------+      +---------------+
                       | Reconcile     |<-----| Multiple OCR  |
                       | Results       |      | Engines       |
                       +---------------+      +---------------+
```

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Set up your API keys:
   - Copy `.env-example` to `.env`
   - Add your API keys to the `.env` file

3. For Google Cloud Vision API:
   - Go to https://console.cloud.google.com/
   - Create a project and enable the Vision API
   - Create a service account and download the credentials JSON
   - Either export the credentials:
     ```bash
     export GOOGLE_APPLICATION_CREDENTIALS=./gcloud-key.json
     ```
     Or use the `@google-cloud/vision` SDK with an explicit client config

## Usage

Run the OCR tool with:

```
npm start ./input.pdf ./output.pdf
```

Or directly with:

```
node index.js ./input.pdf ./output.pdf
```

## Project Structure

```
ocr-pdf/
├── ocr-pdf.flow.js     # Flow definition and tool implementations
├── index.js            # CLI interface
├── utils.js            # Utility functions
├── package.json        # Project configuration
└── .env                # Environment variables
```

## Output

The tool will display progress information:

```
[INFO] Processing: input.pdf
[INFO] Page 1 saved to output.pdf
[INFO] Page 2 saved to output.pdf
[DONE] Wrote 2 pages to output.pdf
```

## Implementation Notes

This example demonstrates several Flowlite features:

### Ultra-Compact Tool Definitions

```javascript
// Ultra-compact tool definition using class expression
const tesseractOCRTool = new class extends Tool {
  constructor() {
    super({
      name: 'ocrTesseract',
      description: 'Extract text using Tesseract OCR',
      input: [
        param('page', ParamType.OBJECT, 'PDF page object'),
        param('pageNum', ParamType.NUMBER, 'Page number')
      ]
    });
  }
  
  async execute({ page, pageNum }) {
    // Implementation...
  }
}();
```

### Elegant Flow Composition

```javascript
// Ultra-compact OCR PDF flow
export const ocrPDFFlow = Flow.create({
  name: 'ocrPDF',
  input: [
    param('inputPath', ParamType.STRING, 'Input PDF path'),
    param('outputPath', ParamType.STRING, 'Output PDF path')
  ]
})
.next(async ({ inputPath, outputPath }) => {
  // Load the PDF...
})
.next(async (state) => {
  // Process pages in parallel...
});
```

### Key Patterns Demonstrated

- Class-based tool inheritance with `Tool`, `APITool`, and `LLMTool`
- Parallel processing with `Promise.all()`
- Chainable configuration with `withApiKey()` and other methods
- Structured error handling and logging
- Clean separation of flow logic from CLI interface

Some OCR integrations are implemented as placeholders and would need to be completed for production use.
