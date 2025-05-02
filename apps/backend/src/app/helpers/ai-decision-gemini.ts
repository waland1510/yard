import axios from 'axios';
import { Move, Player } from '@yard/shared-utils';
import { ENV } from './env';

export async function getGeminiAIDecision(prompt: string, player: Player): Promise<Move | null> {
  console.log('[AI Decision] Attempting Gemini API call.');
  const geminiApiKey = ENV.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn('[AI Decision] Gemini API key is not set. Skipping Gemini API call.');
    throw new Error('Gemini API key not set');
  }

  const geminiResponse = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
    {
      contents: [{
        parts: [{ text: prompt }]
      }]
    },
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('[AI Decision] Gemini API response received:', geminiResponse.data);
  const geminiMoveDecision = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!geminiMoveDecision) {
    console.warn('[AI Decision] No move decision found in Gemini API response.');
    throw new Error('No move decision from Gemini API');
  }

  const sanitizedGeminiMoveDecision = geminiMoveDecision.replace(/```[a-zA-Z]*\n?|```/g, '').trim();
  console.log('[AI Decision] Sanitized Gemini move decision:', sanitizedGeminiMoveDecision);

  // Extract JSON part from the response
  const jsonMatch = sanitizedGeminiMoveDecision.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('[AI Decision] No valid JSON found in Gemini AI response.');
    throw new Error('Invalid JSON in Gemini response');
  }

  try {
    const parsedGeminiMove = JSON.parse(jsonMatch[0]);
    console.log('[AI Decision] Parsed Gemini move decision:', parsedGeminiMove);

    return {
      type: parsedGeminiMove.type,
      position: parsedGeminiMove.position,
      secret: parsedGeminiMove.secret || false,
      double: parsedGeminiMove.double || false,
      role: player.role
    };
  } catch (geminiParseError) {
    console.error('[AI Decision] Failed to parse JSON from Gemini AI response:', geminiParseError);
    throw geminiParseError;
  }
}
