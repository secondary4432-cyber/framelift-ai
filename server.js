// server.js
// Minimal Node/Express server for TikTok OAuth exchange and upload (draft).
// NOTE: This is a minimal example for testing and app-review demo flows.
// You MUST secure and harden this for production.

const express = require('express');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// store uploaded file in /tmp (multer)
const upload = multer({ dest: '/tmp/uploads/' });

// Environment variables (set these in Render)
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI; // e.g. https://your-render-url/on_auth
const PORT = process.env.PORT || 3000;

if (!CLIENT_KEY || !CLIENT_SECRET || !REDIRECT_URI) {
  console.warn('Warning: missing TIKTOK_* env vars. Set CLIENT_KEY, CLIENT_SECRET, REDIRECT_URI');
}

// Simple root -> health
app.get('/', (req, res) => {
  res.send('FrameLift AI backend running');
});

/**
 * OAuth callback endpoint
 * TikTok will redirect here with ?code=...&state=...
 * We exchange code -> access_token, then redirect user back to frontend with token (or session)
 */
app.get('/on_auth', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) return res.status(400).send('Missing code');

  try {
    // Exchange code for access_token
    const tokenResp = await axios.post('https://open-api.tiktok.com/oauth/access_token/', null, {
      params: {
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      },
    });

    // tokenResp.data structure depends on TikTok; adjust parsing as necessary
    const tokenData = tokenResp.data;
    // For demo, we pass token info back to a simple redirect to frontend
    // Encode token safely if needed — here we append as query (for demo only)
    const frontend = process.env.FRONTEND_URL || '/';
    const tokenQuery = encodeURIComponent(JSON.stringify(tokenData));
    return res.redirect(`${frontend}?token=${tokenQuery}`);
  } catch (err) {
    console.error('Error exchanging token', err.response ? err.response.data : err.message);
    return res.status(500).send('Token exchange failed');
  }
});

/**
 * Upload endpoint
 * Accepts multipart/form-data file under field "video".
 * Then uses TikTok Content Upload / Posting API to upload as draft.
 * NOTE: TikTok upload involves multiple steps (upload to video server + create video resource).
 * This example assumes an access_token is provided in request body (demo flow).
 */
app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    const file = req.file;
    const body = req.body || {};
    const accessToken = body.access_token; // In real app store tokens per-user in DB / session

    if (!file) {
      return res.status(400).json({ ok: false, message: 'No file uploaded' });
    }
    if (!accessToken) {
      // For demo mode we allow flow without token (simulate)
      // In real integration: return 401
      console.log('No access_token provided — running in demo mode');
      // remove uploaded file
      fs.unlinkSync(file.path);
      return res.json({ ok: true, demo: true, message: 'Demo upload accepted (no TikTok call)' });
    }

    // Example of how you might call TikTok APIs (pseudo / reference):
    // 1) Request an upload URL / policy from TikTok
    // 2) Upload bytes to that URL
    // 3) Create video resource with the uploaded file id
    //
    // Full implementation requires following TikTok docs (and exact endpoints).
    // Here we'll respond with success placeholder.

    // Delete temp file (we won't actually upload in this demo snippet)
    fs.unlinkSync(file.path);

    return res.json({ ok: true, message: 'File received. In production this would be uploaded to TikTok (demo mode).' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve static frontend if present (optional)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`FrameLift backend running on port ${PORT}`);
});
