import { randomUUID } from 'node:crypto';
import { connect as connectNet, type Socket } from 'node:net';
import { connect as connectTls, type TLSSocket } from 'node:tls';

type MailInput = { to: string; caseNumber: string; inviteUrl: string; expiresAt: Date };

class SmtpConnection {
  private socket: Socket | TLSSocket;
  private buffer = '';
  private waiting: ((response: string) => void) | null = null;
  private failure: ((error: Error) => void) | null = null;

  constructor(socket: Socket | TLSSocket) {
    this.socket = socket;
    this.bind(socket);
  }

  private bind(socket: Socket | TLSSocket) {
    socket.setTimeout(15000, () => socket.destroy(new Error('SMTP connection timed out.')));
    socket.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      this.flush();
    });
    socket.on('error', (error) => this.failure?.(error));
    socket.on('close', () => this.failure?.(new Error('SMTP connection closed unexpectedly.')));
  }

  private takeResponse(): string | null {
    const lines = this.buffer.split('\r\n');
    for (let index = 0; index < lines.length - 1; index += 1) {
      if (/^\d{3} /.test(lines[index])) {
        const response = lines.slice(0, index + 1).join('\r\n');
        this.buffer = lines.slice(index + 1).join('\r\n');
        return response;
      }
    }
    return null;
  }

  private flush() {
    if (!this.waiting) return;
    const response = this.takeResponse();
    if (response) {
      const resolve = this.waiting;
      this.waiting = null;
      this.failure = null;
      resolve(response);
    }
  }

  async response() {
    const response = this.takeResponse();
    if (response) return response;
    return new Promise<string>((resolve, reject) => {
      this.waiting = resolve;
      this.failure = reject;
    });
  }

  async command(command: string, accepted: number[]) {
    this.socket.write(`${command}\r\n`);
    const response = await this.response();
    const code = Number(response.slice(0, 3));
    if (!accepted.includes(code)) throw new Error(`SMTP command failed with response ${code}.`);
    return response;
  }

  writeRaw(value: string) {
    this.socket.write(value);
  }

  async startTls(host: string) {
    const oldSocket = this.socket;
    oldSocket.removeAllListeners('data');
    oldSocket.pause();
    const secureSocket = connectTls({ socket: oldSocket, servername: host });
    await new Promise<void>((resolve, reject) => {
      secureSocket.once('secureConnect', resolve);
      secureSocket.once('error', reject);
    });
    this.socket = secureSocket;
    this.bind(secureSocket);
  }

  close() {
    this.socket.end();
  }
}

function wrapBase64(value: string) {
  const encoded = Buffer.from(value, 'utf8').toString('base64');
  return encoded.match(/.{1,76}/g)?.join('\r\n') ?? '';
}

async function sendTextEmail(to: string, subjectText: string, text: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  if (!host) return false;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true';
  const username = process.env.SMTP_USERNAME;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !from || /[\r\n<>]/.test(from) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)
    || /[\r\n<>]/.test(to) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || /[\r\n]/.test(subjectText)) {
    throw new Error('SMTP settings are incomplete or invalid.');
  }
  if ((username && !password) || (!username && password)) throw new Error('Set both SMTP_USERNAME and SMTP_PASSWORD, or leave both empty.');

  const socket = secure
    ? connectTls({ host, port, servername: host })
    : connectNet({ host, port });
  await new Promise<void>((resolve, reject) => {
    socket.once(secure ? 'secureConnect' : 'connect', resolve);
    socket.once('error', reject);
  });
  const smtp = new SmtpConnection(socket);
  try {
    const greeting = await smtp.response();
    if (!greeting.startsWith('220')) throw new Error('SMTP server did not accept the connection.');
    await smtp.command('EHLO reunite.local', [250]);
    if (!secure) {
      await smtp.command('STARTTLS', [220]);
      await smtp.startTls(host);
      await smtp.command('EHLO reunite.local', [250]);
    }
    if (username && password) {
      await smtp.command('AUTH LOGIN', [334]);
      await smtp.command(Buffer.from(username).toString('base64'), [334]);
      await smtp.command(Buffer.from(password).toString('base64'), [235]);
    }
    await smtp.command(`MAIL FROM:<${from}>`, [250]);
    await smtp.command(`RCPT TO:<${to}>`, [250, 251]);
    await smtp.command('DATA', [354]);
    const subject = `=?UTF-8?B?${Buffer.from(subjectText, 'utf8').toString('base64')}?=`;
    const message = [
      `From: REUNITE <${from}>`,
      `To: <${to}>`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${randomUUID()}@reunite.local>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(text)
    ].join('\r\n').replace(/(^|\r\n)\./g, '$1..');
    smtp.writeRaw(`${message}\r\n.\r\n`);
    const delivered = await smtp.response();
    if (!delivered.startsWith('250')) throw new Error('SMTP server did not accept the invitation email.');
    await smtp.command('QUIT', [221]).catch(() => undefined);
    return true;
  } finally {
    smtp.close();
  }
}

export async function sendModeratorInvitationEmail(input: MailInput): Promise<boolean> {
  return sendTextEmail(
    input.to,
    `REUNITE moderator invitation · ${input.caseNumber}`,
    `You have been invited to moderate REUNITE case ${input.caseNumber}.\n\nAccept this case-specific invitation:\n${input.inviteUrl}\n\nThe link expires ${input.expiresAt.toUTCString()} and can be used once. If you were not expecting this invitation, you can ignore this email.`
  );
}

export async function sendFamilyNotificationEmail(input: { to: string; caseNumber: string }): Promise<boolean> {
  const origin = process.env.FRONTEND_ORIGIN ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  const next = encodeURIComponent('/family/notifications');
  return sendTextEmail(
    input.to,
    `REUNITE case update · ${input.caseNumber}`,
    `There is a new private update for REUNITE case ${input.caseNumber}.\n\nSign in to your family account to review it: ${origin.replace(/\/$/, '')}/auth/login?next=${next}\n\nThis email does not contain private case details. If you were not expecting this update, sign in and check your account activity.`
  );
}
