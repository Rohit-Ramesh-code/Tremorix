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
    'INSERT INTO telemetry (profile_id, recorded_at, correction_angle) VALUES (?, ?, ?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row[0], row[1], row[2]);
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

    const noise = (Math.random() + Math.random() - 1) * 4;
    const angle = Math.max(5, Math.min(130, smoothedAngle + noise));

    rows.push([profileId, current.toISOString(), parseFloat(angle.toFixed(2))]);
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
