import { Router } from 'express';
import multer from 'multer';
import { Material } from '../models/Material.js';
import { requireAuth } from '../middleware/auth.js';
import {
  ensureBucket,
  getBucket,
  getObjectBuffer,
  getObjectStream,
  objectKeyFor,
  removeObject,
  uploadObject,
} from '../minio.js';
import {
  extractTextContent,
  formatBytes,
  getExtension,
  guessMimeType,
  isAllowedFile,
  UNSUPPORTED_FILE_ERROR,
} from '../utils/files.js';
import { fetchUrlMaterialText } from '../utils/confluence.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

router.use(requireAuth);

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

function toApiMaterial(doc) {
  const m = doc.toJSON ? doc.toJSON() : doc;
  return {
    id: m.id || m._id?.toString(),
    title: m.title,
    group: m.group,
    sourceType: m.sourceType,
    sourceUrl: m.sourceUrl,
    file: m.file,
    content: m.content,
    teamId: m.teamId,
    createdBy: m.createdBy,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

router.get('/', async (req, res) => {
  try {
    const query = buildListQuery(req.user, req.query.teamId);
    if (!query) return res.status(403).json({ error: 'You cannot access this team' });
    const materials = await Material.find(query).sort({ updatedAt: -1 });
    res.json(materials.map(toApiMaterial));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list materials' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });
    res.json(toApiMaterial(material));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get material' });
  }
});

router.get('/:id/content', async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });

    if (material.content?.trim()) {
      return res.json({ content: material.content });
    }

    if (material.sourceType === 'url') {
      if (material.content?.trim()) {
        return res.json({ content: material.content });
      }
      try {
        const fetched = await fetchUrlMaterialText(material.sourceUrl);
        if (fetched?.trim()) {
          material.content = fetched;
          await material.save();
          return res.json({ content: fetched });
        }
      } catch (err) {
        console.warn('URL content fetch failed:', err.message);
      }
      const content = [material.title, material.group, material.sourceUrl].filter(Boolean).join('\n');
      return res.json({ content });
    }

    if (!material.file?.objectKey) {
      return res.status(400).json({ error: 'Material has no extractable content' });
    }

    const buffer = await getObjectBuffer(material.file.objectKey);
    const extracted = await extractTextContent(buffer, material.file.extension);
    if (extracted?.trim()) {
      material.content = extracted;
      await material.save();
      return res.json({ content: extracted });
    }

    res.status(400).json({ error: 'Could not extract text from this file' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get material content' });
  }
});

router.get('/:id/preview', async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });
    if (material.sourceType !== 'file' || !material.file) {
      return res.status(400).json({ error: 'Material has no previewable file' });
    }

    const stream = await getObjectStream(material.file.objectKey);
    res.setHeader('Content-Type', material.file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(material.file.originalName)}"`
    );
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to preview file' });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });
    if (material.sourceType !== 'file' || !material.file) {
      return res.status(400).json({ error: 'Material has no downloadable file' });
    }

    const stream = await getObjectStream(material.file.objectKey);
    res.setHeader('Content-Type', material.file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(material.file.originalName)}"`
    );
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { title, group, sourceType, sourceUrl, createdBy, content, teamId } = req.body;

    if (!title?.trim() || !group?.trim()) {
      return res.status(400).json({ error: 'title and group are required' });
    }
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });
    if (!canAccessTeam(req.user, teamId)) {
      return res.status(403).json({ error: 'You cannot create materials for this team' });
    }

    if (sourceType === 'url') {
      if (!sourceUrl?.trim()) {
        return res.status(400).json({ error: 'sourceUrl is required for URL materials' });
      }
      const material = await Material.create({
        title: title.trim(),
        group: group.trim(),
        sourceType: 'url',
        sourceUrl: sourceUrl.trim(),
        teamId,
        createdBy: createdBy || null,
      });
      return res.status(201).json(toApiMaterial(material));
    }

    if (!req.file) {
      return res.status(400).json({ error: 'file is required for file materials' });
    }
    if (!isAllowedFile(req.file.originalname)) {
      return res.status(400).json({ error: UNSUPPORTED_FILE_ERROR });
    }

    await ensureBucket();

    const material = new Material({
      title: title.trim(),
      group: group.trim(),
      sourceType: 'file',
      teamId,
      createdBy: createdBy || null,
    });
    await material.save();

    const ext = getExtension(req.file.originalname);
    const objectKey = objectKeyFor(material._id.toString(), req.file.originalname);
    const mimeType = req.file.mimetype || guessMimeType(req.file.originalname);
    const extracted = content?.trim()
      || (await extractTextContent(req.file.buffer, ext));

    await uploadObject(objectKey, req.file.buffer, { 'Content-Type': mimeType });

    material.file = {
      bucket: getBucket(),
      objectKey,
      originalName: req.file.originalname,
      mimeType,
      sizeBytes: req.file.size,
      extension: ext,
    };
    material.content = extracted;
    await material.save();

    res.status(201).json(toApiMaterial(material));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create material' });
  }
});

router.put('/:id', upload.single('file'), async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const { title, group, sourceUrl, content } = req.body;
    if (title?.trim()) material.title = title.trim();
    if (group?.trim()) material.group = group.trim();

    if (material.sourceType === 'url') {
      if (sourceUrl?.trim()) {
        const next = sourceUrl.trim();
        if (next !== material.sourceUrl) {
          material.sourceUrl = next;
          material.content = null;
        }
      }
    } else if (req.file) {
      if (!isAllowedFile(req.file.originalname)) {
        return res.status(400).json({ error: UNSUPPORTED_FILE_ERROR });
      }
      await ensureBucket();
      if (material.file?.objectKey) {
        try { await removeObject(material.file.objectKey); } catch { /* ignore */ }
      }
      const ext = getExtension(req.file.originalname);
      const objectKey = objectKeyFor(material._id.toString(), req.file.originalname);
      const mimeType = req.file.mimetype || guessMimeType(req.file.originalname);
      await uploadObject(objectKey, req.file.buffer, { 'Content-Type': mimeType });
      material.file = {
        bucket: getBucket(),
        objectKey,
        originalName: req.file.originalname,
        mimeType,
        sizeBytes: req.file.size,
        extension: ext,
      };
      material.content = content?.trim() || (await extractTextContent(req.file.buffer, ext));
    } else if (content !== undefined) {
      material.content = content;
    }

    await material.save();
    res.json(toApiMaterial(material));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });

    if (material.sourceType === 'file' && material.file?.objectKey) {
      try {
        await removeObject(material.file.objectKey);
      } catch (err) {
        console.warn('MinIO delete warning:', err.message);
      }
    }

    await Material.deleteOne({ _id: material._id });
    res.json({ ok: true, id: material._id.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

export { formatBytes };
export default router;
