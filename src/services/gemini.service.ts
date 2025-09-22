import { Injectable, signal, inject } from '@angular/core';
// FIX: Added GenerateImagesResponse to correctly type the response from the image generation API.
import { GoogleGenAI, Type, GenerateContentResponse, GenerateImagesResponse } from '@google/genai';
import { Scene, GeneratedAssets, MusicPlan, SocialPack, SfxPlan } from '../models';
import { LoggingService } from './logging.service';

// NOTE: Prices are examples and may not be accurate. Check official Google Cloud pricing.
const GEMINI_2_5_FLASH_INPUT_PRICE_PER_1M_TOKENS = 0.35; // Example price
const GEMINI_2_5_FLASH_OUTPUT_PRICE_PER_1M_TOKENS = 0.70; // Example price
const IMAGEN_3_PRICE_PER_IMAGE = 0.020; // Example price for standard quality image.

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private genAI: GoogleGenAI;
  public error = signal<string | null>(null);
  private loggingService = inject(LoggingService);

  constructor() {
    if (!process.env.API_KEY) {
      const errorMessage = "API_KEY environment variable not found. Please set it to use the Gemini API.";
      this.error.set(errorMessage);
      console.error(errorMessage);
      this.loggingService.log(errorMessage, 'api-error');
      // @ts-ignore
      this.genAI = null;
    } else {
      this.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object') {
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }
    }
    return 'An unknown error occurred. See console for details.';
  }

  private calculateTextCost(promptTokens: number, candidatesTokens: number): number {
    const inputCost = (promptTokens / 1_000_000) * GEMINI_2_5_FLASH_INPUT_PRICE_PER_1M_TOKENS;
    const outputCost = (candidatesTokens / 1_000_000) * GEMINI_2_5_FLASH_OUTPUT_PRICE_PER_1M_TOKENS;
    return inputCost + outputCost;
  }

  private async withRetry<T>(apiCall: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (e) {
            lastError = e;
            if (i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i) + Math.random() * 1000; // Jitter
                this.loggingService.log(`API call failed (attempt ${i + 1}/${maxRetries}). Retrying in ${Math.round(delay/1000)}s...`, 'api-error', { error: e });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
  }

  private async generate<T>(contents: any, schema: any): Promise<T | null> {
    if (!this.genAI) return null;
    this.error.set(null);
    this.loggingService.log('Calling generateContent (JSON)', 'api-request', { contents });
    try {
      const apiCall = () => this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      
      const result: GenerateContentResponse = await this.withRetry(apiCall);

      const usageMetadata = result.usageMetadata;
      let costMessage = '';
      if (usageMetadata) {
          const cost = this.calculateTextCost(usageMetadata.promptTokenCount, usageMetadata.candidatesTokenCount);
          this.loggingService.addToTotalCost(cost);
          costMessage = ` - Est. Cost: $${cost.toFixed(6)}`;
      }
      this.loggingService.log(`Success: generateContent (JSON)${costMessage}`, 'api-success', {
          tokens: usageMetadata ? `Prompt: ${usageMetadata.promptTokenCount}, Candidates: ${usageMetadata.candidatesTokenCount}, Total: ${usageMetadata.totalTokenCount}` : 'N/A',
      });
      
      const jsonString = result.text?.trim();
      if (!jsonString) {
        const errorMsg = 'Gemini API returned an empty JSON response. This might be due to content safety filters.';
        console.error(errorMsg, result);
        this.error.set(errorMsg);
        this.loggingService.log(errorMsg, 'api-error', { response: result });
        return null;
      }
      return JSON.parse(jsonString) as T;
    } catch (e: unknown) {
      const errorMsg = this.getErrorMessage(e);
      const errorMessage = `Failed to generate JSON content after retries. Error: ${errorMsg}`;
      console.error('Gemini API Error:', e);
      this.error.set(errorMessage);
      this.loggingService.log(errorMessage, 'api-error', { error: e });
      return null;
    }
  }
  
  private async generateText(contents: any): Promise<string | null> {
    if (!this.genAI) return null;
    this.error.set(null);
    this.loggingService.log('Calling generateContent (Text)', 'api-request', { contents });
    try {
        const apiCall = () => this.genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
        });

        const result: GenerateContentResponse = await this.withRetry(apiCall);

        const usageMetadata = result.usageMetadata;
        let costMessage = '';
        if (usageMetadata) {
            const cost = this.calculateTextCost(usageMetadata.promptTokenCount, usageMetadata.candidatesTokenCount);
            this.loggingService.addToTotalCost(cost);
            costMessage = ` - Est. Cost: $${cost.toFixed(6)}`;
        }
        this.loggingService.log(`Success: generateContent (Text)${costMessage}`, 'api-success', {
          tokens: usageMetadata ? `Prompt: ${usageMetadata.promptTokenCount}, Candidates: ${usageMetadata.candidatesTokenCount}, Total: ${usageMetadata.totalTokenCount}` : 'N/A',
        });
        
        const text = result.text?.trim();
        if (!text) {
          const errorMsg = 'Gemini API returned no text. This might be due to content safety filters or an issue with the prompt.';
          console.error(errorMsg, result);
          this.error.set(errorMsg);
          this.loggingService.log(errorMsg, 'api-error', { response: result });
          return null;
        }
        return text;
    } catch (e: unknown) {
        const errorMsg = this.getErrorMessage(e);
        const errorMessage = `Failed to generate text content after retries. Error: ${errorMsg}`;
        console.error('Gemini API Error:', e);
        this.error.set(errorMessage);
        this.loggingService.log(errorMessage, 'api-error', { error: e });
        return null;
    }
  }

  async generateCharacterPromptFromPoem(poem: string, style?: string): Promise<string | null> {
    const styleInstruction = style 
      ? `The description must end with ', in the style of ${style}'. This is not optional.`
      : '';

    const prompt = `
      Analyze the following poem and create a concise visual description of the main character, suitable for an AI image generator.
      Focus on key visual details that can be inferred from the text, such as age, actions, mood, and implied appearance.
      The output should be a single, simple, comma-separated phrase or short sentence in English.
      ${styleInstruction}
      Output ONLY the prompt text, with no preamble or explanation.

      Poem:
      "${poem}"
    `;
    return this.generateText(prompt);
  }

  async beautifyPrompt(basePrompt: string, refinement: string, styles: string[]): Promise<string | null> {
    const systemPrompt = `You are an expert prompt engineer for an AI image generator. Your task is to intelligently merge a user's refinement into a base prompt, and then enhance it with specific art styles. The final prompt should be simple, clear, and effective.

The user's refinement is the most important instruction and MUST be followed precisely.

**HIGHEST PRIORITY - User Refinement:** "${refinement}"

**Base Prompt (for context):** "${basePrompt}"

**Selected Styles:** [${styles.join(', ')}]

Your job is to:
1.  Start with the Base Prompt.
2.  Integrate the User Refinement. Ensure the final prompt perfectly reflects this change. For example, if the refinement is 'wearing a red hat', the character MUST be wearing a red hat. If the refinement is 'at sunset', the lighting MUST be sunset. This is not optional.
3.  **Incorporate the Art Styles**: Analyze the **Selected Styles**. Add descriptive keywords and phrases that embody the essence of these styles. If multiple styles are selected, you must blend their characteristics seamlessly in the prompt to ensure the final image reflects both. For example, if styles are 'Pixar 3D' and 'Pop-art cartoon style', the prompt could include phrases like 'a vibrant 3D character with bold outlines and dot patterns, in the style of pop-art and modern animation'.
4.  Combine everything into a single, simple, comma-separated prompt in English.
5.  Output ONLY the final prompt text, with no preamble or explanation.`;
    return this.generateText(systemPrompt);
  }

  async beautifyAnimationPrompt(basePrompt: string, refinement: string, styles: string[]): Promise<string | null> {
    const systemPrompt = `You are an expert creative director for animation. Your task is to intelligently merge a user's refinement into a base animation prompt, ensuring it adheres to specific art styles. The final prompt should be detailed, clear, and ready for an AI animator.

The user's refinement is the most important instruction and MUST be followed precisely.

**HIGHEST PRIORITY - User Refinement:** "${refinement}"

**Base Animation Prompt (for context):** "${basePrompt}"

**Selected Styles:** [${styles.join(', ')}]

Your job is to:
1.  Start with the Base Animation Prompt.
2.  Integrate the User Refinement. Ensure the final prompt perfectly reflects this change. For example, if the refinement is 'the character trips over a rock', that action MUST be included.
3.  Combine everything into a single, cohesive, and detailed animation prompt.
4.  **Crucially, the final prompt MUST embody the characteristics of the Selected Styles.** Use descriptive language and visual details appropriate for these styles. For instance, for 'Pop-art cartoon style', use phrases like 'with bold outlines and vibrant, flat colors'.
5.  Output ONLY the final prompt text, with no preamble or explanation.`;
    return this.generateText(systemPrompt);
  }

  async generateAnimationPrompt(scene: Scene, characterPrompt: string, styles: string[]): Promise<string | null> {
    const prompt = `
      You are an expert creative director for animation. Your task is to generate a single, detailed animation prompt for a scene, tailored to specific animation styles.
      The prompt should describe the action, emotion, and camera movement.
      **Do NOT include the character's physical description in your output prompts**, as that will be handled separately.

      **Selected Styles:** [${styles.join(', ')}]

      Character Reference Prompt (for context, do not repeat in output): "${characterPrompt}"

      Poem Lines for this Scene:
      "${scene.lines}"

      Scene Summary / Action:
      "${scene.description}"

      **CRITICAL INSTRUCTIONS**:
      Your output prompt MUST explicitly incorporate the **Selected Styles**. Describe the scene using visual details and descriptive language that are characteristic of these styles. For example, for 'Pixar 3D', mention smooth textures and dynamic lighting. For 'Soviet classic animation', mention distinctive, often melancholic color palettes and artistic backgrounds. If multiple styles are selected, blend their characteristics seamlessly.

      Output only the single animation prompt text, with no preamble or JSON formatting.
    `;
    return this.generateText(prompt);
  }

  async generateAllSceneDescriptions(scenes: Scene[], characterPrompt: string): Promise<{id: number; description: string; description_ru: string}[] | null> {
    const scenePrompts = scenes.map(scene => `
- ID: ${scene.id}
  Poem Lines: "${scene.lines}"
`).join('');

    const prompt = `
        You are a creative director for an animator. Your task is to write a detailed, visually rich description for each scene in a storyboard provided below, creating a continuous narrative. For each scene, you must provide both an English description and its Russian translation.

        Main Character Description: "${characterPrompt}"

        Here are the scenes in order:
        ${scenePrompts}

        For each scene, based on the character and the poem lines, write a 2-3 sentence description in English. Focus on:
        - What the character is doing (the action).
        - The character's emotion or expression.
        - Key visual elements of the environment/setting.
        - The overall mood or atmosphere of the scene.
        - **CRITICAL**: Ensure that each scene's description logically and narratively follows from the previous one, creating a smooth, continuous story. The first scene sets the stage, and every subsequent scene must build upon the last.

        Example for a single scene: "Sunlight streams through the dusty attic window, illuminating a curious girl as she gently lifts the lid of an old wooden chest. Her eyes sparkle with a mix of excitement and trepidation, and dust motes dance in the golden light around her."

        Return the output as a single JSON array, where each object has the scene "id" (as a number), the generated English "description", and the Russian translation in a "description_ru" field.
        The JSON array should have one object for each scene provided.
        Do not include any other text, markdown formatting, or preamble in your response. Your response must be only the JSON array.
    `;

    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.NUMBER, description: "The unique ID of the scene." },
                description: { type: Type.STRING, description: "The generated detailed, visually-rich description for the scene in English." },
                description_ru: { type: Type.STRING, description: "The Russian translation of the scene description." }
            },
            required: ["id", "description", "description_ru"]
        }
    };
    
    return this.generate<{id: number; description: string; description_ru: string}[]>(prompt, schema);
  }

  async enrichSceneDescription(currentDescription: string, previousSceneDescription?: string): Promise<{ description: string; description_ru: string } | null> {
    const contextPrompt = previousSceneDescription 
        ? `**Previous Scene (for context):** "${previousSceneDescription}"` 
        : '';
    const continuityInstruction = previousSceneDescription 
        ? `3. **Crucially, ensure the enriched description logically flows from the "Previous Scene".**`
        : '';

    const prompt = `You are a creative writer. Your task is to enrich a scene description for an AI image generator, ensuring narrative continuity. You must provide both the enriched English description and its Russian translation.

${contextPrompt}

**Current Scene (to enrich):** "${currentDescription}"

Your job is to:
1. Make the "Current Scene" richer and more detailed, adding visual details about the environment, character emotions, and atmosphere.
2. Keep the core action of the "Current Scene" the same.
${continuityInstruction}

Output a JSON object with two keys: "description" (the new, enriched description in English as a single paragraph of 2-3 sentences) and "description_ru" (its Russian translation).`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            description: { type: Type.STRING, description: "The new, enriched description in English." },
            description_ru: { type: Type.STRING, description: "The Russian translation of the enriched description." }
        },
        required: ["description", "description_ru"]
    };

    return this.generate<{ description: string; description_ru: string }>(prompt, schema);
  }

  async reimagineAllSceneDescriptions(scenes: Scene[], characterPrompt: string): Promise<{id: number; description: string; description_ru: string}[] | null> {
    const scenePrompts = scenes.map(scene => `
- ID: ${scene.id}
  Poem Lines: "${scene.lines}"
  Current Description (for reference, create something different): "${scene.description}"
`).join('');

    const prompt = `
        You are a highly imaginative creative director. Your task is to re-analyze a poem and generate a completely new set of visual descriptions for a storyboard. The goal is to provide a fresh, alternative interpretation of the scenes. For each scene, you must provide both an English description and its Russian translation.

        **CRITICAL INSTRUCTION**: Do NOT just rephrase the "Current Description". You must invent a new visual concept, mood, or action based on the "Poem Lines" that is fundamentally different from the existing one. Be creative and bold in your new interpretation.

        Main Character Description (for context): "${characterPrompt}"

        Here are the scenes:
        ${scenePrompts}

        For each scene, based on the character and the poem lines, write a new 2-3 sentence description in English. Focus on:
        - A new action, emotion, or setting that still fits the poem lines.
        - A different mood or atmosphere.
        - Maintaining a continuous narrative flow with the other *new* descriptions you are creating. Each new scene must logically follow the previous *new* scene.

        Return the output as a single JSON array, where each object has the scene "id" (as a number), the new creative "description" in English, and its Russian translation in a "description_ru" field.
        Do not include any other text, markdown formatting, or preamble in your response. Your response must be only the JSON array.
    `;

    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.NUMBER, description: "The unique ID of the scene." },
                description: { type: Type.STRING, description: "The new, creative and alternative scene description in English." },
                description_ru: { type: Type.STRING, description: "The Russian translation of the new creative description." }
            },
            required: ["id", "description", "description_ru"]
        }
    };
    
    return this.generate<{id: number; description: string; description_ru: string}[]>(prompt, schema);
  }

  async generatePromptFromImage(characterReferenceImage: string): Promise<string | null> {
    const prompt = "Describe the character in this image. Focus on key visual details for an AI image generator: hair, eyes, face, clothes, and accessories. Be concise. The description should be a single phrase or short sentence.";
    
    const match = characterReferenceImage.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
        this.error.set('Invalid image data URL.');
        return null;
    }
    const [, mimeType, data] = match;

    const contents = {
        parts: [
            { text: prompt },
            { inlineData: { mimeType, data } }
        ]
    };

    return this.generateText(contents);
  }

  async generateImageFromPrompt(prompt: string, aspectRatio: '9:16' | '16:9' = '9:16', additionalNegativePrompts: string[] = []): Promise<string | null> {
    if (!this.genAI) return null;
    this.error.set(null);
    const baseNegativePrompt = 'deformed, disfigured, extra limbs, extra fingers, mutated hands, bad anatomy, poorly drawn hands, poorly drawn face, blurry, ugly, duplicate, morbid, mutilated, out of frame, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, ugly, blurry, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, out of frame, ugly, extra limbs, bad anatomy, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck';
    const negativePrompt = [baseNegativePrompt, ...additionalNegativePrompts].join(', ');
    const fullPrompt = [prompt, 'single image', 'no comic book panels', 'no storyboards', negativePrompt, '--style raw'].filter(Boolean).join(', ');
    
    this.loggingService.log('Calling generateImages', 'api-request', { prompt: fullPrompt });
    try {
        const apiCall = () => this.genAI.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: fullPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio,
            },
        });
        
        const response: GenerateImagesResponse = await this.withRetry(apiCall);
        
        const cost = IMAGEN_3_PRICE_PER_IMAGE * 1; // for numberOfImages: 1
        this.loggingService.addToTotalCost(cost);
        const costMessage = ` - Est. Cost: $${cost.toFixed(4)}`;
        this.loggingService.log(`Success: generateImages${costMessage}`, 'api-success', { prompt: fullPrompt });
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        return null;
    } catch (e: unknown) {
        const errorMsg = this.getErrorMessage(e);
        const errorMessage = `Failed to generate image after retries. Error: ${errorMsg}`;
        console.error('Gemini API Error:', e);
        this.error.set(errorMessage);
        this.loggingService.log(errorMessage, 'api-error', { error: e });
        return null;
    }
  }

  async generateImageFromImageAndPrompt(baseImage: string, prompt: string, aspectRatio: '9:16' | '16:9' = '9:16'): Promise<string | null> {
    if (!this.genAI) return null;
    this.error.set(null);

    const match = baseImage.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
        this.error.set('Invalid image data URL for editing.');
        return null;
    }
    const [, mimeType, data] = match;
    const negativePrompt = 'deformed, disfigured, extra limbs, extra fingers, mutated hands, bad anatomy, poorly drawn hands, poorly drawn face, blurry, ugly, duplicate, morbid, mutilated, out of frame, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, ugly, blurry, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, out of frame, ugly, extra limbs, bad anatomy, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck';
    const finalApiPrompt = [prompt, 'single image', 'no comic book panels', 'no storyboards', negativePrompt, '--style raw'].filter(Boolean).join(', ');
    
    this.loggingService.log('Calling generateImages (Image-to-Image)', 'api-request', { prompt: finalApiPrompt });
    try {
        const params: any = {
            model: 'imagen-3.0-generate-002',
            prompt: finalApiPrompt,
            image: {
              imageBytes: data,
              mimeType: mimeType,
            },
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio,
            },
        };

        const apiCall = () => this.genAI.models.generateImages(params);
        const response: GenerateImagesResponse = await this.withRetry(apiCall);
        
        const cost = IMAGEN_3_PRICE_PER_IMAGE * 1; // for numberOfImages: 1
        this.loggingService.addToTotalCost(cost);
        const costMessage = ` - Est. Cost: $${cost.toFixed(4)}`;
        this.loggingService.log(`Success: generateImages (Image-to-Image)${costMessage}`, 'api-success', { prompt: finalApiPrompt });
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        return null;
    } catch (e: unknown) {
        const errorMsg = this.getErrorMessage(e);
        const errorMessage = `Failed to edit image after retries. Error: ${errorMsg}`;
        console.error('Gemini API Error for image editing:', e);
        this.error.set(errorMessage);
        this.loggingService.log(errorMessage, 'api-error', { error: e });
        return null;
    }
  }

  async generateSceneAssets(scene: Scene, characterPrompt: string, styles: string[]): Promise<GeneratedAssets | null> {
    const prompt = `
      You are an expert creative director for animation. Your task is to generate assets for a scene in JSON format, tailored to specific animation styles.
      Based on the following poem lines, scene summary, and selected styles, generate a JSON object containing prompts for an AI image generator and an animation prompt.
      The prompts should be SIMPLE and CLEAR, describing the action, emotion, and setting in a concise way.
      **Do NOT include the character's physical description in your output prompts**, as that will be handled separately to ensure consistency.

      **Selected Styles:** [${styles.join(', ')}]
      
      Character Reference Prompt (for context, do not repeat in output): "${characterPrompt}"

      Poem Lines for this Scene:
      "${scene.lines}"

      Scene Summary / Action:
      "${scene.description}"
      
      **CRITICAL INSTRUCTIONS**:
      1.  For the "animationPrompt", you MUST explicitly incorporate the **Selected Styles**. Describe the scene using visual details and descriptive language that are characteristic of these styles. For example, for 'Pixar 3D', mention smooth textures and dynamic lighting. For 'Soviet classic animation', mention distinctive, often melancholic color palettes and artistic backgrounds.
      2.  You must provide Russian translations for "firstFramePrompt", "animationPrompt", and "finalFramePrompt".
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            firstFramePrompt: { type: Type.STRING, description: "Simple and clear prompt for the action/setting of the opening shot in English." },
            firstFramePrompt_ru: { type: Type.STRING, description: "Russian translation of the first frame prompt." },
            animationPrompt: { type: Type.STRING, description: "Detailed description of the action, emotion, and camera movement for the animation in English, written in the selected animation style." },
            animationPrompt_ru: { type: Type.STRING, description: "Russian translation of the animation prompt." },
            finalFramePrompt: { type: Type.STRING, description: "Simple and clear prompt for the action/setting of the closing shot in English." },
            finalFramePrompt_ru: { type: Type.STRING, description: "Russian translation of the final frame prompt." },
        },
        required: ["firstFramePrompt", "firstFramePrompt_ru", "animationPrompt", "animationPrompt_ru", "finalFramePrompt", "finalFramePrompt_ru"]
    };
    
    return this.generate<GeneratedAssets>(prompt, schema);
  }

  async generateMusicPlan(poem: string): Promise<MusicPlan | null> {
    const prompt = `
      You are a film composer. Analyze the following poem and create a 3-part musical score plan. Describe the mood and instrumentation for each part.

      Poem:
      "${poem}"

      Describe Part 1 (beginning), Part 2 (middle/climax), and Part 3 (resolution/end).
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            part1: { type: Type.STRING, description: "Description for the first part of the musical score." },
            part2: { type: Type.STRING, description: "Description for the middle, often chaotic or climactic part." },
            part3: { type: Type.STRING, description: "Description for the final, resolving part of the score." }
        },
        required: ["part1", "part2", "part3"]
    };
    
    return this.generate<MusicPlan>(prompt, schema);
  }

  async generateSfxForAllScenes(scenes: Scene[]): Promise<{id: number, sfx: string[]}[] | null> {
    const scenePrompts = scenes
      .filter(s => s.generatedAssets?.animationPrompt)
      .map((s, i) => `
        - Scene ${i + 1}:
          - ID: ${s.id}
          - Lines: "${s.lines}"
          - Animation Prompt: "${s.generatedAssets!.animationPrompt}"
      `).join('');
  
    const prompt = `
      You are a sound designer for an animation studio.
      Based on the following list of scenes and their animation prompts, generate a list of sound effect (SFX) ideas for each scene.
      The SFX should be concise and descriptive (e.g., 'footsteps on gravel', 'gentle wind blowing', 'distant bird chirp').
      Provide 3-5 SFX ideas for each scene.
  
      Scenes:
      ${scenePrompts}
  
      Return the output as a single JSON array, where each object has the scene "id" (as a number from the input) and a list of strings called "sfx".
      The JSON array should have one object for each scene provided.
      Do not include any other text, markdown formatting, or preamble in your response. Your response must be only the JSON array.
    `;
  
    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER, description: "The unique ID of the scene." },
          sfx: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of sound effect ideas for the scene." }
        },
        required: ["id", "sfx"]
      }
    };
    
    return this.generate<{id: number; sfx: string[]}[]>(prompt, schema);
  }

  async generateThumbnailPrompt(title: string, poem: string): Promise<string | null> {
    const prompt = `
        You are a viral YouTube content strategist specializing in animated content.
        Based on the project title and poem, create a visually striking and engaging prompt for an AI image generator to create a thumbnail.
        The prompt should be descriptive, slightly clickbaity, and evoke curiosity. It should capture the essence of the story, focusing on a key character moment or an intriguing scene.
        The art style should be consistent with a Pixar 3D animation.
        Output ONLY the prompt text, with no preamble or explanation.

        Project Title: "${title}"
        Poem: "${poem}"
    `;
    return this.generateText(prompt);
  }

  async generateSocialPack(title: string, poem: string): Promise<SocialPack | null> {
    const prompt = `
        You are a social media marketing expert for a children's animation channel.
        The project is an animated short film based on a poem.
        Project Title: "${title}"
        Poem: "${poem}"

        Generate a complete social media package for YouTube and TikTok.
        For YouTube, provide a catchy title, a detailed description, relevant hashtags (as a list of strings), keywords (as a list of strings), and tags (as a list of strings).
        For TikTok, provide a short channel bio, a video description, and relevant hashtags (as a list of strings).
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            youtube: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                }
            },
            tiktok: {
                type: Type.OBJECT,
                properties: {
                    bio: { type: Type.STRING },
                    description: { type: Type.STRING },
                    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        },
        required: ["youtube", "tiktok"]
    };

    return this.generate<SocialPack>(prompt, schema);
  }
}
