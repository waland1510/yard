import axios from 'axios';
import { Move, Player } from '@yard/shared-utils';

export async function getOpenRouterAIDecision(prompt: string, player: Player): Promise<Move | null> {
  console.log('[AI Decision] Attempting OpenRouter API call.');
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[AI Decision] OpenRouter API key is not set. Skipping OpenRouter API call.');
    throw new Error('OpenRouter API key not set');
  }

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
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
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('[AI Decision] OpenRouter API response received:', response.data);
  const choices = response.data.choices;
  if (!choices || choices.length === 0) {
    console.warn('[AI Decision] No choices found in OpenRouter API response.');
    throw new Error('No choices in OpenRouter response');
  }

  const moveDecision = choices[0]?.message?.content;
  if (!moveDecision) {
    console.warn('[AI Decision] No move decision found in OpenRouter API response.');
    throw new Error('No move decision in OpenRouter response');
  }

  const sanitizedMoveDecision = moveDecision.replace(/```[a-zA-Z]*\n?|```/g, '').trim();
  console.log('[AI Decision] Sanitized OpenRouter move decision:', sanitizedMoveDecision);

  try {
    const parsedMove = JSON.parse(sanitizedMoveDecision);
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
