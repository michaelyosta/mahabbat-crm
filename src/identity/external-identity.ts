import {
  parseIdentity,
  type Identity,
  type ParsedIdentity,
} from './identity-contract';

export type ExternalIdentityInput = {
  provider: unknown;
  externalId: unknown;
};

export type NormalizedExternalIdentity = ParsedIdentity;

export type ExternalIdentityError =
  | 'PROVIDER_REQUIRED'
  | 'PROVIDER_INVALID'
  | 'EXTERNAL_ID_REQUIRED'
  | 'EXTERNAL_ID_INVALID';

export type ExternalIdentityResult =
  | { ok: true; identity: NormalizedExternalIdentity }
  | { ok: false; error: ExternalIdentityError };

export const normalizeExternalIdentity = (
  input: ExternalIdentityInput,
): ExternalIdentityResult => {
  const parsed = parseIdentity(input);
  if (parsed.ok) return { ok: true, identity: parsed.data };

  const error = parsed.error.code === 'INVALID_PROVIDER'
    ? (typeof input.provider === 'string' && input.provider.trim().length > 0 ? 'PROVIDER_INVALID' : 'PROVIDER_REQUIRED')
    : parsed.error.code === 'INVALID_EXTERNAL_ID'
      ? (typeof input.externalId === 'string' && input.externalId.trim().length > 0 ? 'EXTERNAL_ID_INVALID' : 'EXTERNAL_ID_REQUIRED')
      : 'PROVIDER_REQUIRED';
  return { ok: false, error };
};

export type { Identity, ParsedIdentity };
