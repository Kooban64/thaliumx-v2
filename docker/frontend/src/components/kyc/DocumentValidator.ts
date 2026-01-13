/**
 * DocumentValidator - Validates document files
 * Checks file type, size, and format
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a document file
 */
export async function validateDocument(
  file: File,
  acceptedFormats: string[],
  maxSize: number
): Promise<ValidationResult> {
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `${file.name} exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }

  // Check file type
  const fileType = file.type || '';
  const fileName = file.name.toLowerCase();
  const isValidType = acceptedFormats.some((format) => {
    if (format.includes('*')) {
      const baseType = format.split('/')[0];
      if (baseType) {
        return fileType.startsWith(baseType);
      }
    }
    return fileType === format || fileName.endsWith(format.replace('*', ''));
  });

  if (!isValidType) {
    return {
      valid: false,
      error: `${file.name} is not an accepted file type. Accepted: ${acceptedFormats.join(', ')}`,
    };
  }

  // Additional validation for images
  if (fileType.startsWith('image/')) {
    return await validateImage(file);
  }

  // Additional validation for PDFs
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return await validatePDF(file);
  }

  return { valid: true };
}

/**
 * Validates image files
 */
async function validateImage(file: File): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      // Check minimum dimensions (optional)
      if (img.width < 100 || img.height < 100) {
        resolve({
          valid: false,
          error: `${file.name} is too small. Minimum dimensions: 100x100px`,
        });
      } else {
        resolve({ valid: true });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        valid: false,
        error: `${file.name} is not a valid image file`,
      });
    };

    img.src = url;
  });
}

/**
 * Validates PDF files
 */
async function validatePDF(file: File): Promise<ValidationResult> {
  // Basic PDF validation - check if it starts with PDF header
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer.slice(0, 4));
      const header = String.fromCharCode(...uint8Array);

      if (header === '%PDF') {
        resolve({ valid: true });
      } else {
        resolve({
          valid: false,
          error: `${file.name} is not a valid PDF file`,
        });
      }
    };
    reader.onerror = () => {
      resolve({
        valid: false,
        error: `Failed to read ${file.name}`,
      });
    };
    reader.readAsArrayBuffer(file.slice(0, 4));
  });
}
