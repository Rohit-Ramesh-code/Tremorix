const express = require('express');
const router = express.Router();

module.exports = (db) => {
  router.get('/', (req, res) => {
    const profiles = db.prepare('SELECT id, name, avatar_url FROM profiles').all();
    res.json(profiles);
  });
  return router;
};
