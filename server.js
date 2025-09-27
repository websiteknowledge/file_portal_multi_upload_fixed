require('dotenv').config();

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const UPLOAD_FOLDER = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const SITE_PASSWORD = process.env.SITE_PASSWORD;
const DOWNLOAD_PASSWORD = process.env.DOWNLOAD_PASSWORD;

// Sessions to remember if site password is entered
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

// Check if user entered site password
function requireSitePassword(req, res, next) {
  if (req.session.siteAccess) return next();
  res.redirect('/');
}

// Check if user entered download password
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

// Upload page (requires site password)
app.get('/upload', requireSitePassword, (req, res) => {
  res.render('upload');
});

// Upload files
app.post('/upload', requireSitePassword, upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) return res.send('No files uploaded');
  uploadedFiles.push(...req.files.map(f => ({ original: f.originalname, path: f.path })));
  res.render('success', { files: req.files.map(f => ({ original: f.originalname })) });
});

// Files page (requires download password)
app.get('/files', requireSitePassword, (req, res) => {
  // If download password not entered, show form to enter it
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

// Download individual file
app.get('/download/:name', requireSitePassword, requireDownloadPassword, (req, res) => {
  res.render('download', { name: req.params.name, error: null });
});

app.post('/download/:name', requireSitePassword, requireDownloadPassword, (req, res) => {
  if (req.body.password === DOWNLOAD_PASSWORD) {
    const file = path.join(UPLOAD_FOLDER, req.params.name);
    return res.download(file);
  } else {
    return res.render('download', { name: req.params.name, error: 'Incorrect password' });
  }
});

// ==========================
// Block extra paths
// ==========================
app.get(['/upload/*', '/files/*', '/download/*/*'], (req, res) => {
  res.redirect('/');
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));