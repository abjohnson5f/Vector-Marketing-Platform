
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Generates structured marketing insights. 
 * Note: To use responseMimeType: "application/json", we avoid using the googleSearch tool 
 * in the same call as it can cause backend conflicts and 500 errors.
 */
export const getAdvancedInsights = async (domain: string, context: any) => {
  // Creating instance right before call as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';

  const prompt = `
    Perform a deep omnichannel marketing analysis for the domain "${domain}".
    Current internal metrics: ${JSON.stringify(context.metrics)}
    Current active campaigns: ${JSON.stringify(context.campaigns)}

    Provide exactly 4 highly sophisticated insights in JSON format:
    1. A SEO recommendation specifically for "${domain}" based on keyword metrics.
    2. A competitive landscape analysis identifying a key threat or opportunity.
    3. A GEO-specific budget optimization recommendation.
    4. A Core Web Vitals performance recommendation to improve conversion rate.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        // No googleSearch here to ensure JSON reliability
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              priority: { type: Type.STRING, description: "Priority: high, medium, or low" },
              category: { type: Type.STRING, description: "Category: optimization, budget, anomaly, geo, seo, or competitive" },
              sources: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "description", "priority", "category"]
          }
        }
      }
    });

    // Use trim() before parsing JSON as per guidelines
    const text = response.text?.trim();
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return [];
  }
};

/**
 * Handles conversational strategy queries using the powerful gemini-3-pro-preview model
 * with real-time Google Search grounding. Returns text and source URLs.
 */
export const chatWithMarketingAI = async (message: string, context: any) => {
  // Creating instance right before call as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `You are a world-class marketing strategist. 
        Context: Domain: ${context.domain}, Revenue: $842k, Spend: $124k, CAC: $42.15.
        User question: ${message}
        
        Provide a detailed, data-driven answer grounded in current marketing trends.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    // Extracting grounding chunks as per guidelines for Google Search tool
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web)
      .filter(Boolean)
      .map((web: any) => ({
        uri: web.uri,
        title: web.title
      })) || [];

    return {
      text: response.text || "I'm sorry, I couldn't process that strategy request.",
      sources
    };
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return {
      text: "The AI engine encountered an error while processing your request. Please try a different query.",
      sources: []
    };
  }
};
