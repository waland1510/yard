import axios from 'axios';

export async function makeApiCall(url: string, apiKey: string, payload: object, headers: object) {
  try {
    console.info(`[API Call] Sending request to ${url}`);
    const response = await axios.post(url, payload, { headers });
    console.info(`[API Call] Response received from ${url}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`[API Call] Failed to fetch data from ${url}:`, error);
    throw error;
  }
}

export function sanitizeApiResponse(response: string): string {
  return response.replace(/```[a-zA-Z]*\n?|```/g, '').trim();
}

export function parseJsonResponse(response: string): any {
  try {
    return JSON.parse(response);
  } catch (error) {
    console.error('[API Call] Failed to parse JSON response:', error);
    throw error;
  }
}
