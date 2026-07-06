const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

// Load environment variables manually
const envPath = path.resolve(__dirname, '../apps/server/.env');
const envConfig = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    envConfig[key] = val;
  }
}

const supabaseUrl = envConfig.SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = envConfig.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiKey) {
  console.error('ERROR: Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ai = new GoogleGenAI({ apiKey: geminiKey });

const MATCH_RULES = [
  { fileKeyword: 'alaska', dbKeyword: 'Dutch Mill Delight' },
  { fileKeyword: 'bonakid', dbKeyword: 'Bonakid' },
  { fileKeyword: 'dutchmill', dbKeyword: 'Dutch Mill Probiotic' }, // maps to Dutch Mill Probiotic Yoghurt Drink
  { fileKeyword: 'enfagrow', dbKeyword: 'Enfagrow' },
  { fileKeyword: 'selecta', dbKeyword: 'Selecta' }
];

async function generateEmbedding(base64Image, mimeType) {
  try {
    const embedResult = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: [
        { role: 'user', parts: [{ inlineData: { data: base64Image, mimeType } }] }
      ]
    });
    return embedResult.embeddings?.[0]?.values || null;
  } catch (error) {
    console.error('Embedding generation failed:', error.message);
    return null;
  }
}

async function run() {
  console.log('Fetching files in "reference-images"...');
  const { data: files, error: filesError } = await supabase.storage
    .from('reference-images')
    .list('', { limit: 100 });

  if (filesError) {
    console.error('Error listing files:', filesError.message);
    process.exit(1);
  }

  console.log(`Found ${files.length} files in storage.`);

  console.log('Fetching products from database...');
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('*');

  if (prodError) {
    console.error('Error fetching products:', prodError.message);
    process.exit(1);
  }

  for (const file of files) {
    const filename = file.name;
    const lowerFilename = filename.toLowerCase();
    
    // Find matching rule
    const rule = MATCH_RULES.find(r => lowerFilename.includes(r.fileKeyword));
    if (!rule) {
      console.log(`No match rule found for file: ${filename}`);
      continue;
    }

    // Find product in DB
    const product = products.find(p => p.name.toLowerCase().includes(rule.dbKeyword.toLowerCase()));
    if (!product) {
      console.log(`No product in database matches keyword "${rule.dbKeyword}" for file: ${filename}`);
      continue;
    }

    console.log(`\nMatching file "${filename}" with product "${product.name}"`);

    // 1. Download file
    console.log('- Downloading file from storage...');
    const { data: blob, error: downloadError } = await supabase.storage
      .from('reference-images')
      .download(filename);

    if (downloadError) {
      console.error(`- Download failed:`, downloadError.message);
      continue;
    }

    // Convert blob to base64
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // 2. Generate embedding
    console.log('- Generating embedding via Gemini...');
    const embedding = await generateEmbedding(base64, mimeType);
    if (!embedding) {
      console.error('- Embedding failed.');
      continue;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('reference-images')
      .getPublicUrl(filename);
    const publicUrl = publicUrlData.publicUrl;

    // 3. Update database row
    console.log('- Updating database...');
    const { error: updateError } = await supabase
      .from('products')
      .update({
        reference_image_url: publicUrl,
        image_embedding: embedding
      })
      .eq('id', product.id);

    if (updateError) {
      console.error(`- Update failed:`, updateError.message);
    } else {
      console.log(`- SUCCESS: Connected reference image & embedding for "${product.name}"!`);
    }
  }

  console.log('\nProcess finished!');
}

run();
