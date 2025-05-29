import axios from 'axios';
import { Move, Player } from '@yard/shared-utils';
import { ENV } from './env';
import { makeApiCall, sanitizeApiResponse, parseJsonResponse } from './ai-decision-utils';

export async function getOpenRouterAIDecision(prompt: string, player: Player): Promise<Move | null> {
  console.log('[AI Decision] Attempting OpenRouter API call.');
  const apiKey = ENV.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[AI Decision] OpenRouter API key is not set. Skipping OpenRouter API call.');
    throw new Error('OpenRouter API key not set');
  }

  const response = await makeApiCall(
    'https://openrouter.ai/api/v1/chat/completions',
    apiKey,
    {
      model: 'deepseek/deepseek-chat:free',
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 500
    },
    {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  );

  console.log('[AI Decision] OpenRouter API response received:', response);

  const sanitizedMoveDecision = sanitizeApiResponse(response.choices?.[0]?.message?.content || '');
  console.log('[AI Decision] Sanitized OpenRouter move decision:', sanitizedMoveDecision);

  try {
    const parsedMove = parseJsonResponse(sanitizedMoveDecision);
    console.log('[AI Decision] Parsed OpenRouter move decision:', parsedMove);

    return {
      type: parsedMove.type,
      position: parsedMove.position,
      secret: parsedMove.secret || false,
      double: parsedMove.double || false,
      role: player.role
    };
  } catch (parseError) {
    console.error('[AI Decision] Failed to parse JSON from OpenRouter AI response:', parseError);
    throw parseError;
  }
}
