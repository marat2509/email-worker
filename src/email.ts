import { extract as parseRawEmail } from 'letterparser';
import { splitEllipsis } from './splitMessage';

const DISC_MAX_LEN = 2000;
const DISCORD_EMBED_DESC_MAX_LEN = 4096;

export async function email(message: any, env: any, ctx?: any): Promise<void> {
  const url = env.DISCORD_WEBHOOK_URL;
  if (!url) throw new Error('Missing DISCORD_WEBHOOK_URL');

  try {
    // Parse email
    const { from, to } = message;
    const subject = message.headers.get('subject') || '(no subject)';
    const rawEmail = (await new Response(message.raw).text()).replace(/utf-8/gi, 'utf-8');
    const email = parseRawEmail(rawEmail);

    // Определяем содержимое сообщения, предпочитая HTML-версию, если она доступна
    const messageContent = email.html || email.text || '';
    let hasHtmlContent = Boolean(email.html);

    // Prepare embeds for Discord message
    const [firstPart = '(empty body)', ...rest] = splitEllipsis(messageContent || '', DISCORD_EMBED_DESC_MAX_LEN);

    // Create first embed with all metadata
    const firstEmbed = {
      title: subject,
      color: 0x2e86de,
      fields: [
        {
          name: 'From',
          value: from,
          inline: true,
        },
        {
          name: 'To',
          value: to,
          inline: true,
        },
        {
          name: 'Received',
          value: new Date().toISOString().replace('T', ' ').substring(0, 19),
          inline: true,
        },
        ...(hasHtmlContent ? [{ name: 'Content Type', value: 'HTML', inline: true }] : []),
      ],
      description: firstPart,
      footer: {
        text: 'Email Worker',
      },
      timestamp: new Date().toISOString(),
    };

    // Send first part with metadata
    const firstResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [firstEmbed] }),
    });

    if (!firstResponse.ok) throw new Error('Failed to post message to Discord webhook.' + (await firstResponse.json()));

    // Send continuation parts if any
    for (let i = 0; i < rest.length; i++) {
      const continuationEmbed = {
        title: `${subject} (continue ${i+1})`,
        color: 0x2e86de,
        description: rest[i],
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [continuationEmbed] }),
      });

      if (!response.ok) throw new Error('Failed to post message to Discord webhook.' + (await response.json()));
    }
  } catch (error: any) {
    // Report any parsing errors to Discord as well with better formatting
    const errorEmbed = {
      title: 'Error while processing email',
      color: 0xe74c3c,
      description: '```\n' + error.stack + '\n```',
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [errorEmbed] }),
    });

    if (!response.ok) throw new Error('Failed to post error to Discord webhook.' + (await response.json()));
  }
}
