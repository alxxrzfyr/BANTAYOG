import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/Admin/bantayog/BANTAYOG/.env' });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const res = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: [{ role: 'user', parts: [{ text: "hello" }] }]
    });
    console.log("text embedding success", res.embeddings?.[0]?.values?.length);
  } catch (e) {
    console.error("text embedding error", e);
  }

  try {
    const res = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } }] }]
    });
    console.log("image embedding success", res.embeddings?.[0]?.values?.length);
  } catch (e) {
    console.error("image embedding error", e);
  }
}
run();
