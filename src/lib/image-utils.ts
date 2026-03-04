/**
 * Image utility functions for frontend
 * Handles image resizing, base64 conversion, and dimension normalization
 */

/** AI models require dimensions divisible by 16 */
export const PATCH_SIZE = 16;

/** Max dimension for uploaded images - balances quality with API limits */
export const MAX_UPLOAD_SIZE = 1024;

interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Ensure dimensions are divisible by patch size for model compatibility
 */
export function ensureDivisibleByPatchSize(
  width: number,
  height: number,
  patchSize: number = PATCH_SIZE
): ImageDimensions {
  const newWidth = Math.floor(width / patchSize) * patchSize;
  const newHeight = Math.floor(height / patchSize) * patchSize;
  return {
    width: Math.max(patchSize, newWidth),
    height: Math.max(patchSize, newHeight),
  };
}

/**
 * Calculate target dimensions with max size limit while maintaining aspect ratio
 */
export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  maxSize: number = MAX_UPLOAD_SIZE
): ImageDimensions {
  const maxDim = Math.max(origWidth, origHeight);

  if (maxDim <= maxSize) {
    return { width: origWidth, height: origHeight };
  }

  const scale = maxSize / maxDim;
  return {
    width: Math.round(origWidth * scale),
    height: Math.round(origHeight * scale),
  };
}

/**
 * Convert File to base64 data URL with optional resizing
 * Resizes to MAX_UPLOAD_SIZE and ensures dimensions divisible by PATCH_SIZE
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(
      `[fileToBase64] Starting with file: ${file.name}, size: ${file.size}, type: ${file.type}`
    );

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const origWidth = img.naturalWidth;
      const origHeight = img.naturalHeight;
      console.log(`[fileToBase64] Image loaded: ${origWidth}x${origHeight}`);

      // Calculate target size (limit to MAX_UPLOAD_SIZE while maintaining aspect ratio)
      const targetDims = calculateTargetDimensions(origWidth, origHeight);

      // Make dimensions divisible by PATCH_SIZE
      const finalDims = ensureDivisibleByPatchSize(
        targetDims.width,
        targetDims.height
      );

      const needsResize =
        finalDims.width !== origWidth || finalDims.height !== origHeight;

      if (needsResize) {
        console.log(
          `[fileToBase64] RESIZING: ${origWidth}x${origHeight} -> ${finalDims.width}x${finalDims.height}`
        );
        const canvas = document.createElement("canvas");
        canvas.width = finalDims.width;
        canvas.height = finalDims.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, finalDims.width, finalDims.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas toBlob failed"));
              return;
            }
            console.log(`[fileToBase64] Resized blob size: ${blob.size}`);
            const reader = new FileReader();
            reader.onload = () => {
              console.log(
                `[fileToBase64] Done - output base64 length: ${(reader.result as string).length}`
              );
              resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
          "image/webp",
          0.95
        );
      } else {
        console.log(`[fileToBase64] NO resize needed, using original`);
        const reader = new FileReader();
        reader.onload = () => {
          console.log(
            `[fileToBase64] Done - output base64 length: ${(reader.result as string).length}`
          );
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for resize"));
    };

    img.src = url;
  });
}

/**
 * Build a prompt string safely, avoiding leading/trailing comma issues
 * When concatenating prompts, ensures no leading comma if base is empty
 */
export function buildPrompt(
  base: string,
  addition: string,
  separator: string = ", "
): string {
  const trimmedBase = base.trim();
  const trimmedAddition = addition.trim();

  if (!trimmedBase) {
    return trimmedAddition;
  }
  if (!trimmedAddition) {
    return trimmedBase;
  }

  return `${trimmedBase}${separator}${trimmedAddition}`;
}

/**
 * Sanitize a prompt for safe API usage
 * Removes extra whitespace, leading/trailing commas
 */
export function sanitizePrompt(prompt: string): string {
  return prompt
    .replace(/^[\s,]+|[\s,]+$/g, "") // Remove leading/trailing commas and whitespace
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}
