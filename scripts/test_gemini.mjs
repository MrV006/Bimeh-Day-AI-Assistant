import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(){
  try{
    const svcPath = path.join(__dirname, '..', 'services', 'geminiService.ts');
    const src = await fs.readFile(svcPath, 'utf8');
    const m = src.match(/const\s+apiKey\s*=\s*['\"]([^'\"]+)['\"]/);
    const apiKey = process.env.GENAI_API_KEY || (m && m[1]);
    if(!apiKey){
      console.error('No API key found in environment or services/geminiService.ts');
      process.exit(1);
    }

    // Do not print the key.
    const client = new GoogleGenAI({ apiKey });

    const model = 'gemini-2.5-flash';
    console.log('Testing model:', model);

    const chat = client.chats.create({ model, config: { temperature: 0 } });
    const resp = await chat.sendMessage({ message: 'سلام. این یک تست اتصال به مدل است.' });

    console.log('\n=== SUCCESS RESPONSE ===');
    console.log(resp?.text ?? JSON.stringify(resp, null, 2));
  }catch(err){
    console.error('\n=== ERROR ===');
    console.error(err && err.message ? err.message : String(err));
    try{ console.error('Full error:', err); }catch(e){}
    process.exit(1);
  }
}

main();
