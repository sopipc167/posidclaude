const express = require('express');
const db = require('../db');

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

function serializeGift(row) {
  return {
    id: row.id,
    text: row.text,
    proposerName: row.proposer_name,
    department: row.department || '',
    createdAt: row.created_at,
    voteCount: Number(row.vote_count) || 0,
    votedByMe: !!Number(row.voted_by_me),
  };
}

// 선물 제안 목록 (투표수 내림차순)
app.get('/api/gifts', async (req, res) => {
  const voterId = req.query.voterId || '';
  const { rows } = await db.query(
    `SELECT g.*,
            (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id) AS vote_count,
            (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id AND v.voter_id = $1) AS voted_by_me
     FROM gifts g
     ORDER BY vote_count DESC, g.created_at ASC`,
    [voterId]
  );
  res.json(rows.map(serializeGift));
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
  const { rows } = await db.query(
    `INSERT INTO gifts (text, proposer_name, department) VALUES ($1, $2, $3) RETURNING *`,
    [text.trim(), proposerName.trim(), (department || '').trim()]
  );
  res.status(201).json(serializeGift({ ...rows[0], vote_count: 0, voted_by_me: 0 }));
});

// 특정 제안에 투표 / 취소 (토글)
app.post('/api/gifts/:id/vote', async (req, res) => {
  const giftId = Number(req.params.id);
  const { voterId, voterName, voterDepartment } = req.body || {};
  if (!voterId) {
    return res.status(400).json({ error: 'voterId가 필요합니다.' });
  }

  const giftCheck = await db.query('SELECT id FROM gifts WHERE id = $1', [giftId]);
  if (giftCheck.rows.length === 0) {
    return res.status(404).json({ error: '존재하지 않는 제안입니다.' });
  }

  const existing = await db.query(
    'SELECT id FROM votes WHERE gift_id = $1 AND voter_id = $2',
    [giftId, voterId]
  );

  if (existing.rows.length > 0) {
    await db.query('DELETE FROM votes WHERE id = $1', [existing.rows[0].id]);
  } else {
    await db.query(
      `INSERT INTO votes (gift_id, voter_id, voter_name, voter_department) VALUES ($1, $2, $3, $4)`,
      [giftId, voterId, voterName || '', voterDepartment || '']
    );
  }

  const { rows } = await db.query(
    `SELECT g.*,
            (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id) AS vote_count,
            (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id AND v.voter_id = $1) AS voted_by_me
     FROM gifts g WHERE g.id = $2`,
    [voterId, giftId]
  );
  res.json(serializeGift(rows[0]));
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
  const totalGifts = (await db.query('SELECT COUNT(*) AS c FROM gifts')).rows[0].c;
  const totalVotes = (await db.query('SELECT COUNT(*) AS c FROM votes')).rows[0].c;
  const uniqueParticipants = (
    await db.query(`
      SELECT COUNT(*) AS c FROM (
        SELECT proposer_name AS name FROM gifts
        UNION
        SELECT voter_name AS name FROM votes WHERE voter_name IS NOT NULL AND voter_name != ''
      ) t
    `)
  ).rows[0].c;
  const topRows = (
    await db.query(`
      SELECT g.text, g.proposer_name,
             (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id) AS vote_count
      FROM gifts g ORDER BY vote_count DESC, g.created_at ASC LIMIT 1
    `)
  ).rows;
  const top = topRows[0];
  res.json({
    totalGifts: Number(totalGifts),
    totalVotes: Number(totalVotes),
    uniqueParticipants: Number(uniqueParticipants),
    topGift: top
      ? { text: top.text, proposerName: top.proposer_name, voteCount: Number(top.vote_count) }
      : null,
  });
});

app.delete('/api/admin/gifts/:id', requireAdmin, async (req, res) => {
  const giftId = Number(req.params.id);
  await db.query('DELETE FROM gifts WHERE id = $1', [giftId]);
  res.json({ ok: true });
});

app.get('/api/admin/export.csv', requireAdmin, async (req, res) => {
  const { rows } = await db.query(`
    SELECT g.id, g.text, g.proposer_name, g.department, g.created_at,
           (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id) AS vote_count
    FROM gifts g ORDER BY vote_count DESC, g.created_at ASC
  `);

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
    const createdAt = r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at;
    lines.push(
      [idx + 1, r.text, r.proposer_name, r.department, r.vote_count, createdAt]
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
