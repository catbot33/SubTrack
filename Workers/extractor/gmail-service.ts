import { google, type gmail_v1 } from 'googleapis';
import { canParseAttachment, parseAttachment } from './attachment-parser.ts';
import type { AttachmentResult, GmailTokens, ScrapedEmail } from './types.ts';

export const GMAIL_UPDATES_QUERY = 'category:updates -category:promotions';
export type GmailWatch = { historyId: string; expiration?: Date };
export type GmailHistory = { messageIds: string[]; historyId: string };

export class GmailService {
  private readonly gmail: gmail_v1.Gmail;

  constructor(tokens: GmailTokens) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    auth.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  async listMessageIds(
    query = GMAIL_UPDATES_QUERY,
    maxResults?: number,
    labelIds: string[] = ['CATEGORY_UPDATES'],
  ): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    const fetchAll = !maxResults || maxResults <= 0;

    do {
      const remaining = maxResults ? maxResults - ids.length : 500;
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        labelIds,
        includeSpamTrash: false,
        maxResults: fetchAll ? 500 : Math.min(remaining, 500),
        pageToken,
      });

      for (const message of response.data.messages ?? []) {
        if (message.id) ids.push(message.id);
        if (!fetchAll && ids.length >= (maxResults ?? 0)) return ids;
      }
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return ids;
  }

  async getProfile(): Promise<{ emailAddress: string; historyId: string }> {
    const response = await this.gmail.users.getProfile({ userId: 'me' });
    return {
      emailAddress: response.data.emailAddress ?? '',
      historyId: response.data.historyId ?? '',
    };
  }

  async watch(topicName: string): Promise<GmailWatch> {
    const response = await this.gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
        labelFilterBehavior: 'include',
      },
    });
    if (!response.data.historyId) throw new Error('Gmail did not return a history cursor.');
    return {
      historyId: response.data.historyId,
      expiration: response.data.expiration
        ? new Date(Number(response.data.expiration))
        : undefined,
    };
  }

  async listHistory(startHistoryId: string): Promise<GmailHistory> {
    const ids = new Set<string>();
    let pageToken: string | undefined;
    let historyId = startHistoryId;
    do {
      const response = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        maxResults: 500,
        pageToken,
      });
      for (const history of response.data.history ?? []) {
        for (const added of history.messagesAdded ?? []) {
          if (added.message?.id) ids.add(added.message.id);
        }
      }
      historyId = response.data.historyId ?? historyId;
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
    return { messageIds: [...ids], historyId };
  }

  async getMessageDetails(messageId: string): Promise<ScrapedEmail> {
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    const message = response.data;
    const headers = message.payload?.headers ?? [];
    const header = (name: string) =>
      headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
    const extracted = await this.extractPayload(messageId, message.payload);

    return {
      id: message.id ?? messageId,
      threadId: message.threadId ?? '',
      labels: message.labelIds ?? [],
      snippet: message.snippet ?? '',
      from: header('From'),
      to: header('To'),
      subject: header('Subject') || '(No subject)',
      date: header('Date'),
      timestamp: message.internalDate ? Number.parseInt(message.internalDate, 10) : Date.now(),
      bodyText: extracted.bodyText.trim(),
      attachments: extracted.attachments,
    };
  }

  private async extractPayload(
    messageId: string,
    payload?: gmail_v1.Schema$MessagePart,
  ): Promise<{ bodyText: string; attachments: AttachmentResult[] }> {
    let bodyText = '';
    const attachments: AttachmentResult[] = [];

    const walk = async (part?: gmail_v1.Schema$MessagePart): Promise<void> => {
      if (!part) return;
      const mimeType = (part.mimeType ?? '').toLowerCase();
      const filename = part.filename?.trim() ?? '';

      if (filename) {
        const convertible = canParseAttachment(filename, mimeType);
        if (!convertible) {
          attachments.push({
            filename,
            mimeType,
            size: part.body?.size ?? 0,
            isConvertible: false,
          });
          return;
        }

        try {
          let data = part.body?.data;
          if (!data && part.body?.attachmentId) {
            const response = await this.gmail.users.messages.attachments.get({
              userId: 'me',
              messageId,
              id: part.body.attachmentId,
            });
            data = response.data.data ?? undefined;
          }
          if (data) {
            attachments.push(
              await parseAttachment(filename, mimeType, Buffer.from(data, 'base64url')),
            );
          }
        } catch (error) {
          attachments.push({
            filename,
            mimeType,
            size: part.body?.size ?? 0,
            isConvertible: true,
            error: error instanceof Error ? error.message : 'Unable to read attachment',
          });
        }
        return;
      }

      if (part.body?.data) {
        const decoded = Buffer.from(part.body.data, 'base64url').toString('utf8');
        if (mimeType.includes('text/plain')) {
          bodyText += `${bodyText ? '\n\n' : ''}${decoded}`;
        } else if (mimeType.includes('text/html') && !bodyText) {
          bodyText = decoded
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }

      for (const child of part.parts ?? []) await walk(child);
    };

    await walk(payload);
    return { bodyText, attachments };
  }
}
