import '../config/settings.js';
import {
  registerUser,
  loginUser,
  completeMfa,
  refreshSession,
  revokeSession
} from '../auth/authService.js';

const TEST_EMAIL = 'local-admin@example.com';
const TEST_PASSWORD = 'StrongPass123!';
const TEST_IP = '127.0.0.1';

const log = (message, data) => {
  // eslint-disable-next-line no-console
  console.log(`[SMOKE] ${message}`, data ?? '');
};

const main = async () => {
  try {
    log('Ensuring test user exists');
    try {
      await registerUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        fullName: 'Local Admin',
        phone: '+5511999999999',
        consent: true
      });
      log('User registered');
    } catch (error) {
      if (!error.message?.includes('E-mail já cadastrado')) {
        throw error;
      }
      log('User already registered, continuing');
    }

    log('Performing login to trigger MFA');
    const loginResponse = await loginUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      ipAddress: TEST_IP
    });

    if (!loginResponse.mfaRequired) {
      throw new Error('Expected MFA to be required for login flow.');
    }

    if (!loginResponse.debugCode) {
      throw new Error('MFA_DEBUG_MODE deve estar habilitado para executar este script sem interação. Verifique seu e-mail para obter o código ou defina MFA_DEBUG_MODE=true no backend/.env.');
    }

    log('Completing MFA via debug code');
    const mfaResult = await completeMfa({
      challengeId: loginResponse.challengeId,
      code: loginResponse.debugCode,
      ipAddress: TEST_IP
    });

    log('MFA completed');
    const { tokens, user } = mfaResult;

    if (!tokens?.access?.token || !tokens?.refresh?.token) {
      throw new Error('Missing tokens after MFA completion.');
    }

    log('Access token issued', tokens.access.token.slice(0, 20));
    log('Refresh token issued', tokens.refresh.token.slice(0, 20));

    log('Refreshing session');
    const refreshed = await refreshSession({ refreshToken: tokens.refresh.token });
    log('Refresh succeeded', refreshed.tokens.access.token.slice(0, 20));

    log('Revoking session');
    await revokeSession({
      refreshToken: tokens.refresh.token,
      accessJti: tokens.access.jti,
      userId: user.id
    });

    log('Smoke test finished successfully');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[SMOKE] Failure', error);
    process.exitCode = 1;
  }
};

await main();
