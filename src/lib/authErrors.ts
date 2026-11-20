export interface AuthErrorResult {
  message: string;
  code: string;
  isProviderDisabled?: boolean;
}

export function mapFirebaseAuthError(error: unknown): AuthErrorResult {
  const errObj = error as { code?: string; message?: string } | null;
  const code = errObj?.code || '';
  const rawMessage = errObj?.message || String(error || '');

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return { code, message: 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.' };
    case 'auth/invalid-email':
      return { code, message: 'O endereço de e-mail informado não é válido.' };
    case 'auth/email-already-in-use':
      return {
        code,
        message: 'Este e-mail já está cadastrado. Tente entrar na sua conta ou recuperar a senha.',
      };
    case 'auth/weak-password':
      return {
        code,
        message: 'A senha é muito fraca. Utilize pelo menos 6 caracteres (recomendamos 8 ou mais).',
      };
    case 'auth/too-many-requests':
      return {
        code,
        message: 'Muitas tentativas em sequência. Aguarde alguns minutos antes de tentar novamente.',
      };
    case 'auth/user-disabled':
      return {
        code,
        message: 'Esta conta foi desativada. Entre em contato com o suporte.',
      };
    case 'auth/network-request-failed':
      return {
        code,
        message: 'Falha de conexão com a rede. Verifique sua internet e tente novamente.',
      };
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        code,
        message: 'O login com o Google foi cancelado antes da conclusão.',
      };
    case 'auth/popup-blocked':
      return {
        code,
        message: 'O navegador bloqueou a janela de login do Google. Permita pop-ups para continuar.',
      };
    case 'auth/requires-recent-login':
      return {
        code,
        message: 'Por segurança, confirme sua senha atual ou entre novamente antes desta alteração.',
      };
    case 'auth/credential-already-in-use':
    case 'auth/provider-already-linked':
      return {
        code,
        message: 'Este método de login já está vinculado a uma conta.',
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        isProviderDisabled: true,
        message:
          'O login por E-mail/Senha ainda não foi ativado no Firebase Console deste projeto. Ative-o em Authentication > Sign-in method > E-mail/senha ou entre com o Google.',
      };
    default:
      if (rawMessage.includes('operation-not-allowed')) {
        return {
          code: 'auth/operation-not-allowed',
          isProviderDisabled: true,
          message:
            'O login por E-mail/Senha ainda não foi ativado no Firebase Console deste projeto. Ative-o em Authentication > Sign-in method > E-mail/senha ou entre com o Google.',
        };
      }
      return {
        code: code || 'auth/unknown',
        message: rawMessage || 'Não foi possível concluir a autenticação. Tente novamente.',
      };
  }
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  checks: {
    minLength: boolean;
    hasUpperAndLower: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const checks = {
    minLength: password.length >= 8,
    hasUpperAndLower: /[a-z]/.test(password) && /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[^a-zA-Z0-9]/.test(password),
  };

  if (!password) {
    return { score: 0, label: 'Digite uma senha', checks };
  }

  let score = 0;
  if (password.length >= 6) score += 1;
  if (checks.minLength) score += 1;
  if (checks.hasUpperAndLower && checks.hasNumber) score += 1;
  if (checks.hasSymbol && password.length >= 10) score += 1;

  const clamped = Math.min(4, Math.max(1, score)) as 1 | 2 | 3 | 4;
  const labels: Record<1 | 2 | 3 | 4, string> = {
    1: 'Fraca',
    2: 'Razoável',
    3: 'Forte',
    4: 'Excelente',
  };

  return {
    score: clamped,
    label: labels[clamped],
    checks,
  };
}
