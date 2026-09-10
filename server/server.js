import http from 'http';
import { pipeline } from '@xenova/transformers';

const PORT = 57832;
const IDLE_TIMEOUT = 60000; // 1分

let translator = null;
let idleTimer = null;
let activeRequests = 0; // 実行中の処理をカウント
let isDisposing = false;

/**
 * モデルを取得する
 */
async function getTranslator() {
  if (isDisposing) {
    isDisposing = false; 
  }

  if (!translator) {
    console.log('モデルを新規ロードします...');
    translator = await pipeline('translation', 'Xenova/nllb-200-distilled-600M', {
      quantized: true,
    });
  }
  return translator;
}

/**
 * アイドルタイマーの管理
 */
function manageIdleTimer() {
  clearTimeout(idleTimer);

  idleTimer = setTimeout(async () => {
    // 実行中のリクエストがなく、モデルが存在する場合のみ解放
    if (activeRequests === 0 && translator) {
      isDisposing = true;
      try {
        await translator.dispose(); //JSだけに頼らないメモリ初期化
        translator = null;
        console.log('アイドルタイムアウトによりモデルを解放しました');
      } finally {
        isDisposing = false;
      }
    }
  }, IDLE_TIMEOUT);
}

const server = http.createServer(async (req, res) => {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { //CORS回避処理
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/translate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body);

        // --- 処理開始フェーズ ---
        activeRequests++;
        clearTimeout(idleTimer); // 処理中はタイマーを止める

        const t = await getTranslator();
        const result = await t(text, { 
          src_lang: 'eng_Latn', 
          tgt_lang: 'jpn_Jpan' 
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ translated: result[0].translation_text }));

      } catch (err) {
        console.error('翻訳エラー:', err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Translation failed' }));
      } finally {
        // --- 処理終了フェーズ ---
        activeRequests--;
        manageIdleTimer(); // 全ての処理が終わってからカウントダウン開始
      }
    });
    return;
  }

  res.writeHead(404).end();
});

server.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});