# OCR-PDF Flow Plan

### 1. "setup"
- **Tech:** `tempy`, `fs-extra`
- **Input:** Original PDF file path
- **Output:** Temp directory structure
- **Process:** Creates temporary working directories for processing the PDF book, including folders for raw pages, OCR results, and processed output.

### 2. "splitPDF"
- **Tech:** `pdf-lib`, `fs-extra`
- **Input:** Original PDF file
- **Output:** Individual PDF pages in temp directory
- **Process:** Splits the input PDF book into individual page PDFs saved in the raw_pages folder for parallel processing.

### 3. "initialContext"
- **Tech:** `node-tesseract-ocr`, `@anthropic/sdk`
- **Input:** First 20 pages from /raw_pages
- **Output:** Initial context JSON object
- **Process:** Runs local Tesseract OCR on first 20 pages of book, then uses Claude 3.7 to extract key context information like characters, locations, and document style.

### 4. "pageOCR"
- **Tech:**
  - Google Cloud Vision: `@google-cloud/vision`
  - ABBYY Cloud OCR: `abbyy-ocr-ts`
  - Mistral OCR: `@mistralai/mistralai`
- **Input:** Page image, page number, context
- **Output:** Three JSON results and MD files per page
- **Process:** Processes each page through three different OCR engines in parallel to get multiple text recognition results, storing each as JSON and generating initial markdown versions. Massively parallel operation.

### 5. "pageReconciliation"
- **Tech:** `@anthropic/sdk`
- **Input:** Three OCR JSON results + context + adjacent page MDs
- **Output:** Corrected JSON and MD for each page
- **Process:** Uses Claude 3.7 to compare results from the three OCR engines, combining their strengths and correcting errors based on context to produce accurate text output.

### 6. "addContext"
- **Tech:** `@anthropic/sdk`
- **Input:** Page MD files, context object
- **Output:** Enhanced MD with context tags
- **Process:** Enhances the markdown by adding semantic context tags for entity and reference disambiguation, merging split paragraphs across pages, and adding page position references.
- **Tag Types:**
  - Page numbers: `<pg num="10" />`
  - PDF positions: `<pdf pg="3" />`
  - Entity disambiguation: `<ctx data="Hussein Khan, the leader of the rebellion" />`
  - Location references: `<ctx data="Isfahan" />`
  - Temporal references: `<ctx data="June 12, 1845" />`

### 7. "pdfaAssembly"
- **Tech:** `pdf-lib`, `pdf-merger-js`
- **Input:** Original PDF pages + corrected text
- **Output:** PDF/A-3 compliant document
- **Process:** Creates a PDF/A-3 compliant document by merging the original page images with the corrected text layer, ensuring the document is searchable and preserves visual fidelity.

### 8. "packageMD"
- **Tech:** `archiver`, `fs-extra`
- **Input:** MD files + images + context
- **Output:** ZIP archive with complete markdown folder
- **Process:** Packages all markdown content, embedded images, and context information into a ZIP archive for easy distribution and use.

### 9. "saveOutput"
- **Tech:** `@aws-sdk/client-s3`
- **Input:** PDF/A file + ZIP archive
- **Output:** Temporary URLs for both files
- **Process:** Uploads both the PDF/A document and ZIP archive to an S3-compatible storage with 24-hour expiration, returning temporary URLs for access. Alternately outputs to file.

### 10. "cleanup"
- **Tech:** `fs-extra`, `tempy`
- **Input:** Temp directory paths
- **Output:** Successfully deleted files/directories
- **Process:** Removes all temporary files and directories created during processing to reclaim disk space and maintain system health.