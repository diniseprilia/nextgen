import { Router } from 'express';
import { Course } from '../models/Course.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

function toApiCourse(doc) {
  const c = doc.toJSON ? doc.toJSON() : doc;
  return {
    id: c.id || c._id?.toString(),
    title: c.title,
    description: c.description,
    materialIds: c.materialIds || [],
    questions: c.questions || [],
    minScore: c.minScore,
    status: c.status,
    openDate: c.openDate,
    closeDate: c.closeDate,
    formats: c.formats,
    format: c.format,
    questionCount: c.questionCount,
    synced: c.synced,
    teamId: c.teamId,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function userTeamIds(user) {
  return (user.teamIds || []).map((id) => id.toString());
}

function canAccessTeam(user, teamId) {
  return user.role === 'Admin' || userTeamIds(user).includes(teamId);
}

function buildListQuery(user, teamId) {
  if (teamId) {
    if (!canAccessTeam(user, teamId)) return null;
    return { teamId };
  }
  if (user.role === 'Admin') return {};
  const ids = userTeamIds(user);
  if (!ids.length) return { teamId: '__none__' };
  return { teamId: { $in: ids } };
}

function applyScheduleStatuses(courses) {
  const today = new Date().toISOString().slice(0, 10);
  return courses.map((c) => {
    if (c.status === 'Draft') return c;
    if (c.closeDate && c.closeDate <= today) return { ...c, status: 'Closed' };
    if (c.status === 'Closed' && (!c.closeDate || c.closeDate > today)) {
      return { ...c, status: 'Open' };
    }
    return c;
  });
}

function canManageCourses(user) {
  return user.role === 'Master' || user.role === 'Admin';
}

router.get('/', async (req, res) => {
  try {
    const query = buildListQuery(req.user, req.query.teamId);
    if (!query) return res.status(403).json({ error: 'You cannot access this team' });
    const courses = await Course.find(query).sort({ updatedAt: -1 });
    res.json(applyScheduleStatuses(courses.map(toApiCourse)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list courses' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const [updated] = applyScheduleStatuses([toApiCourse(course)]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get course' });
  }
});

router.post('/', async (req, res) => {
  if (!canManageCourses(req.user)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  try {
    const teamId = req.body.teamId;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });
    if (!canAccessTeam(req.user, teamId)) {
      return res.status(403).json({ error: 'You cannot create courses for this team' });
    }
    const course = await Course.create({
      ...req.body,
      teamId,
      createdBy: req.user._id.toString(),
    });
    res.status(201).json(toApiCourse(course));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.put('/:id', async (req, res) => {
  if (!canManageCourses(req.user)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(toApiCourse(course));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

router.delete('/:id', async (req, res) => {
  if (!canManageCourses(req.user)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

export default router;
