import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

export const Team = mongoose.model('Team', teamSchema);

export function toPublicTeam(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    name: doc.name,
    members: (doc.members || []).map((id) => id.toString()),
  };
}
