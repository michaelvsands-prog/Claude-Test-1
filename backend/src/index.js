require('dotenv').config();
const express = require('express');
const cors = require('cors');
const tracksRouter = require('./routes/tracks');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));
app.use('/api/tracks', tracksRouter);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
