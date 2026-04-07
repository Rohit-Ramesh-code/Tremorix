const express = require('express');
const app = express();

const router1 = express.Router();
router1.get('/', (req, res) => res.json([{id: 1}]));

const router2 = express.Router({ mergeParams: true });
router2.get('/', (req, res) => res.json({ id: req.params.id, success: true }));

app.use('/api/profiles', router1);
app.use('/api/profiles/:id/telemetry', router2);

const request = require('http').request;
const server = app.listen(0, () => {
  const port = server.address().port;
  request(`http://127.0.0.1:${port}/api/profiles/1/telemetry`, (res) => {
    console.log('STATUS:', res.statusCode);
    let data = '';
    res.on('data', c => data+=c);
    res.on('end', () => {
      console.log('BODY:', data);
      server.close();
      process.exit(0);
    });
  }).end();
});
