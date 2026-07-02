const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'db.json');

const DEFAULT_DATA = {
  vehicles: [],
  trips: [],
  positions: []
};

let data = null;

function load() {
  if (data) return data;
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(dbPath)) {
    try {
      data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch {
      data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  } else {
    data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    save();
  }
  return data;
}

function save() {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function getDb() {
  return load();
}

module.exports = { getDb, save };
