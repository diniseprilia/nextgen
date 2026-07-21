import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [String], default: undefined },
    correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
    acceptableAnswers: { type: [String], default: undefined },
    referenceAnswer: { type: String, default: undefined },
    rubricPoints: { type: [String], default: undefined },
    matchingPairs: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    correctAnswers: { type: [Number], default: undefined },
    explanation: { type: String, default: '' },
    format: { type: String, enum: ['multiple', 'truefalse', 'short', 'essay', 'matching', 'multi_select'], default: 'multiple' },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    materialIds: { type: [String], default: [] },
    questions: { type: [questionSchema], default: [] },
    minScore: { type: Number, required: true, default: 80 },
    status: { type: String, enum: ['Draft', 'Open', 'Closed'], default: 'Draft' },
    openDate: { type: String, default: null },
    closeDate: { type: String, default: null },
    formats: { type: [String], default: ['multiple'] },
    format: { type: String, default: 'multiple' },
    questionCount: { type: Number, default: 5 },
    synced: { type: Boolean, default: false },
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

courseSchema.index({ status: 1 });
courseSchema.index({ updatedAt: -1 });

export const Course = mongoose.model('Course', courseSchema);
