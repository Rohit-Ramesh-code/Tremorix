const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const dbPath = path.join(__dirname, 'db', 'tremorix.db');
const db = new Database(dbPath);

// Run schema on startup
const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
db.exec(schema);

app.use(cors());
app.use(express.json());

app.use('/api/profiles', require('./routes/profiles')(db));

const PORT = 5000;
app.listen(PORT, () => console.log(`Tremorix server running on port ${PORT}`));
