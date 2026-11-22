export const ADMIN_EMAILS: string[] = [
  'snehagsmagar88@gmail.com',
  'shibakk888@gmail.com',
  'punpriya55@gmail.com',
  'elsapandey00@gmail.com',
];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.some(
    (adminEmail) => adminEmail.trim().toLowerCase() === normalized
  );
}