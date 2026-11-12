# IBalz AI

A lightweight white-and-orange React chat UI with a Netlify Function proxy to Groq.

## Local setup

1. `npm install`
2. Set `GROQ_API_KEY` in your environment (never commit the key).
3. `npm run dev` for the UI. Use Netlify CLI to test the function locally.

## Netlify

Build command: `npm run build`; publish directory: `dist`. Add a secret environment variable named `GROQ_API_KEY` with Functions/runtime scope, then deploy.
