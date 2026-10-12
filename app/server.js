const express = require("express");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { chromium } = require("playwright");
const { google } = require("googleapis");
const OpenAI = require("openai");
const twilio = require("twilio");

dotenv.config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const notesPath = process.env.NOTES_PATH || path.join(__dirname, "../notes/notes.txt");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function ensureNotesFile() {
  const dir = path.dirname(notesPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(notesPath)) fs.writeFileSync(notesPath, "", "utf8");
}

ensureNotesFile();

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "automation-app" });
});

// Read notes
app.get("/notes/read", (req, res) => {
  ensureNotesFile();
  const content = fs.readFileSync(notesPath, "utf8");
  res.json({ success: true, content });
});

// Write notes
app.post("/notes/write", (req, res) => {
  const { content } = req.body || {};
  if (typeof content !== "string") {
    return res.status(400).json({ error: "content must be a string" });
  }
  ensureNotesFile();
  fs.writeFileSync(notesPath, content, "utf8");
  res.json({ success: true, path: notesPath });
});

// Append notes
app.post("/notes/append", (req, res) => {
  const { content } = req.body || {};
  if (typeof content !== "string") {
    return res.status(400).json({ error: "content must be a string" });
  }
  ensureNotesFile();
  fs.appendFileSync(notesPath, `${content}\n`, "utf8");
  res.json({ success: true, path: notesPath });
});

// Open website in Chrome
app.post("/chrome/open", async (req, res) => {
  try {
    const { url = "https://www.google.com" } = req.body || {};
    const browser = await chromium.launch({
      headless: process.env.BROWSER_HEADLESS === "true",
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    const title = await page.title();
    await browser.close();

    res.json({
      success: true,
      title,
      url,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Screenshot a page
app.post("/chrome/screenshot", async (req, res) => {
  try {
    const { url = "https://www.google.com", fileName = `shot-${Date.now()}.png` } = req.body || {};
    const browser = await chromium.launch({
      headless: process.env.BROWSER_HEADLESS === "true",
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });

    const outDir = path.join(__dirname, "../notes");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const fullPath = path.join(outDir, fileName);
    await page.screenshot({ path: fullPath, fullPage: true });
    await browser.close();

    res.json({
      success: true,
      filePath: fullPath,
      url,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// YouTube search
app.get("/youtube/search", async (req, res) => {
  try {
    const q = req.query.q || "n8n automation";
    const response = await youtube.search.list({
      part: ["snippet"],
      q: String(q),
      maxResults: 5,
      type: ["video"],
    });

    const results = (response.data.items || []).map((item) => ({
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      videoId: item.id.videoId,
      thumbnail: item.snippet.thumbnails?.medium?.url || null,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OpenAI ChatGPT
app.post("/chatgpt", async (req, res) => {
  try {
    const { prompt, systemMessage = "You are a helpful AI assistant." } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const answer = completion?.choices?.[0]?.message?.content || "No response returned.";

    res.json({ success: true, answer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp via Twilio
app.post("/whatsapp/send", async (req, res) => {
  try {
    const { to, message } = req.body || {};
    if (!to || !message) {
      return res.status(400).json({ error: "to and message are required" });
    }

    const result = await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${to}`,
      body: message,
    });

    res.json({
      success: true,
      sid: result.sid,
      status: result.status,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// All-in-one workflow route for n8n
app.post("/workflow/execute", async (req, res) => {
  try {
    const {
      command,
      prompt,
      noteText,
      url,
      searchQuery,
      whatsappTo,
      whatsappMessage,
    } = req.body || {};

    if (command === "read_note") {
      ensureNotesFile();
      return res.json({
        success: true,
        content: fs.readFileSync(notesPath, "utf8"),
      });
    }

    if (command === "write_note") {
      ensureNotesFile();
      fs.writeFileSync(notesPath, noteText || "", "utf8");
      return res.json({ success: true, path: notesPath });
    }

    if (command === "append_note") {
      ensureNotesFile();
      fs.appendFileSync(notesPath, `${noteText || ""}\n`, "utf8");
      return res.json({ success: true, path: notesPath });
    }

    if (command === "chrome_open") {
      const browser = await chromium.launch({
        headless: process.env.BROWSER_HEADLESS === "true",
      });
      const page = await browser.newPage();
      await page.goto(url || "https://www.google.com", { waitUntil: "networkidle" });
      const title = await page.title();
      await browser.close();

      return res.json({ success: true, title, url: url || "https://www.google.com" });
    }

    if (command === "youtube_search") {
      const response = await youtube.search.list({
        part: ["snippet"],
        q: searchQuery || "n8n automation",
        maxResults: 3,
        type: ["video"],
      });

      return res.json({
        success: true,
        results: (response.data.items || []).map((item) => ({
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          videoId: item.id.videoId,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        })),
      });
    }

    if (command === "chatgpt") {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt || "" },
        ],
      });

      return res.json({
        success: true,
        answer: completion?.choices?.[0]?.message?.content || "No response returned.",
      });
    }

    if (command === "whatsapp_send") {
      const result = await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM,
        to: `whatsapp:${whatsappTo}`,
        body: whatsappMessage || "Hello from automation flow",
      });

      return res.json({
        success: true,
        sid: result.sid,
        status: result.status,
      });
    }

    return res.status(400).json({ error: "Unknown command" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Automation app listening on port ${port}`);
});
