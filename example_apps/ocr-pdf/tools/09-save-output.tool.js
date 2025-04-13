/**
 * 09-save-output.tool.js - Save output files to S3 or local storage
 * 
 * This tool uploads both the PDF/A document and ZIP archive to an S3-compatible
 * storage with 24-hour expiration, returning temporary URLs for access.
 * Alternately outputs to file.
 */
import { Tool } from '../../../flowlite.js';
import fs from 'fs-extra';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const saveOutputTool = new class extends Tool {
  constructor() {
    super({
      name: 'saveOutput',
      description: 'Save output files to S3 or local storage',
      input: [
        { name: 'pdfaPath', description: 'Path to PDF/A-3 compliant document' },
        { name: 'zipPath', description: 'Path to ZIP archive with markdown content' },
        { name: 'outputPath', description: 'Path to output PDF file' },
        { name: 'useS3', description: 'Whether to upload to S3', default: false }
      ],
      output: [
        { name: 'pdfUrl', description: 'URL to PDF/A-3 compliant document' },
        { name: 'zipUrl', description: 'URL to ZIP archive with markdown content' }
      ]
    });
  }

  async execute({ pdfaPath, zipPath, outputPath, useS3 = false, ...rest }) {
    if (!pdfaPath) {
      return { 
        error: 'PDF/A path is required',
        ...rest
      };
    }

    if (!zipPath) {
      return { 
        error: 'ZIP path is required',
        ...rest
      };
    }

    try {
      // Check if files exist
      if (!await fs.pathExists(pdfaPath)) {
        return {
          error: `PDF/A file not found: ${pdfaPath}`,
          ...rest
        };
      }
      
      if (!await fs.pathExists(zipPath)) {
        return {
          error: `ZIP file not found: ${zipPath}`,
          ...rest
        };
      }
      
      // If using S3, upload files and generate URLs
      if (useS3) {
        // Get S3 credentials from environment variables
        const s3AccessKey = process.env.AWS_ACCESS_KEY_ID;
        const s3SecretKey = process.env.AWS_SECRET_ACCESS_KEY;
        const s3Bucket = process.env.S3_BUCKET;
        const s3Region = process.env.S3_REGION || 'us-east-1';
        
        if (!s3AccessKey || !s3SecretKey || !s3Bucket) {
          return {
            error: 'S3 credentials not found in environment variables',
            ...rest
          };
        }
        
        // Initialize S3 client
        const s3Client = new S3Client({
          region: s3Region,
          credentials: {
            accessKeyId: s3AccessKey,
            secretAccessKey: s3SecretKey
          }
        });
        
        // Generate unique keys for the files
        const timestamp = Date.now();
        const pdfKey = `ocr-pdf/${path.basename(pdfaPath)}-${timestamp}`;
        const zipKey = `ocr-pdf/${path.basename(zipPath)}-${timestamp}`;
        
        // Upload PDF/A file
        const pdfContent = await fs.readFile(pdfaPath);
        const pdfCommand = new PutObjectCommand({
          Bucket: s3Bucket,
          Key: pdfKey,
          Body: pdfContent,
          ContentType: 'application/pdf',
          ContentDisposition: `attachment; filename="${path.basename(pdfaPath)}"`,
          Expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
        
        await s3Client.send(pdfCommand);
        
        // Upload ZIP file
        const zipContent = await fs.readFile(zipPath);
        const zipCommand = new PutObjectCommand({
          Bucket: s3Bucket,
          Key: zipKey,
          Body: zipContent,
          ContentType: 'application/zip',
          ContentDisposition: `attachment; filename="${path.basename(zipPath)}"`,
          Expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
        
        await s3Client.send(zipCommand);
        
        // Generate signed URLs with 24-hour expiration
        const pdfUrl = await getSignedUrl(s3Client, new PutObjectCommand({
          Bucket: s3Bucket,
          Key: pdfKey
        }), { expiresIn: 24 * 60 * 60 }); // 24 hours
        
        const zipUrl = await getSignedUrl(s3Client, new PutObjectCommand({
          Bucket: s3Bucket,
          Key: zipKey
        }), { expiresIn: 24 * 60 * 60 }); // 24 hours
        
        return {
          pdfUrl,
          zipUrl,
          success: true,
          ...rest
        };
      } else {
        // Just return the local file paths
        return {
          pdfUrl: `file://${pdfaPath}`,
          zipUrl: `file://${zipPath}`,
          success: true,
          ...rest
        };
      }
    } catch (error) {
      return {
        error: `Saving output failed: ${error.message}`,
        success: false,
        ...rest
      };
    }
  }
}();
