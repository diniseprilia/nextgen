import { User } from '../models/User.js';
import { isEmailAllowed, nameFromEmail } from '../utils/email.js';
import { config } from '../config.js';

export async function provisionUserFromSso({ email, auth0Sub }) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isEmailAllowed(normalizedEmail)) {
    const err = new Error(`Please sign in with your @${config.allowedDomain} Google account.`);
    err.status = 403;
    throw err;
  }

  let user = await User.findOne({ email: normalizedEmail });
  const isAdminEmail = normalizedEmail === config.bootstrapAdminEmail.toLowerCase();

  if (!user) {
    user = await User.create({
      email: normalizedEmail,
      name: nameFromEmail(normalizedEmail),
      role: isAdminEmail ? 'Admin' : 'Rookie',
      teamIds: [],
      auth0Sub,
      lastLogin: new Date(),
    });
  } else {
    if (!user.auth0Sub && auth0Sub) user.auth0Sub = auth0Sub;
    user.lastLogin = new Date();
    if (isAdminEmail) {
      user.role = 'Admin';
    } else if (!user.role) {
      user.role = 'Rookie';
    }
    await user.save();
  }

  return user;
}
