# OCR PDF Example App

This is an example application built with the Flowkit framework that demonstrates how to create a PDF OCR processing pipeline.

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
npm run ocr ./input.pdf ./output.pdf
```

Or directly with:

```
node index.js ./input.pdf ./output.pdf
```

From the parent directory, you can also run:

```
npm run ocr ./input.pdf ./output.pdf
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

This example demonstrates several Flowkit features:
- Linear flows with `Flow.start().next()`
- Parallel processing with `.all([])`
- Batch processing with `mapReduce()`
- Tool registration with `.tools([])`
- Shared state management

Some OCR integrations are implemented as placeholders and would need to be completed for production use.
