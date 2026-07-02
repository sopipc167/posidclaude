if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv is optional; ignore if not installed
  }
}

const path = require('path');
const express = require('express');
const app = require('./api/index.js');

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`선물 취합 서버(로컬)가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
