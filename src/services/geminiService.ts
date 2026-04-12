import { GoogleGenAI, Type } from "@google/genai";

export type AIProvider = 'gemini' | 'openrouter';

let customApiKey: string | null = null;
let currentProvider: AIProvider = 'gemini';
let openRouterModel: string = 'google/gemini-2.0-pro-exp-02-05:free';

export const setAIConfig = (config: { key: string, provider: AIProvider, model?: string }) => {
  customApiKey = config.key;
  currentProvider = config.provider;
  if (config.model) openRouterModel = config.model;
};

const getGeminiAI = () => {
  const key = customApiKey || process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey: key });
};

const callOpenRouter = async (prompt: string, systemPrompt: string, isJson: boolean = false) => {
  const key = customApiKey || "";
  if (!key) throw new Error("OpenRouter API Key is required");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Prisma Schema Builder",
    },
    body: JSON.stringify({
      model: openRouterModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      response_format: isJson ? { type: "json_object" } : undefined,
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "OpenRouter API Error");
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

export const generateSchemaFromPrompt = async (prompt: string): Promise<string> => {
  const systemPrompt = `Generate a valid Prisma schema based on the description. 
    Return ONLY the schema code, without any markdown formatting or extra text. 
    Ensure it includes models, fields, types, and relations.`;

  if (currentProvider === 'openrouter') {
    const text = await callOpenRouter(prompt, systemPrompt);
    return text.replace(/```prisma/g, '').replace(/```/g, '').trim();
  }

  const ai = getGeminiAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `${systemPrompt}\n\nDescription: "${prompt}"`,
    config: {
      temperature: 0.7,
    },
  });

  return response.text.replace(/```prisma/g, '').replace(/```/g, '').trim();
};

export const explainSchema = async (schema: string): Promise<string> => {
  const systemPrompt = `Explain this Prisma schema in a concise and clear way for a developer. 
    Identify the main entities and their relationships.`;

  if (currentProvider === 'openrouter') {
    return await callOpenRouter(schema, systemPrompt);
  }

  const ai = getGeminiAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${systemPrompt}\n\nSchema:\n${schema}`,
    config: {
      temperature: 0.3,
    },
  });

  return response.text;
};

export const generateRealisticData = async (modelName: string, schema: string, count: number = 5): Promise<any[]> => {
  const systemPrompt = `Generate ${count} realistic JSON objects for the Prisma model "${modelName}" based on the provided schema.
    Return ONLY a valid JSON array of objects. Do not include any other text.`;

  if (currentProvider === 'openrouter') {
    const text = await callOpenRouter(`Schema:\n${schema}`, systemPrompt, true);
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse OpenRouter generated data", e);
      return [];
    }
  }

  const ai = getGeminiAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `${systemPrompt}\n\nSchema:\n${schema}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
        }
      }
    },
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse Gemini generated data", e);
    return [];
  }
};
