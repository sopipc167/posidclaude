const express = require('express');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../db');

const app = express();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

app.use(express.json());

function requireAdmin(req, res, next) {
  const passcode = req.header('x-admin-passcode');
  if (!passcode || passcode !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '관리자 암호가 올바르지 않습니다.' });
  }
  next();
}

function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch (e) {
    return null;
  }
}

function serializeGift(gift, voteCount, votedByMe) {
  return {
    id: gift._id.toString(),
    text: gift.text,
    proposerName: gift.proposerName,
    department: gift.department || '',
    createdAt: gift.createdAt,
    voteCount: voteCount || 0,
    votedByMe: !!votedByMe,
  };
}

const withVoteCountPipeline = (voterId) => [
  {
    $lookup: {
      from: 'votes',
      localField: '_id',
      foreignField: 'giftId',
      as: 'votes',
    },
  },
  {
    $addFields: {
      voteCount: { $size: '$votes' },
      votedByMe: voterId ? { $in: [voterId, '$votes.voterId'] } : false,
    },
  },
  { $project: { votes: 0 } },
];

// 선물 제안 목록 (투표수 내림차순)
app.get('/api/gifts', async (req, res) => {
  const voterId = req.query.voterId || '';
  const { gifts } = await getCollections();
  const docs = await gifts
    .aggregate([...withVoteCountPipeline(voterId), { $sort: { voteCount: -1, createdAt: 1 } }])
    .toArray();
  res.json(docs.map((g) => serializeGift(g, g.voteCount, g.votedByMe)));
});

// 새 선물 제안 등록
app.post('/api/gifts', async (req, res) => {
  const { text, proposerName, department } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: '선물 내용을 입력해 주세요.' });
  }
  if (!proposerName || !proposerName.trim()) {
    return res.status(400).json({ error: '이름을 입력해 주세요.' });
  }

  const { gifts } = await getCollections();
  const doc = {
    text: text.trim(),
    proposerName: proposerName.trim(),
    department: (department || '').trim(),
    createdAt: new Date(),
  };
  const result = await gifts.insertOne(doc);
  res.status(201).json(serializeGift({ _id: result.insertedId, ...doc }, 0, false));
});

// 특정 제안에 투표 / 취소 (토글)
app.post('/api/gifts/:id/vote', async (req, res) => {
  const giftId = toObjectId(req.params.id);
  if (!giftId) {
    return res.status(404).json({ error: '존재하지 않는 제안입니다.' });
  }
  const { voterId, voterName, voterDepartment } = req.body || {};
  if (!voterId) {
    return res.status(400).json({ error: 'voterId가 필요합니다.' });
  }

  const { gifts, votes } = await getCollections();
  const gift = await gifts.findOne({ _id: giftId });
  if (!gift) {
    return res.status(404).json({ error: '존재하지 않는 제안입니다.' });
  }

  const existing = await votes.findOne({ giftId, voterId });
  if (existing) {
    await votes.deleteOne({ _id: existing._id });
  } else {
    await votes.insertOne({
      giftId,
      voterId,
      voterName: voterName || '',
      voterDepartment: voterDepartment || '',
      createdAt: new Date(),
    });
  }

  const voteCount = await votes.countDocuments({ giftId });
  res.json(serializeGift(gift, voteCount, !existing));
});

// ---- 관리자 API ----

app.post('/api/admin/login', (req, res) => {
  const { passcode } = req.body || {};
  if (passcode === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: '암호가 올바르지 않습니다.' });
});

app.get('/api/admin/summary', requireAdmin, async (req, res) => {
  const { gifts, votes } = await getCollections();
  const totalGifts = await gifts.countDocuments();
  const totalVotes = await votes.countDocuments();

  const proposerNames = await gifts.distinct('proposerName');
  const voterNames = await votes.distinct('voterName', { voterName: { $nin: [null, ''] } });
  const uniqueParticipants = new Set([...proposerNames, ...voterNames]).size;

  const topDocs = await gifts
    .aggregate([...withVoteCountPipeline(''), { $sort: { voteCount: -1, createdAt: 1 } }, { $limit: 1 }])
    .toArray();
  const top = topDocs[0];

  res.json({
    totalGifts,
    totalVotes,
    uniqueParticipants,
    topGift: top
      ? { text: top.text, proposerName: top.proposerName, voteCount: top.voteCount }
      : null,
  });
});

app.delete('/api/admin/gifts/:id', requireAdmin, async (req, res) => {
  const giftId = toObjectId(req.params.id);
  if (!giftId) {
    return res.json({ ok: true });
  }
  const { gifts, votes } = await getCollections();
  await gifts.deleteOne({ _id: giftId });
  await votes.deleteMany({ giftId });
  res.json({ ok: true });
});

app.get('/api/admin/export.csv', requireAdmin, async (req, res) => {
  const { gifts } = await getCollections();
  const rows = await gifts
    .aggregate([...withVoteCountPipeline(''), { $sort: { voteCount: -1, createdAt: 1 } }])
    .toArray();

  const escapeCsv = (value) => {
    const s = String(value ?? '');
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = ['순번', '선물', '제안자', '부서', '득표수', '등록일시'];
  const lines = [header.join(',')];
  rows.forEach((r, idx) => {
    const createdAt = r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt;
    lines.push(
      [idx + 1, r.text, r.proposerName, r.department, r.voteCount, createdAt]
        .map(escapeCsv)
        .join(',')
    );
  });
  const csv = '﻿' + lines.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gift-list.csv"');
  res.send(csv);
});

module.exports = app;
