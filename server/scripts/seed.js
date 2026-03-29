const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../db/tremorix.db');
const schemaPath = path.join(__dirname, '../db/schema.sql');

const db = new Database(dbPath);
db.exec(fs.readFileSync(schemaPath, 'utf8'));

// IDEMPOTENCY: clear and repopulate
db.exec('DELETE FROM telemetry');
db.exec('DELETE FROM profiles');
db.exec("DELETE FROM sqlite_sequence WHERE name='telemetry' OR name='profiles'");

const insertProfile = db.prepare('INSERT INTO profiles (name, avatar_url) VALUES (?, ?)');
const profile1 = insertProfile.run(
  'Alice Chen',
  'https://ui-avatars.com/api/?name=Alice+Chen&background=0D8ABC&color=fff&size=128'
);
const profile2 = insertProfile.run(
  'Marcus Webb',
  'https://ui-avatars.com/api/?name=Marcus+Webb&background=2E7D32&color=fff&size=128'
);

function getTargetAngle(hourOfDay, dayFactor) {
  let baseAmplitude;
  if (hourOfDay < 6) {
    baseAmplitude = 5 + Math.random() * 10;
  } else if (hourOfDay < 9) {
    baseAmplitude = 15 + Math.random() * 30;
  } else {
    baseAmplitude = 30 + Math.random() * 80;
  }
  return Math.max(5, baseAmplitude * dayFactor);
}

function seedProfile(profileId) {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const start = new Date(now - sevenDaysMs);
  const end = new Date(now);

  const dayFactors = Array.from({ length: 8 }, () => 0.6 + Math.random() * 0.6);
  const insert = db.prepare(
    'INSERT INTO telemetry (profile_id, recorded_at, pitch, roll, sp, sr) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row[0], row[1], row[2], row[3], row[4], row[5]);
  });

  const rows = [];
  let current = new Date(start);
  let smoothedAngle = 20;

  while (current <= end) {
    const hour = current.getUTCHours();
    const dayIndex = Math.floor((current - start) / (24 * 60 * 60 * 1000));
    const dayFactor = dayFactors[Math.min(dayIndex, dayFactors.length - 1)];

    const target = getTargetAngle(hour, dayFactor);
    smoothedAngle = 0.85 * smoothedAngle + 0.15 * target;

    const noise = (Math.random() + Math.random() - 1) * 2;
    const magnitude = Math.max(0, smoothedAngle + noise) / 3; // Reduced scale to match real device ~15 degree swings

    const pitchBase = -8 + Math.sin(dayIndex) * 5;
    const rollBase = -6 + Math.cos(dayIndex) * 5;

    const pSign = Math.random() > 0.5 ? 1 : -1;
    const rSign = Math.random() > 0.5 ? 1 : -1;

    const pitch = parseFloat((pitchBase + magnitude * 0.7 * pSign).toFixed(2));
    const roll = parseFloat((rollBase + magnitude * 0.7 * rSign).toFixed(2));

    const sp = parseFloat((90 - pitch * 1.5).toFixed(2));
    const sr = parseFloat((90 - roll * 1.5).toFixed(2));

    rows.push([profileId, current.toISOString(), pitch, roll, sp, sr]);
    current = new Date(current.getTime() + 30 * 1000);
  }

  insertMany(rows);
  return rows.length;
}

const count1 = seedProfile(profile1.lastInsertRowid);
const count2 = seedProfile(profile2.lastInsertRowid);

console.log(`Seed complete: Profile 1 (Alice Chen) = ${count1} rows, Profile 2 (Marcus Webb) = ${count2} rows`);
console.log('Total rows:', count1 + count2);

db.close();
