export type SubscriptionTag = 'subscription' | 'trial' | 'cancellation';

export interface GmailTokens {
  accessToken: string;
  refreshToken?: string;
  connectedAt: number;
}

export interface AttachmentResult {
  filename: string;
  mimeType: string;
  size: number;
  isConvertible: boolean;
  textContent?: string;
  error?: string;
}

export interface ScrapedEmail {
  id: string;
  threadId: string;
  labels: string[];
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  timestamp: number;
  bodyText: string;
  attachments: AttachmentResult[];
}

export type SubscriptionEvidence = Partial<Record<'status' | 'serviceName' | 'amount' | 'billingFrequency' | 'renewalOrEndDate', string>>;

export interface SubscriptionResult {
  emailId: string;
  subject: string;
  from: string;
  date: string;
  timestamp: number;
  isQualified: true;
  tag: SubscriptionTag;
  serviceName: string;
  amount?: string;
  billingFrequency?: string;
  renewalOrEndDate?: string;
  merchantInference?: string;
  renewalEstimate?: { date: string; explanation: string };
  summary: string;
  evidence?: SubscriptionEvidence;
}

export type ExtractionStage =
  | 'finding'
  | 'reading'
  | 'classifying'
  | 'preparing'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'confirmed';

export interface ExtractionJob {
  id: string;
  ownerId: string;
  total: number;
  processed: number;
  reviewed: number;
  errorCode?: string;
  percentage: number;
  stage: ExtractionStage;
  detail: string;
  cancelRequested?: boolean;
  results: SubscriptionResult[];
  rawResults: SubscriptionResult[];
  errors: string[];
  createdAt: number;
  updatedAt: number;
}
