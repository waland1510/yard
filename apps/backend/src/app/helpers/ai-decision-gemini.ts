import axios from 'axios';
import { Move, Player } from '@yard/shared-utils';
import { ENV } from './env';
import { makeApiCall, sanitizeApiResponse, parseJsonResponse } from './ai-decision-utils';

export async function getGeminiAIDecision(prompt: string, player: Player): Promise<Move | null> {
  console.log('[AI Decision] Attempting Gemini API call.');
  const geminiApiKey = ENV.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn('[AI Decision] Gemini API key is not set. Skipping Gemini API call.');
    throw new Error('Gemini API key not set');
  }

  const geminiResponse = await makeApiCall(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
    geminiApiKey,
    {
      contents: [{
        parts: [{ text: prompt }]
      }]
    },
    { 'Content-Type': 'application/json' }
  );

  console.log('[AI Decision] Gemini API response received:', geminiResponse);
  const sanitizedGeminiMoveDecision = sanitizeApiResponse(geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '');
  console.log('[AI Decision] Sanitized Gemini move decision:', sanitizedGeminiMoveDecision);

  try {
    const parsedGeminiMove = parseJsonResponse(sanitizedGeminiMoveDecision);
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
