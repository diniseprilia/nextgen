import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { connectDb } from './db.js';
import { ensureBucket } from './minio.js';
import materialsRouter from './routes/materials.js';
import questionsRouter from './routes/questions.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import teamsRouter from './routes/teams.js';
import coursesRouter from './routes/courses.js';
import attemptsRouter from './routes/attempts.js';
import logsRouter from './routes/logs.js';
import { requestLogger } from './middleware/requestLogger.js';
import { Material } from './models/Material.js';
import { Course } from './models/Course.js';
import { Team } from './models/Team.js';
import { seedUsersAndTeams } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

const app = express();
app.set('trust proxy', true);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(requestLogger);

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/attempts', attemptsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/admin/logs', logsRouter);
app.use(
  '/vendor/auth0',
  express.static(path.join(__dirname, '../node_modules/@auth0/auth0-spa-js/dist')),
);
app.use(express.static(rootDir, {
  setHeaders(res, filePath) {
    if (/\.(html|js|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  },
}));

const SPA_ROUTE_PATTERN = /^\/(dashboard|userandroles|systemlogs|settings|analytics(?:\/[^/]+)?|teamboard(?:\/(?:courses|teammates|materials)(?:\/[^/]+)?)?)$/;

app.get(SPA_ROUTE_PATTERN, (_req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.get('/api/health', async (_req, res) => {
  const [materials, courses] = await Promise.all([
    Material.countDocuments(),
    Course.countDocuments(),
  ]);
  res.json({ ok: true, materials, courses });
});

async function seedMaterialsIfEmpty() {
  const count = await Material.countDocuments();
  if (count > 0) return;

  const teams = await Team.find().sort({ name: 1 });
  const t1 = teams[0]?._id?.toString();
  const t2 = teams[1]?._id?.toString() || t1;
  if (!t1) return;

  await Material.insertMany([
    {
      title: 'Delivery Operations Guide',
      group: 'Operations',
      sourceType: 'url',
      sourceUrl: 'https://docs.ninjavan.co/ops',
      teamId: t1,
      createdBy: 'u_admin',
    },
    {
      title: 'Sorting Hub Procedures',
      group: 'Operations',
      sourceType: 'url',
      sourceUrl: 'https://docs.ninjavan.co/hub',
      teamId: t1,
      createdBy: 'u_admin',
    },
    {
      title: 'Customer Service Standards',
      group: 'Customer Experience',
      sourceType: 'url',
      sourceUrl: 'https://docs.ninjavan.co/cs',
      content: 'All customer inquiries must be acknowledged within 2 hours. Escalation tiers: Tier 1 handles tracking queries, Tier 2 handles delivery disputes, Tier 3 handles compensation claims.',
      teamId: t2,
      createdBy: 'u_admin',
    },
  ]);
  console.log('Seeded default URL materials');
}

async function backfillTeamIds() {
  const teams = await Team.find().sort({ createdAt: 1 });
  const t1 = teams[0]?._id?.toString();
  if (!t1) return;

  const missing = { $or: [{ teamId: { $exists: false } }, { teamId: null }, { teamId: '' }] };
  const [matResult, courseResult] = await Promise.all([
    Material.updateMany(missing, { $set: { teamId: t1 } }),
    Course.updateMany(missing, { $set: { teamId: t1 } }),
  ]);
  if (matResult.modifiedCount || courseResult.modifiedCount) {
    console.log(`Backfilled teamId on ${matResult.modifiedCount} materials and ${courseResult.modifiedCount} courses`);
  }
}

async function seedCoursesIfEmpty() {
  const count = await Course.countDocuments();
  if (count > 0) return;

  const materials = await Material.find().limit(3);
  const m1 = materials[0]?._id?.toString();
  const m2 = materials[1]?._id?.toString();
  const m3 = materials[2]?._id?.toString();
  const t1 = materials[0]?.teamId || (await Team.findOne())?._id?.toString();
  const t2 = materials[2]?.teamId || t1;

  await Course.insertMany([
    {
      title: 'Ops Basics 101',
      description: 'Introductory course for logistics dispatch routing.',
      materialIds: m1 ? [m1] : [],
      teamId: t1,
      questions: [
        {
          id: 'q1',
          question: 'What is the API dispatch cutoff time?',
          options: ['10 AM', '12 PM', '2 PM', '4 PM'],
          correctAnswer: 2,
          explanation: 'Cutoff is 2 PM to ensure packaging time.',
          format: 'multiple',
        },
        {
          id: 'q2',
          question: 'How many delivery attempts are required before return-to-sender?',
          options: ['1', '2', '3', '5'],
          correctAnswer: 2,
          explanation: 'Failed deliveries require three attempts before RTS.',
          format: 'multiple',
        },
        {
          id: 'q3',
          question: 'COD parcels must be collected before marking delivery complete.',
          options: ['True', 'False'],
          correctAnswer: 0,
          explanation: 'Cash on delivery must be collected at delivery.',
          format: 'truefalse',
        },
        {
          id: 'q4',
          question: 'When must drivers scan parcels?',
          options: ['Pickup only', 'Delivery only', 'Pickup and delivery', 'End of shift'],
          correctAnswer: 2,
          explanation: 'Scanning at both pickup and delivery ensures tracking accuracy.',
          format: 'multiple',
        },
        {
          id: 'q5',
          question: 'Customer notifications are sent via:',
          options: ['Email only', 'SMS', 'Phone call', 'App push only'],
          correctAnswer: 1,
          explanation: 'SMS notifications are sent at each delivery milestone.',
          format: 'multiple',
        },
      ],
      minScore: 80,
      status: 'Open',
      openDate: '2026-06-01',
      closeDate: null,
      synced: true,
      formats: ['multiple'],
      format: 'multiple',
      questionCount: 5,
    },
    {
      title: 'Hub Sorting Fundamentals',
      description: 'Learn hub sorting zone systems and quality checks.',
      materialIds: m2 ? [m2] : [],
      teamId: t1,
      questions: [
        {
          id: 'q6',
          question: 'Hub sorting uses a zone-based system organized by:',
          options: ['Weight', 'Destination postcode', 'Sender name', 'Package color'],
          correctAnswer: 1,
          explanation: 'Parcels are sorted by destination postcode zones.',
          format: 'multiple',
        },
        {
          id: 'q7',
          question: 'The morning shift at the hub runs until:',
          options: ['10 AM', '12 PM', '2 PM', '6 PM'],
          correctAnswer: 2,
          explanation: 'Morning shift is 6 AM to 2 PM.',
          format: 'multiple',
        },
        {
          id: 'q8',
          question: 'Weight verification is required for parcels over 5kg.',
          options: ['True', 'False'],
          correctAnswer: 0,
          explanation: 'Quality checks mandate weight verification above 5kg.',
          format: 'truefalse',
        },
      ],
      minScore: 70,
      status: 'Open',
      openDate: '2026-06-10',
      closeDate: null,
      synced: true,
      formats: ['multiple'],
      format: 'multiple',
      questionCount: 3,
    },
    {
      title: 'CS Excellence (Draft)',
      description: 'Customer service standards — draft for review.',
      materialIds: m3 ? [m3] : [],
      teamId: t2,
      questions: [],
      minScore: 80,
      status: 'Draft',
      openDate: null,
      closeDate: null,
      synced: false,
      formats: ['multiple'],
      format: 'multiple',
      questionCount: 5,
    },
  ]);
  console.log('Seeded default courses');
}

async function start() {
  await connectDb();
  await ensureBucket();
  await seedUsersAndTeams();
  await seedMaterialsIfEmpty();
  await seedCoursesIfEmpty();
  await backfillTeamIds();

  app.listen(config.port, () => {
    console.log(`NextGen server running at http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
