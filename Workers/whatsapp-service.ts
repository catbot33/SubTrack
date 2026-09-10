type MetaError = { error?: { code?: number; message?: string } };
type MetaSuccess = { messages?: Array<{ id?: string }> };

export class WhatsAppConfigurationError extends Error {}
export class WhatsAppDeliveryError extends Error {
  readonly code?: number;
  constructor(message: string, code?: number) { super(message); this.code = code; }
}

export function normalizeWhatsAppNumber(value: unknown): string {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  if (!/^\d{8,15}$/.test(digits)) throw new Error('Enter a WhatsApp number with country code.');
  return digits;
}

function configuration() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0';
  if (!accessToken || !phoneNumberId) throw new WhatsAppConfigurationError('WhatsApp delivery is not configured.');
  return { accessToken, phoneNumberId, apiVersion };
}

async function postMessage(payload: Record<string, unknown>): Promise<string | undefined> {
  const { accessToken, phoneNumberId, apiVersion } = configuration();
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({})) as MetaError & MetaSuccess;
  if (!response.ok) throw new WhatsAppDeliveryError(body.error?.message || 'WhatsApp rejected the message.', body.error?.code);
  return body.messages?.[0]?.id;
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<string | undefined> {
  const cleanTo = normalizeWhatsAppNumber(to);
  try {
    return await postMessage({ messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanTo, type: 'text', text: { preview_url: false, body: message } });
  } catch (error) {
    // Meta only permits free-form text inside the customer-service window. Mirror the
    // supplied test service by falling back to its approved hello_world template.
    if (!(error instanceof WhatsAppDeliveryError) || ![131026, 131047].includes(error.code || 0)) throw error;
    return postMessage({ messaging_product: 'whatsapp', to: cleanTo, type: 'template', template: { name: 'hello_world', language: { code: 'en_US' } } });
  }
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName = process.env.WHATSAPP_CONFIRMATION_TEMPLATE_NAME?.trim() || 'hello_world',
  languageCode = process.env.WHATSAPP_CONFIRMATION_TEMPLATE_LANGUAGE?.trim() || 'en_US',
): Promise<string | undefined> {
  return postMessage({
    messaging_product: 'whatsapp',
    to: normalizeWhatsAppNumber(to),
    type: 'template',
    template: { name: templateName, language: { code: languageCode } },
  });
}

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
}
