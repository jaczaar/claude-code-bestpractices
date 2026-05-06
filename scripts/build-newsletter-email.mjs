#!/usr/bin/env node
// Builds a newsletter HTML email for the latest lesson.
// Mirrors the per-lesson notification email but without the "View PR" footer.
//
// Usage:
//   node scripts/build-newsletter-email.mjs <output-path>
//
// Reads:
//   public/lessons/lessons.json  (last entry = the new lesson)
//   public/lessons/<slug>.html   (flashcard Q&A, key takeaway)
//   public/lessons/<slug>-tweet.txt (tweet preview)

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE_URL = 'https://cclessons.jaczaar.com';
const ROOT = process.cwd();

const outPath = process.argv[2];
if (!outPath) {
  console.error('usage: build-newsletter-email.mjs <output-path>');
  process.exit(1);
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function extract(re, s) {
  const m = s.match(re);
  return m ? m[1].trim() : '';
}

const manifest = JSON.parse(readFileSync(resolve(ROOT, 'public/lessons/lessons.json'), 'utf8'));
const lessons = manifest.lessons || [];
if (lessons.length === 0) {
  console.error('no lessons in manifest');
  process.exit(1);
}
const lesson = lessons[lessons.length - 1];
const lessonNum = String(lessons.length).padStart(3, '0');

const lessonHtml = readFileSync(resolve(ROOT, `public/lessons/${lesson.slug}.html`), 'utf8');

// Flashcard question is the first <strong> inside .flashcard-front
const question = extract(
  /class=["']flashcard-front["'][^]*?<strong>([\s\S]*?)<\/strong>/i,
  lessonHtml
);
const answer = extract(
  /class=["']flashcard-back["'][^>]*>([\s\S]*?)<\/div>/i,
  lessonHtml
);

// Key takeaway: <div class="key-takeaway">...<p>TEXT</p>
const takeaway = extract(
  /class=["']key-takeaway["'][^]*?<p>([\s\S]*?)<\/p>/i,
  lessonHtml
);

// Pull h2 headings from the .content section as highlights
const contentBlock = extract(
  /<div class=["']content["'][^>]*>([\s\S]*?)<div class=["']key-takeaway["']/i,
  lessonHtml
);
const headings = [];
{
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m;
  while ((m = re.exec(contentBlock))) headings.push(stripTags(m[1]));
}

let tweet = '';
try {
  tweet = readFileSync(resolve(ROOT, `public/lessons/${lesson.slug}-tweet.txt`), 'utf8').trim();
} catch {
  tweet = '';
}

const lessonUrl = `${SITE_URL}/lessons/${lesson.slug}.html`;
const title = lesson.title || `Lesson ${lessonNum}`;
const summary = lesson.summary || '';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const highlightsHtml = headings.slice(0, 3).map(h => `
  <li style="margin:8px 0; padding-left:18px; position:relative; color:rgba(245,240,232,0.85); font-size:14px; line-height:1.55;">
    <span style="position:absolute; left:0; color:#d4845a;">›</span>${esc(h)}
  </li>
`).join('');

const tweetHtml = tweet ? `
  <div style="margin-top:28px;">
    <div style="font-size:11px; color:rgba(245,240,232,0.5); text-transform:uppercase; letter-spacing:1.5px; margin-bottom:8px;">Tweet preview</div>
    <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:12px; font-style:italic; font-size:14px; line-height:1.55; color:rgba(245,240,232,0.85); white-space:pre-wrap;">${esc(tweet)}</div>
  </div>
` : '';

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0; padding:0; background:#1e1b18; font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px; margin:0 auto; padding:32px 24px; color:#f5f0e8;">
    <div style="font-size:11px; color:#d4845a; text-transform:uppercase; letter-spacing:2px; margin-bottom:8px;">New Lesson Published</div>
    <h1 style="color:#f5f0e8; font-size:24px; font-weight:700; margin:0 0 16px; line-height:1.3;">Lesson ${lessonNum}: ${esc(title)}</h1>

    ${summary ? `<p style="color:rgba(245,240,232,0.75); font-size:15px; line-height:1.6; margin:0 0 24px;">${esc(summary)}</p>` : ''}

    ${question ? `
    <div style="margin:24px 0;">
      <div style="font-weight:700; color:#d4845a; font-size:14px; margin-bottom:8px;">Q: ${esc(stripTags(question))}</div>
      ${answer ? `<div style="background:rgba(212,132,90,0.1); border-left:3px solid #d4845a; padding:12px 14px; border-radius:0 8px 8px 0; color:#f5f0e8; font-size:14px; line-height:1.6;">${esc(stripTags(answer))}</div>` : ''}
    </div>` : ''}

    ${highlightsHtml ? `
    <div style="margin-top:24px;">
      <div style="font-size:11px; color:rgba(245,240,232,0.5); text-transform:uppercase; letter-spacing:1.5px; margin-bottom:8px;">In this lesson</div>
      <ul style="list-style:none; padding:0; margin:0;">${highlightsHtml}</ul>
    </div>` : ''}

    ${takeaway ? `
    <div style="margin-top:24px; background:rgba(212,132,90,0.1); border:1px solid rgba(212,132,90,0.22); border-radius:12px; padding:16px 18px;">
      <div style="font-size:11px; color:#d4845a; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:6px; font-weight:600;">Key Takeaway</div>
      <div style="color:#f5f0e8; font-size:14px; line-height:1.6;">${esc(stripTags(takeaway))}</div>
    </div>` : ''}

    ${tweetHtml}

    <div style="margin-top:32px; text-align:center;">
      <a href="${esc(lessonUrl)}" style="display:inline-block; padding:14px 32px; background:#d4845a; color:#1e1b18; font-size:15px; font-weight:600; text-decoration:none; border-radius:8px;">View Full Lesson</a>
    </div>

    <div style="margin-top:32px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.07); text-align:center;">
      <a href="${SITE_URL}" style="color:rgba(245,240,232,0.5); font-size:12px; text-decoration:none;">cclessons.jaczaar.com</a>
    </div>
  </div>
</body>
</html>
`;

writeFileSync(outPath, html);
console.log(`subject=Lesson ${lessonNum}: ${title}`);
console.log(`slug=${lesson.slug}`);
console.log(`num=${lessonNum}`);
