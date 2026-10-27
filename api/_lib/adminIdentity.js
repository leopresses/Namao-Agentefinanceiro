function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// ADMIN_UID is stable even when an account changes its email. The verified
// Google fallback preserves existing installations until the UID is configured.
export function isAdministrator(user) {
  if (!user || !(user.email_verified === true || user.emailVerified === true)) return false;
  const uid = process.env.ADMIN_UID?.trim();
  if (uid) return user.uid === uid;
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const isGoogle = user.firebase?.sign_in_provider === 'google.com'
    || user.providerData?.some((provider) => provider.providerId === 'google.com');
  return Boolean(email && isGoogle && normalizeEmail(user.email) === email);
}
