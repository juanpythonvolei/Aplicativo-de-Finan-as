export interface BiometricProfile {
  enabled: boolean;
  credentialId: string; // Public WebAuthn credential identifier (base64url, non-secret)
  uid: string;
  email: string;
  displayName: string;
  provider: 'google' | 'password';
  enrolledAt: string;
  lastUnlockedAt?: string;
}

const STORAGE_KEY = 'vertice_biometric_profile_v1';

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padLen));
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function generateRandomChallenge(size = 32): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(size);
  const bytes = new Uint8Array(buffer);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function getBiometricMethodLabel(): string {
  if (typeof navigator === 'undefined') return 'Face ID / Impressão Digital';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|Mac OS X/i.test(ua)) return 'Face ID / Touch ID';
  if (/Windows/i.test(ua)) return 'Windows Hello / Biometria';
  if (/Android/i.test(ua)) return 'Impressão Digital / Face Unlock';
  return 'Biometria (Face ID / Digital)';
}

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.isSecureContext) return false;
  if (typeof window.PublicKeyCredential !== 'function') return false;
  if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function loadBiometricProfile(): BiometricProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BiometricProfile>;
    if (
      !parsed ||
      parsed.enabled !== true ||
      typeof parsed.credentialId !== 'string' ||
      !parsed.credentialId ||
      typeof parsed.uid !== 'string' ||
      !parsed.uid
    ) {
      return null;
    }
    return {
      enabled: true,
      credentialId: parsed.credentialId,
      uid: parsed.uid,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
      provider: parsed.provider === 'google' ? 'google' : 'password',
      enrolledAt: typeof parsed.enrolledAt === 'string' ? parsed.enrolledAt : new Date().toISOString(),
      lastUnlockedAt: typeof parsed.lastUnlockedAt === 'string' ? parsed.lastUnlockedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function saveBiometricProfile(profile: BiometricProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearBiometricProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function mapBiometricError(err: unknown): string {
  const name =
    typeof err === 'object' && err !== null && 'name' in err
      ? String((err as { name?: unknown }).name || '')
      : '';
  const msg = err instanceof Error ? err.message : '';

  if (name === 'NotAllowedError') {
    if (msg.toLowerCase().includes('feature is not enabled') || msg.toLowerCase().includes('publickey-credentials')) {
      return 'A biometria requer abrir o aplicativo diretamente na janela principal do navegador (fora de iframe).';
    }
    return 'Verificação biométrica cancelada ou não autorizada.';
  }
  if (name === 'SecurityError') {
    return 'A biometria exige conexão segura (HTTPS) no domínio principal do aplicativo.';
  }
  if (name === 'NotSupportedError') {
    return 'Este dispositivo ou navegador não possui autenticador biométrico compatível.';
  }
  if (name === 'InvalidStateError') {
    return 'Credencial biométrica já registrada neste dispositivo.';
  }
  return msg || 'Não foi possível concluir a autenticação biométrica.';
}

export async function enrollBiometricForUser(params: {
  uid: string;
  email: string;
  displayName: string;
  provider: 'google' | 'password';
}): Promise<BiometricProfile> {
  const available = await isBiometricHardwareAvailable();
  if (!available) {
    throw new Error('Autenticador biométrico indisponível neste dispositivo ou navegador.');
  }

  const encoder = new TextEncoder();
  const userIdRaw = encoder.encode(params.uid.slice(0, 64));
  const userIdBuffer = new ArrayBuffer(userIdRaw.byteLength);
  new Uint8Array(userIdBuffer).set(userIdRaw);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: generateRandomChallenge(),
      rp: {
        name: 'Vértice Finance',
      },
      user: {
        id: new Uint8Array(userIdBuffer),
        name: params.email || params.uid,
        displayName: params.displayName || params.email || 'Usuário Vértice',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;

  if (!credential || !credential.rawId) {
    throw new Error('O dispositivo não retornou uma credencial biométrica válida.');
  }

  const profile: BiometricProfile = {
    enabled: true,
    credentialId: bufferToBase64Url(credential.rawId),
    uid: params.uid,
    email: params.email,
    displayName: params.displayName,
    provider: params.provider,
    enrolledAt: new Date().toISOString(),
    lastUnlockedAt: new Date().toISOString(),
  };

  saveBiometricProfile(profile);
  return profile;
}

export async function authenticateWithBiometric(profile: BiometricProfile): Promise<boolean> {
  const available = await isBiometricHardwareAvailable();
  if (!available) {
    throw new Error('Autenticador biométrico indisponível neste dispositivo.');
  }

  const credIdBytes = base64UrlToBuffer(profile.credentialId);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: generateRandomChallenge(),
      allowCredentials: [
        {
          id: credIdBytes,
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion || !assertion.rawId) {
    return false;
  }

  const returnedId = bufferToBase64Url(assertion.rawId);
  if (returnedId !== profile.credentialId) {
    return false;
  }

  // Verify User Present (UP = 0x01) and User Verified (UV = 0x04) flags in authenticatorData
  const response = assertion.response as AuthenticatorAssertionResponse;
  const authData = new Uint8Array(response.authenticatorData);
  if (authData.byteLength < 37) {
    return false;
  }
  const flags = authData[32];
  const userPresent = (flags & 0x01) !== 0;
  const userVerified = (flags & 0x04) !== 0;
  if (!userPresent || !userVerified) {
    return false;
  }

  saveBiometricProfile({
    ...profile,
    lastUnlockedAt: new Date().toISOString(),
  });
  return true;
}
