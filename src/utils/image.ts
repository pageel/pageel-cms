
/**
 * Processes an image file: resizes if it exceeds a maximum width and/or compresses
 * if it exceeds a maximum file size (in KB).
 * Preserves the original file format (extension/MIME type).
 *
 * @param file The original image file.
 * @param maxSizeKB The maximum desired file size in Kilobytes.
 * @param maxWidth The maximum desired width in pixels. A value of 0 means no resizing.
 * @param quality The quality level for compression (0.0 to 1.0).
 * @returns A promise that resolves to the processed file, or the original file if no processing was needed.
 */
export const compressImage = (
  file: File,
  maxSizeKB: number,
  maxWidth: number,
  quality = 0.85
): Promise<File> => {
  // 1. Skip if not an image
  if (!file.type.startsWith('image/')) {
    return Promise.resolve(file);
  }

  // 2. Skip GIFs to preserve animation (Canvas destroys GIF frames)
  if (file.type === 'image/gif') {
    return Promise.resolve(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(img.src);

      // Check criteria
      const needsResize = maxWidth > 0 && img.width > maxWidth;
      const needsCompress = file.size > maxSizeKB * 1024;

      if (!needsResize && !needsCompress) {
        return resolve(file);
      }
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('Failed to get canvas context.'));
      }

      let targetWidth = img.width;
      let targetHeight = img.height;

      // Calculate new dimensions
      if (needsResize) {
        targetWidth = maxWidth;
        targetHeight = img.height * (maxWidth / img.width);
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // Draw image
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Determine output format (keep original)
      // Note: 'image/jpg' isn't standard, browser uses 'image/jpeg'
      const outputType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Canvas to Blob conversion failed.'));
          }
          
          // If the "compressed" blob is actually larger than the original, revert to original
          // This happens often with PNGs if the content is complex and we aren't resizing
          if (blob.size > file.size && !needsResize) {
             resolve(file);
             return;
          }

          // Create new file with same name and extension
          const processedFile = new File([blob], file.name, {
            type: outputType,
            lastModified: Date.now(),
          });
          
          resolve(processedFile);
        },
        outputType,
        quality
      );
    };

    img.onerror = (error) => {
        URL.revokeObjectURL(img.src);
        reject(error);
    };
  });
};

/**
 * Checks if a filename matches the allowed image types.
 * @param filename The filename to check.
 * @param acceptedTypes Comma-separated list of extensions (e.g. ".jpg, .png") or MIME types.
 */
export const isImageFile = (filename: string, acceptedTypes: string): boolean => {
    const lowerFilename = filename.toLowerCase();
    const commonImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff'];

    if (!acceptedTypes || acceptedTypes.trim() === '' || acceptedTypes.trim() === 'image/*') {
        return commonImageExtensions.some(ext => lowerFilename.endsWith(ext));
    }

    // Filter for explicit extensions provided in settings
    const allowedExtensions = acceptedTypes.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.startsWith('.'));

    if (allowedExtensions.length === 0) {
        // Fallback if user provides MIME types (e.g. image/png) instead of extensions
        return commonImageExtensions.some(ext => lowerFilename.endsWith(ext));
    }
    
    return allowedExtensions.some(ext => lowerFilename.endsWith(ext));
};
