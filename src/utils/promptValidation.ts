// Keywords and patterns that indicate the user wants to use an uploaded image
const IMAGE_REQUIRED_KEYWORDS = [
  'transform',
  'convert',
  'change',
  'modify',
  'remix',
  'edit',
  'alter',
  'update',
  'based on this image',
  'using this image',
  'from this image',
  'make it',
  'turn into',
  'make this',
  'change this',
  'transform this',
  'convert this',
  'remix this',
  'edit this',
  'alter this',
  'update this',
  'preserve the',
  'maintain the',
  'keep the same',
  'preserve the same',
  'maintain the same',
  'based on the uploaded',
  'using the uploaded',
  'from the uploaded',
  'the uploaded image',
  'this photo',
  'this picture',
  'this portrait',
  'the person',
  'the subject',
  'their face',
  'their hair',
  'their expression',
  'their pose',
  'the original image',
  'the source image',
];

const IMAGE_REFERENCE_PATTERNS = [
  /\b(the )?(uploaded|attached|this|that|current|original|source) (image|photo|picture|portrait|pic)\b/gi,
  /\b(the )?(person|subject|face|hair|expression|pose|features|structure)\b/gi,
  /\b(keep|preserve|maintain) (the )?(same|original|current)\b/gi,
  /\b(based on|using|from) (this|that|the) (image|photo|picture|portrait)\b/gi,
  /\b(transform|convert|change|modify|remix|edit|alter|update) (this|that|the|it)\b/gi,
];

const STRONG_IMAGE_REQUIRED = [
  'transform the uploaded',
  'transform this image',
  'transform this photo',
  'transform this portrait',
  'convert the uploaded',
  'convert this image',
  'convert this photo',
  'based on the uploaded image',
  'using the uploaded image',
  'from the uploaded image',
  'preserve the subject',
  'preserve the person',
  'keep the face',
  'maintain the features',
  'keep the facial',
  'preserve the facial',
  'keep the hair',
  'preserve the hair',
  'keep the pose',
  'preserve the pose',
  'keep the expression',
  'preserve the expression',
];

export interface ValidationResult {
  requiresImage: boolean;
  isStronglyRequired: boolean;
  reason?: string;
  confidence: number; // 0-1
}

export const validateImageRequirement = (prompt: string): ValidationResult => {
  const normalizedPrompt = prompt.toLowerCase().trim();
  
  // Check for strong image requirements first
  for (const pattern of STRONG_IMAGE_REQUIRED) {
    if (normalizedPrompt.includes(pattern.toLowerCase())) {
      return {
        requiresImage: true,
        isStronglyRequired: true,
        reason: `"${pattern}" - This prompt requires an uploaded image to transform or modify`,
        confidence: 0.95,
      };
    }
  }
  
  // Check for exact keyword matches
  for (const keyword of IMAGE_REQUIRED_KEYWORDS) {
    if (normalizedPrompt.includes(keyword.toLowerCase())) {
      return {
        requiresImage: true,
        isStronglyRequired: false,
        reason: `"${keyword}" - This suggests you want to use an uploaded image`,
        confidence: 0.7,
      };
    }
  }
  
  // Check for pattern matches
  for (const pattern of IMAGE_REFERENCE_PATTERNS) {
    if (pattern.test(normalizedPrompt)) {
      const matches = normalizedPrompt.match(pattern);
      if (matches && matches.length > 0) {
        return {
          requiresImage: true,
          isStronglyRequired: false,
          reason: `Image reference detected: "${matches[0]}"`,
          confidence: 0.6,
        };
      }
    }
  }
  
  // No image requirement detected
  return {
    requiresImage: false,
    isStronglyRequired: false,
    confidence: 0,
  };
};

export const getImageRequirementMessage = (validation: ValidationResult): string => {
  if (!validation.requiresImage) return '';
  
  if (validation.isStronglyRequired) {
    return `⚠️ This prompt requires an image to be uploaded first. ${validation.reason}`;
  }
  
  return `💡 It looks like you might want to use an image with this prompt. ${validation.reason}
  
Would you like to:
1. Upload an image to transform
2. Generate from text only`;
};

export const shouldBlockGeneration = (validation: ValidationResult, hasImage: boolean): boolean => {
  return validation.requiresImage && !hasImage && validation.isStronglyRequired;
};

// Helper function to check if prompt is about image transformation
export const isImageTransformationPrompt = (prompt: string): boolean => {
  const validation = validateImageRequirement(prompt);
  return validation.requiresImage && validation.confidence > 0.7;
};
