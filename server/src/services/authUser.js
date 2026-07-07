import { User } from '../models/User.js';
import { isEmailAllowed, nameFromEmail } from '../utils/email.js';
import { config } from '../config.js';

export async function provisionUserFromSso({ email, auth0Sub }) {
  if (!isEmailAllowed(email)) {
    const err = new Error(`Please sign in with your @${config.allowedDomain} Google account.`);
    err.status = 403;
    throw err;
  }

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      name: nameFromEmail(email),
      role: 'Rookie',
      teamIds: [],
      auth0Sub,
      lastLogin: new Date(),
    });
  } else {
    if (!user.auth0Sub && auth0Sub) user.auth0Sub = auth0Sub;
    user.lastLogin = new Date();
    if (!user.role) user.role = 'Rookie';
    await user.save();
  }

  return user;
}
