const express = require('express');
const router = express.Router({ mergeParams: true });

module.exports = (db) => {
  router.get('/', (req, res) => {
    const { id } = req.params;
    const rows = db.prepare(`
      SELECT recorded_at, pitch, roll, sp, sr
      FROM telemetry
      WHERE profile_id = ?
        AND recorded_at >= datetime('now', '-7 days')
      ORDER BY recorded_at ASC
    `).all(id);
    res.json(rows);
  });
  return router;
};
