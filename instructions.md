# Setup Instructions: Flowkit + OCR CLI Example

## 1. Project Layout

Inside your main `flowkit/` directory, create the following structure:

```
flowkit/
├── flowkit.js                # Core Flowkit framework implementation
├── README.md                 # Project overview
├── project.md                # Technical design document
└── example_apps/
    └── ocr_pdf/
        ├── index.js          # CLI entry point
        ├── tools.js          # OCR tool API wrappers
        ├── utils.js          # Shared logger/output helpers
        └── .env-example      # Template for required API keys
```

## 2. Flowkit Framework (flowkit.js)

Implement the core Flowkit functionality in `flowkit.js`, including:
- `Node` class
- `Flow` class with methods: `.start()`, `.next()`, `.on()`, `.all()`, `.tools()`, `.run()`
- `mapReduce()` utility function
- Shared `state` object
- Basic routing, max run safety, and debug logging hooks

The framework should support chaining, tool injection, and state mutation.

## 3. Example CLI App (ocr_pdf)

### Install Dependencies:

From the `ocr_pdf` directory, run:

```
npm init -y
npm install dotenv pdfjs-dist tesseract.js chalk @google-cloud/vision axios
```

### Setup Environment Variables:

Create `.env-example` with the following contents:

```
ABBYY_API_KEY=your-abbyy-key
GOOGLE_CLOUD_VISION_KEY=your-google-key
MISTRAL_API_KEY=your-mistral-key
ANTHROPIC_API_KEY=your-claude-key
```

Copy it to `.env` and fill in your API keys.

### Google Cloud Vision API Setup:

1. Go to https://console.cloud.google.com/
2. Create a project and enable the Vision API
3. Create a service account and download the credentials JSON
4. Either export the credentials:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=./gcloud-key.json
   ```
   Or use the `@google-cloud/vision` SDK with an explicit client config

### Mistral OCR API:

If using an OCR wrapper around Mistral:
- Use `axios` to POST image data
- Include the API key from your `.env`
- Example endpoint: `https://api.mistral.ai/v1/ocr`

## 4. Create `utils.js`

Add logging utilities using `chalk` to color output (e.g. `[INFO]`, `[DONE]`, `[ERR]`).

## 5. Create `tools.js`

Add wrappers for:
- `loadPDF()` (simulate or use pdfjs-dist)
- `ocrTesseract()`
- `abbyyOCR()`
- `mistralOCR()`
- `googleVisionOCR()`
- `claudeReconciler()`
- `generatePDFPage()`
- `mergePDFPages()`

These tools should be injectable via `.tools()` and support structured input/output.

## 6. Create `index.js`

This will:
- Load the Flowkit framework
- Register tools
- Use `mapReduce()` with `concurrency: 10`
- Process pages in parallel but output them sequentially
- Accept input/output file paths from CLI args

Run the CLI with:

```
node index.js ./input.pdf ./output.pdf
```

It should display:
```
[INFO] Processing: input.pdf
[INFO] Page 1 saved to output.pdf
[INFO] Page 2 saved to output.pdf
[DONE] Wrote 2 pages to output.pdf
```

This app acts as both a test case for Flowkit and a working OCR post-processing pipeline.
