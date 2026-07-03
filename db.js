const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI 환경변수가 필요합니다.');
}

const dbName = process.env.MONGODB_DB || 'giftapp';

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri);
  global._mongoClientPromise = client.connect();
}

let indexesReady;
function ensureIndexes(db) {
  if (!indexesReady) {
    indexesReady = db.collection('votes').createIndex({ giftId: 1, voterId: 1 }, { unique: true });
  }
  return indexesReady;
}

async function getCollections() {
  const client = await global._mongoClientPromise;
  const db = client.db(dbName);
  await ensureIndexes(db);
  return { gifts: db.collection('gifts'), votes: db.collection('votes') };
}

module.exports = { getCollections };
