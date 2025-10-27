import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { ImageGenerationConfig } from '../types';

/**
 * Generates an image using the Imagen model, which is best for text-to-image and respects aspect ratios.
 * @param ai - The GoogleGenAI instance.
 * @param config - The configuration for image generation.
 * @returns A data URL string of the generated image.
 */
async function generateTextToImage(ai: GoogleGenAI, config: ImageGenerationConfig): Promise<string> {
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: config.prompt,
      config: {
        numberOfImages: config.numberOfImages,
        outputMimeType: config.outputMimeType,
        aspectRatio: config.aspectRatio,
      },
    });

    if (response.promptFeedback?.blockReason) {
      const reason = response.promptFeedback.blockReason;
      const safetyRatings = response.promptFeedback.safetyRatings?.map(r => `${r.category.replace('HARM_CATEGORY_', '')}: ${r.probability}`).join(', ');
      let message = `Your prompt was blocked before generation for safety reasons (${reason}).`;
      if (safetyRatings) {
        message += ` Details: ${safetyRatings}. Please modify your prompt and try again.`;
      }
      throw new Error(message);
    }

    const generatedImage = response.generatedImages?.[0];

    if (!generatedImage) {
        throw new Error("No image data was returned from the API. The prompt may be too complex or the model refused the request.");
    }
    
    if(generatedImage.finishReason && generatedImage.finishReason !== 'SUCCESS') {
        let reason = generatedImage.finishReason;
        let message = `Image generation failed. Reason: ${reason}.`;
        
        if (reason === 'SAFETY') {
            const safetyRatings = generatedImage.safetyRatings?.map(r => `${r.category.replace('HARM_CATEGORY_', '')}: ${r.probability}`).join(', ');
            message = `The generated content was blocked for safety reasons.`;
            if (safetyRatings) {
              message += ` Details: ${safetyRatings}. Please modify your prompt and try again.`;
            }
        }
        throw new Error(message);
    }
    
    const base64ImageBytes = generatedImage.image?.imageBytes;
    if (!base64ImageBytes) {
      throw new Error("The API response did not contain image data, despite reporting success.");
    }
    
    const mimeType = generatedImage.image.mimeType || config.outputMimeType || 'image/jpeg';
    return `data:${mimeType};base64,${base64ImageBytes}`;

  } catch (error: any) {
    console.error("Error generating text-to-image:", error);
    if (error instanceof Error && (
        error.message.startsWith("Your prompt was blocked") ||
        error.message.startsWith("The generated content was blocked") ||
        error.message.startsWith("Image generation failed") ||
        error.message.startsWith("No image data was returned") ||
        error.message.startsWith("The API response did not contain image data")
      )) {
        throw error;
      }
    
    let userFriendlyMessage = "Failed to generate image due to a network or server error.";
    if (error instanceof Error && typeof error.message === 'string') {
        const lowerCaseMessage = error.message.toLowerCase();
        
        if (lowerCaseMessage.includes("api key not valid") || lowerCaseMessage.includes("403") || lowerCaseMessage.includes("permission_denied") || lowerCaseMessage.includes("requested entity was not found")) {
            window.dispatchEvent(new CustomEvent('apiKeyError'));
            userFriendlyMessage = "API Key is invalid or not authorized. Please ensure your key is correct and has the required permissions.";
        } else if (lowerCaseMessage.includes("429") || lowerCaseMessage.includes("quota")) {
            userFriendlyMessage = "You have exceeded your API usage quota. Please check your account status and billing.";
        } else if (lowerCaseMessage.includes("500") || lowerCaseMessage.includes("503") || lowerCaseMessage.includes("unavailable")) {
            userFriendlyMessage = "The image generation service is temporarily unavailable. Please try again in a few moments.";
        } else {
             userFriendlyMessage = `An unexpected error occurred. Details: ${error.message}`;
        }
    } else if (error?.message && typeof error.message === 'string') {
        userFriendlyMessage = `An unexpected error occurred. Details: ${error.message}`;
    }
    throw new Error(userFriendlyMessage);
  }
}

/**
 * Generates an image using the Gemini Flash Image model, which is required for image-to-image tasks.
 * @param ai - The GoogleGenAI instance.
 * @param config - The configuration for image generation.
 * @returns A data URL string of the generated image.
 */
async function generateWithReferenceImage(ai: GoogleGenAI, config: ImageGenerationConfig): Promise<string> {
    try {
        const parts = [];

        if (config.referenceImage) {
            parts.push({
                inlineData: {
                    data: config.referenceImage.data,
                    mimeType: config.referenceImage.mimeType,
                },
            });
        }
        
        parts.push({ text: config.prompt });
    
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts },
          config: {
            responseModalities: [Modality.IMAGE],
          },
        });

        if (response.promptFeedback?.blockReason) {
            const reason = response.promptFeedback.blockReason;
            const safetyRatings = response.promptFeedback.safetyRatings?.map(r => `${r.category.replace('HARM_CATEGORY_', '')}: ${r.probability}`).join(', ');
            let message = `Your prompt was blocked before generation for safety reasons (${reason}).`;
            if (safetyRatings) {
              message += ` Details: ${safetyRatings}. Please modify your prompt and try again.`;
            }
            throw new Error(message);
        }
    
        const candidate = response.candidates?.[0];

        if (!candidate || (candidate.finishReason && candidate.finishReason !== 'STOP')) {
            let reason = candidate?.finishReason || 'UNKNOWN_REASON';
            let message = `Image generation was stopped. Reason: ${reason}.`;
            
            if (reason === 'SAFETY') {
                const safetyRatings = candidate.safetyRatings?.map(r => `${r.category.replace('HARM_CATEGORY_', '')}: ${r.probability}`).join(', ');
                message = `The generated content was blocked for safety reasons.`;
                if (safetyRatings) {
                  message += ` Details: ${safetyRatings}. Please modify your prompt and try again.`;
                }
            }
            
            throw new Error(message);
        }
        
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const base64ImageBytes: string = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || 'image/jpeg';
              return `data:${mimeType};base64,${base64ImageBytes}`;
            }
          }
        }
    
        throw new Error("No image data was returned from the API. This can happen if the prompt is too complex or the model is unable to generate an image for your request.");

    } catch(error: any) {
        console.error("Error generating image with reference:", error);
        if (error instanceof Error && (
            error.message.startsWith("Your prompt was blocked") ||
            error.message.startsWith("The generated content was blocked") ||
            error.message.startsWith("Image generation was stopped") ||
            error.message.startsWith("No image data was returned")
        )) {
            throw error;
        }

        let userFriendlyMessage = "Failed to generate image due to a network or server error.";
        if (error instanceof Error && typeof error.message === 'string') {
            const lowerCaseMessage = error.message.toLowerCase();
            
            if (lowerCaseMessage.includes("api key not valid") || lowerCaseMessage.includes("403") || lowerCaseMessage.includes("permission_denied") || lowerCaseMessage.includes("requested entity was not found")) {
                window.dispatchEvent(new CustomEvent('apiKeyError'));
                userFriendlyMessage = "API Key is invalid or not authorized. Please ensure your key is correct and has the required permissions.";
            } else if (lowerCaseMessage.includes("429") || lowerCaseMessage.includes("quota")) {
                userFriendlyMessage = "You have exceeded your API usage quota. Please check your account status and billing.";
            } else if (lowerCaseMessage.includes("500") || lowerCaseMessage.includes("503") || lowerCaseMessage.includes("unavailable")) {
                userFriendlyMessage = "The image generation service is temporarily unavailable. Please try again in a few moments.";
            } else {
                 userFriendlyMessage = `An unexpected error occurred. Details: ${error.message}`;
            }
        } else if (error?.message && typeof error.message === 'string') {
            userFriendlyMessage = `An unexpected error occurred. Details: ${error.message}`;
        }
    
        throw new Error(userFriendlyMessage);
    }
}


/**
 * Generates an image using the appropriate Gemini model based on the configuration.
 * It routes to a text-to-image model (Imagen) if no reference image is provided to respect aspect ratio,
 * and to a multi-modal model (Gemini 2.5 Flash Image) if a reference image is used for image-to-image tasks.
 * @param config - The configuration for image generation.
 * @returns A data URL string of the generated image.
 * @throws {Error} If the API call fails or no image is returned, with a user-friendly message.
 */
export async function generateImage(config: ImageGenerationConfig): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // If a reference image is provided, use the multi-modal model that supports image-to-image.
  if (config.referenceImage) {
    return generateWithReferenceImage(ai, config);
  } else {