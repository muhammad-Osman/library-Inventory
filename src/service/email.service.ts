// src/service/email.service.ts
import { Resend } from 'resend';
import type { CreateEmailOptions } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  throw new Error('RESEND_API_KEY is missing. Put it in your .env');
}

export const resend = new Resend(apiKey);

type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;                   
  replyTo?: string | string[];     
  headers?: Record<string, string>;
};

const DEFAULT_FROM = process.env.MAIL_FROM ?? 'Dummy Library <no-reply@example.com>';
const DEFAULT_REPLY_TO = process.env.MAIL_REPLY_TO;

type ResendSendResult<T = unknown> =
  | { data: T; error: null; headers?: Record<string, string> | null }
  | { data: null; error: { message: string; statusCode?: number | null; name?: string }; headers?: Record<string, string> | null };

export async function sendEmail(opts: SendEmailOptions) {
  const { to, subject, html, text, headers, replyTo, from } = opts;

  if (!html && !text) {
    throw new Error('sendEmail requires at least one of: html or text');
  }

  const base = {
    from: from ?? DEFAULT_FROM,
    to,
    subject,
    headers,
    replyTo: replyTo ?? DEFAULT_REPLY_TO,
    template: undefined,
  } as const;

  let payload: CreateEmailOptions;
  if (html) {
    payload = {
      ...base,
      html,
      ...(text ? { text } : {}),
    } satisfies CreateEmailOptions;
  } else {
    payload = {
      ...base,
      text: text!,
    } satisfies CreateEmailOptions;
  }

  const result = (await resend.emails.send(payload)) as ResendSendResult<{ id: string }>;

  if ('error' in result && result.error) {
    const msg = result.error?.message ?? 'Unknown error';
    throw new Error(`Resend send failed: ${msg}`);
  }

  return result.data;
}
