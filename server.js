require('dotenv').config();

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const UPLOAD_FOLDER = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });

// Use Render's PORT or default 3000
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const SITE_PASSWORD = process.env.SITE_PASSWORD;
const DOWNLOAD_PASSWORD = process.env.DOWNLOAD_PASSWORD;

// Sessions to remember site/download passwords
app.use(session({
  secret: process.env.SESSION_SECRET || 'mysecretkey',
  resave: false,
  saveUninitialized: false
}));

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_FOLDER),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

let uploadedFiles = [];

// ==========================
// Middleware
// ==========================
function requireSitePassword(req, res, next) {
  if (req.session.siteAccess) return next();
  res.redirect('/');
}

function requireDownloadPassword(req, res, next) {
  if (req.session.downloadAccess) return next();
  res.redirect('/files');
}

// ==========================
// Routes
// ==========================

// Login page
app.get('/', (req, res) => res.render('login', { error: null }));

// Handle site password login
app.post('/login', (req, res) => {
  if (req.body.password === SITE_PASSWORD) {
    req.session.siteAccess = true;
    res.redirect('/upload');
  } else {
    res.render('login', { error: 'Incorrect password' });
  }
});

// Upload page
app.get('/upload', requireSitePassword, (req, res) => {
  res.render('upload');
});

// Handle file uploads
app.post('/upload', requireSitePassword, upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) return res.send('No files uploaded');
  uploadedFiles.push(...req.files.map(f => ({ original: f.originalname, path: f.path })));
  res.render('success', { files: req.files.map(f => ({ original: f.originalname })) });
});

// Files page — require download password
app.get('/files', requireSitePassword, (req, res) => {
  if (!req.session.downloadAccess) {
    return res.render('downloadLogin', { error: null });
  }
  res.render('files', { files: uploadedFiles });
});

// Handle download password form
app.post('/files', requireSitePassword, (req, res) => {
  if (req.body.password === DOWNLOAD_PASSWORD) {
    req.session.downloadAccess = true;
    return res.redirect('/files');
  } else {
    return res.render('downloadLogin', { error: 'Incorrect download password' });
  }
});

// Download page
app.get('/download/:name', requireSitePassword, requireDownloadPassword, (req, res) => {
  res.render('download', { name: req.params.name, error: null });
});

// Handle download POST
app.post('/download/:name', requireSitePassword, requireDownloadPassword, (req, res) => {
  if (req.body.password === DOWNLOAD_PASSWORD) {
    const file = path.join(UPLOAD_FOLDER, req.params.name);
    return res.download(file);
  } else {
    return res.render('download', { name: req.params.name, error: 'Incorrect password' });
  }
});

// ==========================
// Block any extra paths using regex
// ==========================
app.get(/^\/upload\/.+/, (req, res) => res.redirect('/'));
app.get(/^\/files\/.+/, (req, res) => res.redirect('/'));
app.get(/^\/download\/[^\/]+\/.+/, (req, res) => res.redirect('/'));

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});