// Two-step sign-in (an authenticator app code after the password) is required
// for the people who can add members and see the most: the Chairman and Curators.
// Everyone else can turn it on from their profile.
import type { Role } from './types';

export const needsTwoStep = (role: Role | null | undefined) => role === 'chairman' || role === 'curator';
