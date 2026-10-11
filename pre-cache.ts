import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const audioCacheDir = path.resolve(process.cwd(), 'audio-cache');
if (!fs.existsSync(audioCacheDir)) {
  fs.mkdirSync(audioCacheDir, { recursive: true });
}

function getAudioCacheKey(text: string, voice = 'Zephyr') {
  const norm = (text || '').trim().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(`${voice}:${norm}`).digest('hex');
}

const lines = [
  {
    id: 'seg-1-1',
    text: 'کہانی کی شروعات ہوتی ہے ایک خطرناک ایس رینک ڈنجن کے اندر، جہاں ہمارے مین کریکٹر ریان کو اس کی اپنی ٹیم نے دھوکہ دے کر مانسٹرز کے سامنے مرنے کے لیے چھوڑ دیا۔',
  },
  {
    id: 'seg-1-2',
    text: 'پورے پانچ سالوں سے ریان کو سب بیکار کچرا سمجھتے تھے، کیونکہ اس کے پاس پورے ملک میں سب سے کمزور ایف رینک اسٹیٹس تھا۔',
  },
  {
    id: 'seg-1-3',
    text: 'سیکڑوں خونخوار بھیڑیوں کے بیچ گھیرا ہمارا ہیرو اپنی آخری سانسیں گن رہا تھا۔ لیکن بالکل اسی لمحے، اس کی آنکھوں کے سامنے ایک سنہری سسٹم اسکرین چمک اٹھی!',
  },
  {
    id: 'seg-1-4',
    text: 'نوٹیفکیشن میں لکھا تھا: کیا تم قدیم انڈیڈ بادشاہ کا خفیہ تخت حاصل کرنا چاہتے ہو؟ ریان نے بنا ایک سیکنڈ ضائع کیے فورا چیخ کر کہا: ہاں، مجھے منظور ہے!',
  },
  {
    id: 'seg-1-5',
    text: 'اور پھر، ڈنجن کے اندر کالے جادو کا اتنا خوفناک دھماکہ ہوا کہ سارے مانسٹرز دہشت سے کانپنے لگے! ریان کی آنکھوں سے خطرناک جامنی روشنی نکلنے لگی۔',
  },
  {
    id: 'seg-1-6',
    text: 'سسٹم نے اسے پہلا حکم دیا: اٹھو! اور صرف اس ایک لفظ سے، مرے ہوئے جانوروں کی لاشیں سیاہ سائے والے سپاہی بن کر اپنے نئے بادشاہ کے آگے سر جھکانے لگیں!',
  },
  {
    id: 'seg-1-7',
    text: 'اب وہ ہنٹر، جسے سب بیکار سمجھ کر مرنے کے لیے چھوڑ آئے تھے، انسانی دنیا میں واپس لوٹنے والا ہے۔ اور اسے دھوکہ دینے والوں کو اندازہ بھی نہیں کہ انہوں نے کیسی بلا کو جگا دیا ہے!',
  },
];

async function run() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  console.log(`Starting pre-cache for ${lines.length} lines...`);

  for (let i = 0; i < lines.length; i++) {
    const item = lines[i];
    const key = getAudioCacheKey(item.text, 'Zephyr');
    const dest = path.join(audioCacheDir, `${key}.wav`);
    const idDest = path.join(audioCacheDir, `${item.id}.wav`);

    if (fs.existsSync(dest) || fs.existsSync(idDest)) {
      console.log(`Line ${i + 1} already cached: ${key}`);
      continue;
    }

    try {
      console.log(`Generating line ${i + 1}/${lines.length}...`);
      const res = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: item.text,
                speechMetadata: {
                  style: 'Dramatic, high-tension Urdu anime manhwa recap host',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });

      const base64Audio = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const buffer = Buffer.from(base64Audio, 'base64');
        fs.writeFileSync(dest, buffer);
        fs.writeFileSync(idDest, buffer);
        console.log(`Saved line ${i + 1} to cache (${buffer.length} bytes)`);
      }
    } catch (err: any) {
      console.error(`Error on line ${i + 1}:`, err.message);
      if (err.message?.includes('429')) {
        console.log('Sleeping 30s for quota reset...');
        await new Promise((r) => setTimeout(r, 30000));
        i--; // retry this line
        continue;
      }
    }

    // Delay 21 seconds between calls to respect 3 RPM free tier
    if (i < lines.length - 1) {
      console.log('Waiting 21s for rate limit...');
      await new Promise((r) => setTimeout(r, 21000));
    }
  }

  console.log('Pre-caching complete!');
}

run();
