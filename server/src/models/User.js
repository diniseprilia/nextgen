import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['Rookie', 'Master', 'Admin'], default: 'Rookie' },
    teamIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    googleSub: { type: String, default: null, sparse: true },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ name: 'text', email: 'text' });

export const User = mongoose.model('User', userSchema);

export function toPublicUser(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    teamIds: (doc.teamIds || []).map((id) => id.toString()),
    lastLogin: doc.lastLogin ? doc.lastLogin.toISOString() : null,
  };
}
