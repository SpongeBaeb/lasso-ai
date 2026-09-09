import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;

export const initGemini = (apiKey) => {
  genAI = new GoogleGenerativeAI(apiKey);
};

export const validateGeminiApiKey = async (apiKey) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (response.ok) {
      return true;
    }
    const errorData = await response.json();
    console.error('API key validation failed:', errorData);
    return false;
  } catch (error) {
    console.error('API key validation error:', error);
    return false;
  }
};

export const askQuestionWithImage = async (question, base64Image) => {
  if (!genAI) {
    throw new Error('Gemini API is not initialized. Please provide an API key.');
  }

  // The base64 string usually starts with 'data:image/png;base64,' 
  // We need to strip this prefix for the API.
  const base64Data = base64Image.split(',')[1] || base64Image;

  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const prompt = question || "What's in this image?";
  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: 'image/png',
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  return response.text();
};
