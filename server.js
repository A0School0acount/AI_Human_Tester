const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 8080;

// CSV Parsing
let aiLines    = [];
let humanLines = [];

/**
 * Parses a single-column CSV file where every row is a dialogue line.
 * Handles quoted values ("line with, commas"), CRLF, and empty rows.
 */
function parseCSVLines(rawContent) {
  const results = [];
  const lines = rawContent.split(/\r?\n/);

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith('"') && line.endsWith('"')) {
      line = line.slice(1, -1).replace(/""/g, '"');
    }

    if (line.length > 0) results.push(line);
  }

  return results;
}

function looksLikeHeader(str) {
  const s = str.toLowerCase().trim();
  return ['dialogue','text','content','line','quote','sentence',
          'phrase','utterance','message','response','statement'].includes(s);
}

function loadData() {
  const dataDir   = path.join(__dirname, 'data');
  const aiPath    = path.join(dataDir, 'ai_dialogue.csv');
  const humanPath = path.join(dataDir, 'human_dialogue.csv');

  if (!fs.existsSync(aiPath) || !fs.existsSync(humanPath)) {
    console.error('Missing CSV files.');
    console.error('    Put your files at:');
    console.error('      data/ai_dialogue.csv');
    console.error('      data/human_dialogue.csv');
    process.exit(1);
  }

  let aiParsed    = parseCSVLines(fs.readFileSync(aiPath,    'utf-8'));
  let humanParsed = parseCSVLines(fs.readFileSync(humanPath, 'utf-8'));

  if (aiParsed.length    > 0 && looksLikeHeader(aiParsed[0]))    aiParsed.shift();
  if (humanParsed.length > 0 && looksLikeHeader(humanParsed[0])) humanParsed.shift();

  aiLines    = aiParsed.filter(l => l.length > 0);
  humanLines = humanParsed.filter(l => l.length > 0);

  if (aiLines.length === 0 || humanLines.length === 0) {
    console.error('One or both CSV files appear to be empty after parsing.');
    process.exit(1);
  }

  console.log(`Loaded ${aiLines.length} AI lines, ${humanLines.length} human lines`);
}

loadData();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * GET /api/questions?count=3
 * Returns an array of { text, source } objects.
 * source is "ai" or "human"  sent to the client so the reveal works client-side.
 * (For a casual mini-game this is fine; anyone inspecting network traffic will see
 *  the answer, but that's acceptable. Add server-side sessions if you need cheat-
 *  proofing for a competitive context.)
 */
app.get('/api/questions', (req, res) => {
  const count = Math.min(Math.max(parseInt(req.query.count) || 3, 1), 10);
  const questions = [];

  for (let i = 0; i < count; i++) {
    const isAI = Math.random() < 0.5;
    const pool  = isAI ? aiLines : humanLines;
    const text  = pool[Math.floor(Math.random() * pool.length)];
    questions.push({ text, source: isAI ? 'ai' : 'human' });
  }

  res.json({ questions });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ai: aiLines.length, human: humanLines.length });
});

app.listen(PORT, () => {
  console.log(`Turing Trial running at http://localhost:${PORT}`);
});
