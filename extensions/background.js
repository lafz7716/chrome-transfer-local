let isProcessing = false; // 二重起動防止用フラグ

chrome.action.onClicked.addListener(async (tab) => {
  
  if (isProcessing) return; // すでに処理中なら何もしない

  // ページ内の選択範囲を取得
  const selectionResult = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true }, 
    func: () => window.getSelection().toString()
  });

  // 結果のフレームからテキストを取得
  const selectedText = selectionResult[0].result;
  
  // 選択がない場合タブ側でアラートを出す
  if (!selectedText) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => alert("先にテキストを選択してください！")
    });
    return;
  }

  isProcessing = true; // 処理中フラグを立てる
  const startTime = performance.now(); // 処理開始

// 翻訳リクエスト（サーバーへ）
try {
  const response = await fetch('http://localhost:57832/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: selectedText })
  });
  const data = await response.json();
  const translation = data.translated;

  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  
    // --- VOICEVOXもbackgroundで処理 ---
  let audioBase64 = null;
  try {
    const host = "http://localhost:50021";
    const speakerId = 8;

    const queryRes = await fetch(
      `${host}/audio_query?text=${encodeURIComponent(translation)}&speaker=${speakerId}`,
      { method: "POST" }
    );
    const queryData = await queryRes.json();

    const synthRes = await fetch(`${host}/synthesis?speaker=${speakerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryData)
    });

    // base64に変換
    const arrayBuffer = await synthRes.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    uint8.forEach(b => binary += String.fromCharCode(b));
    audioBase64 = btoa(binary);

  } catch (e) {
    console.warn("VOICEVOX失敗:", e);
  }

// executeScriptにはbase64文字列を渡す
    // 翻訳結果を表示
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text, time, audioBase64) => {
        // 選択範囲が存在するかチェック
        const sel = window.getSelection();
        if (sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // 吹き出し要素を作成
        const bubble = document.createElement('div');
        bubble.innerText = `${text}\n\n[Time: ${time}s]`;
        bubble.style.position = 'absolute';
        bubble.style.top = (rect.top + window.scrollY + 20) + 'px';
        bubble.style.left = (rect.left + window.scrollX) + 'px';
        bubble.style.backgroundColor = '#333';
        bubble.style.color = '#fff';
        bubble.style.padding = '10px';
        bubble.style.borderRadius = '5px';
        bubble.style.zIndex = '9999'; // 最前面に表示
        bubble.style.maxWidth = '400px';
        bubble.style.fontSize = '14px';
        bubble.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)'; 
        
        document.body.appendChild(bubble);
      
        
        // 2秒（2000ms）経ってからクリックイベントを有効にする
        setTimeout(() => {
          const closeHandler = (e) => {
            // クリックされた場所が bubble 自体、または bubble の子要素でない場合のみ消去
            if (!bubble.contains(e.target)) {
              bubble.remove();
              document.removeEventListener('click', closeHandler);
            }
          };

          // 画面全体にクリックイベントを登録
          document.addEventListener('click', closeHandler);
        }, 2000);

        // 音声再生（base64 → Blob → Audio）
        if (audioBase64) {
          const binary = atob(audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: "audio/wav" });
          const audio = new Audio(URL.createObjectURL(blob));
          audio.play();
        }
      },
      args: [translation, duration, audioBase64]
    });

} catch (e) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (err) => alert("エラー: " + err),
      args: [String(e)]
    });
  } finally {
    isProcessing = false; // 処理終了フラグを下ろす
  }
});