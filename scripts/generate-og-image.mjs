#!/usr/bin/env node
/**
 * Generates a 1200x630 OG image for a lesson using satori + resvg.
 * Usage: node scripts/generate-og-image.mjs <slug> <title> <question>
 */
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'fs';

const [slug, title, question] = process.argv.slice(2);
if (!slug || !title || !question) {
  console.error('Usage: node generate-og-image.mjs <slug> <title> <question>');
  process.exit(1);
}

const lessonNum = slug.replace('lesson-', '');

// Fetch Manrope font from Google Fonts (TTF format for satori compatibility)
const fontUrls = {
  regular: 'https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FO_F.ttf',
  bold: 'https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4aE-_F.ttf',
};

const [regularFont, boldFont] = await Promise.all([
  fetch(fontUrls.regular).then(r => r.arrayBuffer()),
  fetch(fontUrls.bold).then(r => r.arrayBuffer()),
]);

const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#1e1b18',
        padding: '60px',
        fontFamily: 'Manrope',
        color: '#f5f0e8',
      },
      children: [
        // Top bar: branding + lesson number
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '40px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '18px',
                    color: '#d4845a',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  },
                  children: 'Claude Code Lessons',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '16px',
                    color: 'rgba(245,240,232,0.5)',
                    fontWeight: 400,
                  },
                  children: `Lesson ${lessonNum}`,
                },
              },
            ],
          },
        },
        // Title
        {
          type: 'div',
          props: {
            style: {
              fontSize: title.length > 50 ? '38px' : '46px',
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              marginBottom: '40px',
              flexGrow: 1,
            },
            children: title,
          },
        },
        // Flashcard question box
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(255,255,255,0.055)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '28px 32px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '13px',
                    color: '#d4845a',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: '12px',
                  },
                  children: 'Quick Quiz',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: question.length > 80 ? '18px' : '22px',
                    fontWeight: 600,
                    lineHeight: 1.4,
                    color: '#f5f0e8',
                  },
                  children: question,
                },
              },
            ],
          },
        },
        // Bottom: URL
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '24px',
              fontSize: '14px',
              color: 'rgba(245,240,232,0.35)',
            },
            children: 'cclessons.jaczaar.com',
          },
        },
      ],
    },
  },
  {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Manrope', data: regularFont, weight: 400, style: 'normal' },
      { name: 'Manrope', data: boldFont, weight: 700, style: 'normal' },
    ],
  }
);

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
});
const png = resvg.render().asPng();

const outPath = `public/lessons/${slug}-og.png`;
writeFileSync(outPath, png);
console.log(`OG image written to ${outPath} (${png.length} bytes)`);
