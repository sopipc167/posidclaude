const path = require('path');
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

// A/B/C 중 하나 + 입사년도 4자리 + 입사월 2자리(01~12) + 입사순서 2자리
const EMPLOYEE_ID_REGEX = /^[A-C]\d{4}(0[1-9]|1[0-2])\d{2}$/;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function normalizeEmployeeId(value) {
  return String(value || '').trim().toUpperCase();
}

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
    proposerEmployeeId: row.proposer_employee_id,
    proposerName: row.proposer_name,
    team: row.team,
    createdAt: row.created_at,
    voteCount: row.vote_count,
    votedByMe: !!row.voted_by_me,
  };
}

// 선물 제안 목록 (투표수 내림차순)
app.get('/api/gifts', (req, res) => {
  const employeeId = normalizeEmployeeId(req.query.employeeId);
  const rows = db
    .prepare(
      `SELECT g.*,
              (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id) AS vote_count,
              (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id AND v.employee_id = ?) AS voted_by_me
       FROM gifts g
       ORDER BY vote_count DESC, g.created_at ASC`
    )
    .all(employeeId);
  res.json(rows.map(serializeGift));
});

// 새 선물 제안 등록
app.post('/api/gifts', (req, res) => {
  const { text, employeeId, proposerName, team } = req.body || {};
  const normalizedEmployeeId = normalizeEmployeeId(employeeId);

  if (!text || !text.trim()) {
    return res.status(400).json({ error: '선물 내용을 입력해 주세요.' });
  }
  if (!EMPLOYEE_ID_REGEX.test(normalizedEmployeeId)) {
    return res.status(400).json({ error: '사번 형식이 올바르지 않습니다. 예: A20220802' });
  }
  if (!proposerName || !proposerName.trim()) {
    return res.status(400).json({ error: '이름을 입력해 주세요.' });
  }
  if (!team || !team.trim()) {
    return res.status(400).json({ error: '팀 명을 입력해 주세요.' });
  }

  const info = db
    .prepare(
      `INSERT INTO gifts (text, proposer_employee_id, proposer_name, team) VALUES (?, ?, ?, ?)`
    )
    .run(text.trim(), normalizedEmployeeId, proposerName.trim(), team.trim());
  const row = db
    .prepare(`SELECT g.*, 0 AS vote_count, 0 AS voted_by_me FROM gifts g WHERE g.id = ?`)
    .get(info.lastInsertRowid);
  res.status(201).json(serializeGift(row));
});

// 특정 제안에 투표 / 취소 (토글) — 사번 기준으로 한 사람당 한 표
app.post('/api/gifts/:id/vote', (req, res) => {
  const giftId = Number(req.params.id);
  const { employeeId, voterName, team } = req.body || {};
  const normalizedEmployeeId = normalizeEmployeeId(employeeId);

  if (!EMPLOYEE_ID_REGEX.test(normalizedEmployeeId)) {
    return res.status(400).json({ error: '사번 형식이 올바르지 않습니다. 예: A20220802' });
  }
  const gift = db.prepare('SELECT id FROM gifts WHERE id = ?').get(giftId);
  if (!gift) {
    return res.status(404).json({ error: '존재하지 않는 제안입니다.' });
  }

  const existing = db
    .prepare('SELECT id FROM votes WHERE gift_id = ? AND employee_id = ?')
    .get(giftId, normalizedEmployeeId);

  if (existing) {
    db.prepare('DELETE FROM votes WHERE id = ?').run(existing.id);
  } else {
    db.prepare(
      `INSERT INTO votes (gift_id, employee_id, voter_name, team) VALUES (?, ?, ?, ?)`
    ).run(giftId, normalizedEmployeeId, voterName || '', team || '');
  }

  const row = db
    .prepare(
      `SELECT g.*,
              (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id) AS vote_count,
              (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id AND v.employee_id = ?) AS voted_by_me
       FROM gifts g WHERE g.id = ?`
    )
    .get(normalizedEmployeeId, giftId);
  res.json(serializeGift(row));
});

// ---- 관리자 API ----

app.post('/api/admin/login', (req, res) => {
  const { passcode } = req.body || {};
  if (passcode === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: '암호가 올바르지 않습니다.' });
});

app.get('/api/admin/summary', requireAdmin, (req, res) => {
  const totalGifts = db.prepare('SELECT COUNT(*) AS c FROM gifts').get().c;
  const totalVotes = db.prepare('SELECT COUNT(*) AS c FROM votes').get().c;
  const uniqueParticipants = db
    .prepare(
      `SELECT COUNT(*) AS c FROM (
         SELECT proposer_employee_id AS employee_id FROM gifts
         UNION
         SELECT employee_id FROM votes
       )`
    )
    .get().c;
  const top = db
    .prepare(
      `SELECT g.text, g.proposer_name,
              (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id) AS vote_count
       FROM gifts g ORDER BY vote_count DESC, g.created_at ASC LIMIT 1`
    )
    .get();
  res.json({
    totalGifts,
    totalVotes,
    uniqueParticipants,
    topGift: top ? { text: top.text, proposerName: top.proposer_name, voteCount: top.vote_count } : null,
  });
});

app.delete('/api/admin/gifts/:id', requireAdmin, (req, res) => {
  const giftId = Number(req.params.id);
  db.prepare('DELETE FROM gifts WHERE id = ?').run(giftId);
  res.json({ ok: true });
});

app.get('/api/admin/export.csv', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT g.id, g.text, g.proposer_employee_id, g.proposer_name, g.team, g.created_at,
              (SELECT COUNT(*) FROM votes v WHERE v.gift_id = g.id) AS vote_count
       FROM gifts g ORDER BY vote_count DESC, g.created_at ASC`
    )
    .all();

  const escapeCsv = (value) => {
    const s = String(value ?? '');
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = ['순번', '선물', '사번', '제안자', '팀명', '득표수', '등록일시'];
  const lines = [header.join(',')];
  rows.forEach((r, idx) => {
    lines.push(
      [idx + 1, r.text, r.proposer_employee_id, r.proposer_name, r.team, r.vote_count, r.created_at]
        .map(escapeCsv)
        .join(',')
    );
  });
  const csv = '﻿' + lines.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gift-list.csv"');
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`선물 취합 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
