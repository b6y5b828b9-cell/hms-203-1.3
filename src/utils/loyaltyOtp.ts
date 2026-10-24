interface OtpChallenge {
  challengeId: string;
  maskedPhone: string;
}

interface OtpVerification {
  authorizationToken: string;
}

const parseResponse = async (response: Response): Promise<{ message?: string; challengeId?: string; maskedPhone?: string; authorizationToken?: string }> => {
  let body: { message?: string; challengeId?: string; maskedPhone?: string; authorizationToken?: string };
  try {
    body = await response.json() as typeof body;
  } catch {
    throw new Error('Loyalty OTP service is not configured. Use another payment method or contact support.');
  }
  if (!response.ok) {
    throw new Error(body.message || 'The loyalty OTP service is unavailable. Use another payment method or contact support.');
  }
  return body;
};

export const requestLoyaltyOtp = async (invoiceId: string): Promise<OtpChallenge> => {
  const response = await fetch('/api/loyalty/otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoiceId }),
  });
  const result = await parseResponse(response);
  if (!result.challengeId || !result.maskedPhone) {
    throw new Error('The loyalty OTP service returned an invalid challenge. Use another payment method or contact support.');
  }
  return { challengeId: result.challengeId, maskedPhone: result.maskedPhone };
};

export const verifyLoyaltyOtp = async (challengeId: string, code: string): Promise<OtpVerification> => {
  const response = await fetch('/api/loyalty/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, code }),
  });
  const result = await parseResponse(response);
  if (!result.authorizationToken) {
    throw new Error('OTP verification did not return an authorization. Please request a new code.');
  }
  return { authorizationToken: result.authorizationToken };
};
