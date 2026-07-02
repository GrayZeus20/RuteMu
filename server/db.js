const fs = require('fs');
const path = require('path');

function resolveDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  const dir = path.join(__dirname, '..', 'data');
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return dir;
  } catch {
    const tmp = '/tmp/data';
    fs.mkdirSync(tmp, { recursive: true });
    return tmp;
  }
}

const dataDir = resolveDir();
const dbPath = path.join(dataDir, 'db.json');
console.log('Data dir:', dataDir);

const DEFAULT_DATA = {
  vehicles: [],
  trips: [],
  positions: []
};

let data = null;

function load() {
  if (data) return data;
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
