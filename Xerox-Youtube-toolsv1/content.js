const defaultSettings = {
    removeShortsTab: true,
    removeShortsShelf: true,
    redirectShorts: true,
    fixSpeed: false,
    speedValue: "1.0",
    disableSpeedForMusic: false,
    autoTheater: false,
    autoLoop: false,
    showExtraButtons: true,
    forceMusicCategory: false,
    hideRelated: false,
    hideComments: false,
    hideChat: false,
    hideEndScreen: false,
    fadeWatched: false
};

let settings = { ...defaultSettings };
let iconUrl = "";
let settingIconUrl = "";

try {
    iconUrl = chrome.runtime.getURL("icon.png");
    settingIconUrl = chrome.runtime.getURL("setting.png");
} catch (e) {}

(async function init() {
    try {
        await loadSettings();
        injectStyles();
        applyStaticStyles();
        startSettingsButtonObserver();
        
        let lastUrl = location.href;
        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                onUrlChange();
            }
        });
        
        observer.observe(document.body, { subtree: true, childList: true });
        onUrlChange();

        // 初回実行
        if (location.pathname === "/" && settings.forceMusicCategory) {
            enforceMusicCategoryLoop();
        }

    } catch (e) {}
})();

async function loadSettings() {
    try {
        const data = await chrome.storage.local.get("xeroxSettings");
        if (data && data.xeroxSettings) {
            const saved = data.xeroxSettings;
            const cleanSettings = { ...defaultSettings };
            Object.keys(defaultSettings).forEach(key => {
                if (saved.hasOwnProperty(key)) {
                    cleanSettings[key] = saved[key];
                }
            });
            settings = cleanSettings;
        }
    } catch (e) {}
}

async function saveSettings() {
    try {
        await chrome.storage.local.set({ xeroxSettings: settings });
        applyStaticStyles();
    } catch (e) {}
}

function injectStyles() {
    if (document.getElementById('xerox-global-styles')) return;
    const style = document.createElement('style');
    style.id = 'xerox-global-styles';
    style.innerHTML = `
        :root {
            --xerox-bg: #ffffff;
            --xerox-panel-bg: #ffffff;
            --xerox-text: #0f0f0f;
            --xerox-text-sec: #606060;
            --xerox-border: #e5e5e5;
            --xerox-hover: #f2f2f2;
            --xerox-btn-bg: #f2f2f2;
            --xerox-btn-hover: #d9d9d9;
            --xerox-shadow: rgba(0,0,0,0.1);
            --xerox-accent: #065fd4;
        }
        
        html[dark] {
            --xerox-bg: #0f0f0f;
            --xerox-panel-bg: #282828;
            --xerox-text: #f1f1f1;
            --xerox-text-sec: #aaaaaa;
            --xerox-border: #3f3f3f;
            --xerox-hover: #3f3f3f;
            --xerox-btn-bg: rgba(255,255,255,0.1);
            --xerox-btn-hover: rgba(255,255,255,0.2);
            --xerox-shadow: rgba(0,0,0,0.5);
            --xerox-accent: #3ea6ff;
        }

        .xerox-hide-shorts-tab [title="ショート"],
        .xerox-hide-shorts-tab [title="Shorts"],
        .xerox-hide-shorts-tab ytd-guide-entry-renderer:has(a[href^="/shorts"]) { display: none !important; }
        .xerox-hide-shorts-shelf ytd-rich-shelf-renderer[is-shorts],
        .xerox-hide-shorts-shelf ytd-reel-shelf-renderer { display: none !important; }
        .xerox-hide-comments #comments { display: none !important; }
        .xerox-hide-chat #chat { display: none !important; }
        .xerox-hide-endscreen .ytp-ce-element { display: none !important; }
        .xerox-hide-related #related { display: none !important; }
        .xerox-hide-related ytd-watch-next-secondary-results-renderer { display: none !important; }
        
        .xerox-fade-watched ytd-rich-item-renderer:has(ytd-thumbnail-overlay-resume-playback-renderer),
        .xerox-fade-watched ytd-video-renderer:has(ytd-thumbnail-overlay-resume-playback-renderer),
        .xerox-fade-watched ytd-grid-video-renderer:has(ytd-thumbnail-overlay-resume-playback-renderer) { 
            display: none !important; 
        }

        /* 音楽カテゴリ強制時、選択されるまではグリッドを隠してチラつき防止 */
        body.xerox-force-music-mode:not(.xerox-music-selected) ytd-rich-grid-renderer {
            opacity: 0 !important;
            pointer-events: none !important;
        }
        
        /* 音楽カテゴリ以外のチップを非表示 */
        body.xerox-force-music-mode ytd-feed-filter-chip-bar-renderer yt-chip-cloud-chip-renderer:not([aria-selected="true"]) {
            display: none !important;
        }
        
        #xerox-settings-btn { 
            width: 40px; height: 40px; 
            cursor: pointer; border-radius: 50%; 
            display: flex; align-items: center; justify-content: center; 
            transition: background-color 0.2s;
            margin-right: 8px;
        }
        #xerox-settings-btn:hover { background-color: var(--xerox-btn-bg); }
        #xerox-settings-btn img { width: 24px; height: 24px; object-fit: contain; }
        
        #xerox-settings-panel { 
            position: fixed; top: 50px; right: 20px; width: 300px; max-height: 85vh; 
            background: var(--xerox-panel-bg); color: var(--xerox-text); 
            border-radius: 12px; padding: 0; z-index: 2200; overflow-y: auto; 
            box-shadow: 0 4px 16px var(--xerox-shadow); border: 1px solid var(--xerox-border);
            font-family: "Roboto","Arial",sans-serif; font-size: 14px;
            animation: xeroxFadeIn 0.2s cubic-bezier(0.2,0,0.2,1);
        }
        @keyframes xeroxFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        .xerox-panel-header {
            position: sticky; top: 0; background: var(--xerox-panel-bg);
            padding: 12px 16px; border-bottom: 1px solid var(--xerox-border);
            z-index: 10;
        }
        .xerox-save-btn {
            width: 100%; background-color: var(--xerox-text); color: var(--xerox-bg);
            border: none; border-radius: 18px; padding: 8px 0;
            font-size: 14px; font-weight: 500; cursor: pointer; transition: opacity 0.2s;
        }
        .xerox-save-btn:hover { opacity: 0.9; }

        .xerox-panel-content { padding: 8px 16px 16px 16px; }
        .xerox-section-title { 
            color: var(--xerox-text-sec); font-size: 13px; font-weight: 500; 
            margin: 20px 0 8px 0; 
        }
        .xerox-option { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
        .xerox-label { font-size: 14px; flex: 1; color: var(--xerox-text); }

        .xerox-switch { position: relative; display: inline-block; width: 36px; height: 20px; }
        .xerox-switch input { opacity: 0; width: 0; height: 0; }
        .xerox-slider { position: absolute; cursor: pointer; top: 3px; left: 0; right: 0; bottom: 3px; background-color: #909090; transition: .2s; border-radius: 14px; }
        html[dark] .xerox-slider { background-color: #717171; }
        .xerox-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: -3px; bottom: -3px; background-color: #f1f1f1; transition: .2s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
        html[dark] .xerox-slider:before { background-color: #f1f1f1; }
        input:checked + .xerox-slider { background-color: var(--xerox-accent); opacity: 1; }
        input:checked + .xerox-slider:before { transform: translateX(18px); background-color: var(--xerox-accent); box-shadow: none; border: 2px solid #fff; }
        html[dark] input:checked + .xerox-slider:before { border: 2px solid #0f0f0f; }

        .xerox-input-group { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .xerox-timer-input {
            background: transparent; border: none; border-bottom: 1px solid var(--xerox-text-sec);
            color: var(--xerox-text); width: 50px; text-align: center; font-size: 14px; padding: 4px;
        }
        .xerox-timer-input:focus { outline: none; border-bottom-color: var(--xerox-accent); }

        .xerox-tool-btn { 
            display: inline-flex; align-items: center; justify-content: center;
            height: 36px; padding: 0 16px; margin-right: 8px;
            background-color: var(--xerox-btn-bg); color: var(--xerox-text); 
            border: none; border-radius: 18px; cursor: pointer; 
            font-size: 14px; font-weight: 500; transition: background 0.2s;
        }
        .xerox-tool-btn:hover { background-color: var(--xerox-btn-hover); }
    `;
    document.head.appendChild(style);
}

function onUrlChange() {
    try {
        if (settings.redirectShorts && location.pathname.startsWith("/shorts/")) {
            const videoId = location.pathname.split("/shorts/")[1];
            if (videoId) {
                window.location.replace('/watch?v=' + videoId);
                return;
            }
        }
        
        // ページ遷移時にクラスリセット
        document.body.classList.remove('xerox-music-selected');

        if (location.pathname === "/watch") {
            setTimeout(() => {
                applyPlaybackTools();
                injectExtraButtons();
            }, 1000);
            setTimeout(() => {
                // 遅延ロードされるメタデータを考慮して再実行
                applyPlaybackTools();
                injectExtraButtons();
            }, 3000);
        } else if (location.pathname === "/" && settings.forceMusicCategory) {
            enforceMusicCategoryLoop();
        }
    } catch (e) {}
}

// ホーム画面での音楽カテゴリ強制ループ
function enforceMusicCategoryLoop() {
    if (!settings.forceMusicCategory || location.pathname !== "/") return;
    
    // まだ選択されていなければトライ
    const interval = setInterval(() => {
        if (location.pathname !== "/") {
            clearInterval(interval);
            return;
        }
        
        const success = forceMusicCategorySelect();
        if (success) {
            document.body.classList.add('xerox-music-selected');
            // 成功しても念のため少しの間監視を続ける（SPA遷移対策）
            setTimeout(() => clearInterval(interval), 2000);
        }
    }, 500);
}

function forceMusicCategorySelect() {
    try {
        const chips = document.querySelectorAll('yt-chip-cloud-chip-renderer');
        let musicChip = null;

        for (const chip of chips) {
            const text = chip.innerText.trim();
            // 日本語・英語対応
            if (text === "音楽" || text === "Music") {
                musicChip = chip;
                break;
            }
        }

        if (musicChip) {
            if (musicChip.getAttribute('aria-selected') === 'true') {
                return true; // 既に選択済み
            } else {
                musicChip.click();
                return true; // クリックした
            }
        }
        return false; // 見つからない
    } catch(e) { return false; }
}

function applyStaticStyles() {
    if (!document.body) return;
    toggleBodyClass('xerox-hide-shorts-tab', settings.removeShortsTab);
    toggleBodyClass('xerox-hide-shorts-shelf', settings.removeShortsShelf);
    toggleBodyClass('xerox-hide-related', settings.hideRelated);
    toggleBodyClass('xerox-hide-comments', settings.hideComments);
    toggleBodyClass('xerox-hide-chat', settings.hideChat);
    toggleBodyClass('xerox-hide-endscreen', settings.hideEndScreen);
    toggleBodyClass('xerox-fade-watched', settings.fadeWatched);
    toggleBodyClass('xerox-force-music-mode', settings.forceMusicCategory);
}

function toggleBodyClass(className, isActive) {
    if (isActive) document.body.classList.add(className);
    else document.body.classList.remove(className);
}

// 音楽動画判定ロジック (強化版)
function isMusicVideo() {
    // 1. 公式アーティストバッジ (♪マーク)
    const badge = document.querySelector('ytd-channel-name .ytd-badge-supported-renderer');
    if (badge) {
        const svgPath = badge.querySelector('path');
        if (svgPath) {
            const d = svgPath.getAttribute('d');
            // ♪マークのパスデータの一部
            if (d && d.includes('M12 3v10.55')) return true;
        }
        // ツールチップ確認
        const tooltip = badge.querySelector('tp-yt-paper-tooltip');
        if (tooltip) {
            const txt = tooltip.innerText.toLowerCase();
            if (txt.includes('公式') || txt.includes('official') || txt.includes('artist')) return true;
        }
    }

    // 2. チャンネル名が「- Topic」で終わる (自動生成チャンネル)
    const channelEl = document.querySelector('ytd-channel-name a');
    const channelName = channelEl ? channelEl.innerText.trim() : "";
    if (channelName.endsWith(' - Topic') || channelName.endsWith(' - トピック')) return true;

    // 3. ミックスリスト再生中 (RDリストなど)
    const urlParams = new URLSearchParams(window.location.search);
    const listId = urlParams.get('list');
    if (listId && (listId.startsWith('RD') || listId.startsWith('OLAK5uy_') || listId.startsWith('LM'))) return true;

    // 4. メタデータセクション (曲・アーティスト情報)
    if (document.querySelector('ytd-rich-metadata-row-renderer')) return true;
    
    // 5. 概要欄の自動生成クレジット ("Provided to YouTube")
    const description = document.querySelector('#description-inline-expander') || document.querySelector('#description');
    if (description && description.innerText.includes('Provided to YouTube')) return true;

    // 6. タイトル・チャンネル名のキーワード判定 (補助)
    const titleEl = document.querySelector('h1.ytd-watch-metadata');
    const title = titleEl ? titleEl.innerText.toLowerCase() : "";
    const channelLower = channelName.toLowerCase();
    
    const keywords = [
        "mv", "music video", "official video", "official audio", 
        "cover", "feat.", "ft.", "original song", "full album", 
        "歌ってみた", "オリジナル曲", "ミュージックビデオ", 
        "lyric video", "remix"
    ];

    if (keywords.some(k => title.includes(k))) return true;
    if (channelLower.includes("music") || channelLower.includes("records") || channelLower.includes("vevo")) return true;

    return false;
}

function applyPlaybackTools() {
    try {
        const video = document.querySelector('video');
        if (!video) return;

        if (settings.fixSpeed) {
            // 音楽動画の場合は通常速度、それ以外は指定速度
            if (settings.disableSpeedForMusic && isMusicVideo()) {
                video.playbackRate = 1.0;
            } else {
                const speed = parseFloat(settings.speedValue);
                if (!isNaN(speed)) video.playbackRate = speed;
            }
        }
        
        if (settings.autoLoop) video.loop = true;
        if (settings.autoTheater) {
            const theaterBtn = document.querySelector('.ytp-size-button');
            const app = document.querySelector('ytd-watch-flexy');
            if (theaterBtn && app && !app.hasAttribute('theater')) theaterBtn.click();
        }
    } catch (e) {}
}

function injectExtraButtons() {
    try {
        if (!settings.showExtraButtons) return;
        if (document.getElementById('xerox-tools-container')) return;

        const target = document.querySelector('#actions #top-level-buttons-computed') || 
                       document.querySelector('#top-row #subscribe-button');
        if (!target) return;

        const container = document.createElement('div');
        container.id = 'xerox-tools-container';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.marginRight = '8px';

        const ssBtn = document.createElement('button');
        ssBtn.className = 'xerox-tool-btn';
        ssBtn.innerText = '📷 スクショ';
        ssBtn.onclick = takeScreenshot;

        const urlBtn = document.createElement('button');
        urlBtn.className = 'xerox-tool-btn';
        urlBtn.innerText = '🔗 時間URL';
        urlBtn.onclick = copyTimestampUrl;

        container.appendChild(ssBtn);
        container.appendChild(urlBtn);
        target.parentNode.insertBefore(container, target);
    } catch (e) {}
}

function takeScreenshot() {
    try {
        const video = document.querySelector('video');
        if (!video) return alert("動画が見つかりません");
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const link = document.createElement('a');
        link.download = 'youtube-screenshot-' + Date.now() + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (e) { alert("保存に失敗しました"); }
}

function copyTimestampUrl() {
    try {
        const video = document.querySelector('video');
        const time = video ? Math.floor(video.currentTime) : 0;
        const url = new URL(location.href);
        url.searchParams.set('t', time + 's');
        navigator.clipboard.writeText(url.toString()).then(() => alert('時間付きURLをコピーしました！'));
    } catch (e) { alert("コピーに失敗しました"); }
}

function generatePanelHTML() {
    let html = '';
    html += '<div class="xerox-panel-header">';
    html += '  <button id="xerox-save-reload-btn" class="xerox-save-btn">設定を保存して反映</button>';
    html += '</div>';

    html += '<div class="xerox-panel-content">';

    html += '<div class="xerox-promo" id="xerox-promo-link" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid var(--xerox-border); margin-bottom:8px;">';
    if(iconUrl) html += '  <img src="' + iconUrl + '" style="width:36px; height:36px; border-radius:50%;">';
    html += '  <div class="xerox-promo-text" style="font-size:12px; line-height:1.4; color:var(--xerox-text-sec);">';
    html += '    この機能がよかったらぜひ<br>';
    html += '    <span style="color:var(--xerox-accent); font-weight:500;">チャンネル登録お願いします！</span>';
    html += '  </div>';
    html += '</div>';

    html += '<div class="xerox-section-title">ショート動画対策</div>';
    html += createToggle('「ショート」タブを隠す', 'removeShortsTab');
    html += createToggle('おすすめのショート列を隠す', 'removeShortsShelf');
    html += createToggle('ショートを通常プレイヤーで再生', 'redirectShorts');

    html += '<div class="xerox-section-title">再生ツール</div>';
    html += createToggle('再生速度を固定する', 'fixSpeed');
    html += createToggle('音楽動画は通常速度にする', 'disableSpeedForMusic');
    html += '<div class="xerox-input-group">';
    html += '  <span style="font-size:12px; color:var(--xerox-text-sec);">速度(0.1～16):</span>';
    html += '  <input type="number" id="speedInput" class="xerox-timer-input" step="0.1" min="0.1" max="16" value="' + settings.speedValue + '">';
    html += '</div>';
    html += createToggle('強制でシアターモード', 'autoTheater');
    html += createToggle('強制でループ再生', 'autoLoop');
    html += createToggle('便利ボタンを表示', 'showExtraButtons');

    html += '<div class="xerox-section-title">表示の整理</div>';
    html += createToggle('ホームで「音楽」タブを自動選択', 'forceMusicCategory');
    html += createToggle('関連動画を非表示', 'hideRelated');
    html += createToggle('コメント欄を隠す', 'hideComments');
    html += createToggle('ライブチャットを隠す', 'hideChat');
    html += createToggle('動画終わりの関連動画を隠す', 'hideEndScreen');
    html += createToggle('閲覧済みの動画を非表示', 'fadeWatched');

    html += '</div>';
    return html;
}

function createToggle(label, key) {
    const isChecked = settings[key] ? 'checked' : '';
    let html = '';
    html += '<div class="xerox-option">';
    html += '  <span class="xerox-label">' + label + '</span>';
    html += '  <label class="xerox-switch">';
    html += '    <input type="checkbox" data-key="' + key + '" ' + isChecked + '>';
    html += '    <span class="xerox-slider"></span>';
    html += '  </label>';
    html += '</div>';
    return html;
}

function startSettingsButtonObserver() {
    setInterval(() => {
        try {
            if (document.getElementById('xerox-settings-btn')) return;
            const mastheadEnd = document.querySelector('ytd-masthead #end');
            if (mastheadEnd) {
                const btn = document.createElement('div');
                btn.id = 'xerox-settings-btn';
                btn.title = "ツール設定";
                btn.innerHTML = `<img src="${settingIconUrl}" alt="設定">`;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    toggleSettingsPanel();
                };
                if (mastheadEnd.firstChild) mastheadEnd.insertBefore(btn, mastheadEnd.firstChild);
                else mastheadEnd.appendChild(btn);
            }
        } catch (e) {}
    }, 2000);
}

function toggleSettingsPanel() {
    try {
        let panel = document.getElementById('xerox-settings-panel');
        if (panel) { panel.remove(); return; }

        panel = document.createElement('div');
        panel.id = 'xerox-settings-panel';
        panel.innerHTML = generatePanelHTML();
        document.body.appendChild(panel);

        document.getElementById('xerox-save-reload-btn').onclick = async () => {
            document.getElementById('xerox-save-reload-btn').innerText = '保存中...';
            await saveSettings();
            location.reload();
        };
        document.getElementById('xerox-promo-link').onclick = () => window.open('https://www.youtube.com/@Xerox-main', '_blank');

        document.querySelectorAll('.xerox-switch input').forEach(input => {
            input.addEventListener('change', (e) => {
                const key = e.target.dataset.key;
                if (key) {
                    settings[key] = e.target.checked;
                    saveSettings();
                }
            });
        });

        const speedIn = document.getElementById('speedInput');
        if (speedIn) speedIn.addEventListener('change', (e) => { settings.speedValue = e.target.value; saveSettings(); });
        
        setTimeout(() => {
            const clickHandler = (e) => {
                if (panel && !panel.contains(e.target) && !document.getElementById('xerox-settings-btn').contains(e.target)) {
                    panel.remove();
                    document.removeEventListener('click', clickHandler);
                }
            };
            document.addEventListener('click', clickHandler);
        }, 100);
    } catch (e) {}
}
