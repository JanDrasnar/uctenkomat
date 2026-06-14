import Anthropic from '@anthropic-ai/sdk';
import { ULOZIT_DOKLAD_TOOL, SYSTEM_PROMPT } from '../schema.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

/**
 * Přečte údaje z obrázku dokladu pomocí Claude vision.
 * @param {Buffer} imageBuffer
 * @param {string} mediaType  např. 'image/jpeg', 'image/png'
 * @returns {Promise<object>} vstup nástroje ulozit_doklad (validovaný proti schématu)
 */
export async function extractDoklad(imageBuffer, mediaType) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [ULOZIT_DOKLAD_TOOL],
    tool_choice: { type: 'tool', name: 'ulozit_doklad' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBuffer.toString('base64'),
            },
          },
          { type: 'text', text: 'Zpracuj tento doklad.' },
        ],
      },
    ],
  });

  const toolUse = msg.content.find((c) => c.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Model nevrátil strukturovaná data (chybí tool_use).');
  }
  return toolUse.input;
}
