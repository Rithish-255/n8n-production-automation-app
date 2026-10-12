# Production Automation App

This project combines:
- n8n workflow orchestration
- browser automation in Chrome
- YouTube search
- ChatGPT integration
- WhatsApp messaging
- local notes file access

## Setup

1. Copy `.env.example` to `.env`
2. Fill in your API keys and credentials
3. Run:
   ```bash
   docker compose up -d
   ```
4. Open n8n at:
   ```text
   http://localhost:5678
   ```
5. Import the workflow from:
   `n8n/workflows/automation.json`

## Example requests

### ChatGPT
```bash
curl -X POST http://localhost:5678/webhook/automation \
  -H "Content-Type: application/json" \
  -d '{
    "command": "chatgpt",
    "prompt": "Summarize the benefits of workflow automation"
  }'
```

### Open Chrome page
```bash
curl -X POST http://localhost:5678/webhook/automation \
  -H "Content-Type: application/json" \
  -d '{
    "command": "chrome_open",
    "url": "https://www.youtube.com"
  }'
```

### YouTube search
```bash
curl -X POST http://localhost:5678/webhook/automation \
  -H "Content-Type: application/json" \
  -d '{
    "command": "youtube_search",
    "searchQuery": "n8n automation tutorial"
  }'
```

### WhatsApp send
```bash
curl -X POST http://localhost:5678/webhook/automation \
  -H "Content-Type: application/json" \
  -d '{
    "command": "whatsapp_send",
    "whatsappTo": "15551234567",
    "whatsappMessage": "Automation started successfully"
  }'
```

### Write note
```bash
curl -X POST http://localhost:5678/webhook/automation \
  -H "Content-Type: application/json" \
  -d '{
    "command": "write_note",
    "noteText": "This was saved from the automation flow"
  }'
```

### Read note
```bash
curl -X POST http://localhost:5678/webhook/automation \
  -H "Content-Type: application/json" \
  -d '{
    "command": "read_note"
  }'
```

## Notes

This pattern is a production-friendly setup:
- n8n is the workflow engine
- Node.js handles browser automation and notes
- API integrations are orchestrated through HTTP requests
- the workflow is easy to expand with more actions

## Project repo

https://github.com/Rithish-255/n8n-production-automation-app
