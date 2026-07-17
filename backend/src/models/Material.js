import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    bucket: { type: String, required: true },
    objectKey: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    extension: { type: String, required: true },
  },
  { _id: false }
);

const materialSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    group: { type: String, required: true, trim: true },
    sourceType: { type: String, enum: ['file', 'url'], required: true },
    sourceUrl: { type: String, default: null },
    file: { type: fileSchema, default: null },
    content: { type: String, default: null },
    teamId: { type: String, default: null, index: true },
    createdBy: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

materialSchema.index({ group: 1 });
materialSchema.index({ sourceType: 1 });
materialSchema.index({ updatedAt: -1 });

export const Material = mongoose.model('Material', materialSchema);
