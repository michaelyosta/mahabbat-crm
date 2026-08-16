import { createHmac, timingSafeEqual } from 'crypto';

export const canonicalizeInternalRouteBody = (body: unknown): string =>
  JSON.stringify(body);

export const signInternalRouteBody = (body: unknown, secret: string): string =>
  createHmac('sha256', secret)
    .update(canonicalizeInternalRouteBody(body), 'utf8')
    .digest('hex');

export const verifyInternalRouteBodySignature = ({
  body,
  signature,
  secret,
}: {
  body: unknown;
  signature: string | undefined;
  secret: string;
}): boolean => {
  if (!signature) return false;

  const expected = signInternalRouteBody(body, secret);
  const providedBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
};
