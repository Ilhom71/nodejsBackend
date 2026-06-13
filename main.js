const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/videos/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (req, file, cb) => {
    const allowed = /mp4|mkv|avi|mov|webm/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Faqat video fayl yuklash mumkin (mp4, mkv, avi, mov, webm)'));
    }
  },
});

app.get('/', (req, res) => {
  res.send('Video API ishlamoqda');
});

// Barcha videolar ro'yxati
app.get('/videos', (req, res) => {
  const dir = path.join(__dirname, 'uploads/videos');
  fs.readdir(dir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Fayllarni o\'qib bo\'lmadi' });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const videos = files.map((file) => ({
      filename: file,
      url: `${baseUrl}/videos/${file}`,
    }));
    res.json(videos);
  });
});

// Video yuklash
app.post('/videos/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Video fayl yuborilmadi' });
  }
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.status(201).json({
    message: 'Video muvaffaqiyatli yuklandi',
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    url: `${baseUrl}/videos/${req.file.filename}`,
  });
});

// Video stream qilish yoki yuklab olish
app.get('/videos/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads/videos', req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video topilmadi' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// Multer xatoliklarni ushlash
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Fayl juda katta (max 500 MB)' });
  }
  res.status(400).json({ error: err.message });
});

app.listen(port, () => {
  console.log(`Server http://localhost:${port} da ishlamoqda`);
});
