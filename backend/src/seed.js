import { User } from './models/User.js';
import { Team } from './models/Team.js';
import { nameFromEmail } from './utils/email.js';
import { config } from './config.js';

export async function seedUsersAndTeams() {
  const adminEmail = config.bootstrapAdminEmail.toLowerCase();
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      email: adminEmail,
      name: nameFromEmail(adminEmail),
      role: 'Admin',
      teamIds: [],
    });
    console.log(`Seeded bootstrap admin: ${adminEmail}`);
  } else if (admin.role !== 'Admin') {
    admin.role = 'Admin';
    await admin.save();
  }

  const teamCount = await Team.countDocuments();
  if (teamCount === 0) {
    await Team.insertMany([
      { name: 'Logistics Operations', members: [] },
      { name: 'Last Mile Delivery', members: [] },
    ]);
    console.log('Seeded default teams');
  }
}
