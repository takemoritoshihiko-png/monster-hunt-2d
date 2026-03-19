// ========================================
// MONSTER HUNT 2D - Phase 5
// フィールド改善・エフェクト・コンボ・UI仕上げ
// ========================================
import { MATERIALS, UPGRADE_COSTS, UPGRADE_DMG_MULT, ARMOR_UPGRADE_MULT, SUB_QUESTS, EXP_TABLE, MONSTER_EXP, MAX_LEVEL, SKILLS, DROP_TABLES, WORLD_W, WORLD_H, AREAS, TREES, TREE_TRUNK_R, TREE_CANOPY_R, TREE_COLLISION_R, QUESTS, Weapon, WEAPONS, Armor, ARMORS, RECIPES } from './data.js';
import { SeededRandom, Particle, DamageNumber, SoundManager, Sound, roundRect } from './utils.js';
import { DroppedItem, Arrow } from './weapon.js';
import { Inventory } from './inventory.js';
import { Player } from './player.js';
import { Monster } from './monster.js';

// ========================================
// ゲームメインクラス
// ========================================
class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        // 画面サイズ追従
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.keys = {};
        this.state = 'title'; this.lastTime = 0;
        this.titleTimer = 0; // タイトル画面の経過時間
        this.droppedItems = []; this.arrows = []; this.monsters = [];
        this.particles = [];    // パーティクル管理
        this.iceBreaths = [];   // 氷の息（飛翔体）
        this.damageNumbers = [];
        // タイムアタック
        this.timeAttackMode = false;
        this.questTimer = 0;      // クエスト経過時間（秒）
        this.questTimeLimit = 0;  // 制限時間（0=無制限）
        // サブクエスト追跡
        this.subQuestState = { damageTaken: 0, parryCount: 0, headBroken: false, tailBroken: false };
        this.subQuestResults = [];
        this.subQuestBanner = ''; this.subQuestBannerTimer = 0;
        // クラフト画面タブ
        this.craftTab = 0; // 0=CRAFT, 1=UPGRADE
        this.upgradeCursor = 0;
        // レベルアップ・スキル選択
        this.levelUpTimer = 0;  // LEVEL UP!表示タイマー
        this.skillSelectActive = false;
        this.skillChoices = [];  // 3つのスキル候補
        this.skillCursor = 0;
        // ボス登場演出
        this.bossIntroTimer = 0;
        this.bossIntroActive = false;
        this.currentQuest = null; this.questRewards = [];
        this.resultTimer = 0; this.resultDuration = 5; this.questSuccess = false;
        this.lobbyCursor = 0; this.craftCursor = 0;
        this.craftMessage = ''; this.craftMessageTimer = 0;
        this.weaponSwitchMessage = ''; this.weaponSwitchTimer = 0;
        this.mouseX = 0; this.mouseY = 0; this._returnToLobby = false;
        this.inventory = new Inventory();
        // デバッグモード: ?debug=true で初期素材を付与
        if (new URLSearchParams(window.location.search).get('debug') === 'true') {
            this.inventory.addMaterial('drakeScale', 10);
            this.inventory.addMaterial('drakeFang', 5);
            this.inventory.addMaterial('drakeCore', 3);
            this.inventory.addMaterial('iceFang', 5);
            this.inventory.addMaterial('iceCrystal', 3);
        }
        // localStorageからベストタイム復元
        try { const bt = localStorage.getItem('mh2d_bestTimes'); if (bt) this.inventory.bestTimes = JSON.parse(bt); } catch(e){}
        this.images = {}; this.imagesLoaded = false;

        // カメラ
        this.camera = { x: 0, y: 0 };

        // カメラシェイク
        this.shakeTimer = 0; this.shakeIntensity = 0;

        // 結果画面演出用
        this.resultAnimTimer = 0; // 経過時間（秒）

        // 草テクスチャのプリレンダリング
        this.grassCanvas = null;
        this.generateGrassTexture();

        // ロビー背景プリレンダリング
        this.lobbyBgCanvas = null;
        this.generateLobbyBg();

        // ロビーアニメーション
        this.lobbyTime = 0;

        // 討伐数（localStorage）
        this.totalHunts = 0;
        try { this.totalHunts = parseInt(localStorage.getItem('mh2d_totalHunts') || '0'); } catch(e){}

        // 風音
        this.windNode = null;

        // セーブ関連
        this.saveIndicatorTimer = 0; // 「SAVED ✓」表示タイマー
        this.saveMenuActive = false;
        this.saveMenuCursor = 0;
        this.saveMenuConfirm = false; // New Game確認中

        this.setupInput();
        // 起動時に自動ロード
        this.loadGame();
        this.loadImages().then(() => {
            this.imagesLoaded = true;
            requestAnimationFrame((t) => this.loop(t));
        });
    }

    /**
     * 草原テクスチャをオフスクリーンCanvasにプリレンダリング
     */
    generateGrassTexture() {
        const gc = document.createElement('canvas');
        gc.width = WORLD_W; gc.height = WORLD_H;
        const g = gc.getContext('2d');
        // エリア別ベースカラー
        for (const area of AREAS) { g.fillStyle = area.color; g.fillRect(area.x, area.y, area.w, area.h); }
        // チェッカータイル
        for (let y = 0; y < WORLD_H; y += 32) {
            for (let x = 0; x < WORLD_W; x += 32) {
                if ((x/32+y/32)%2===0) { g.fillStyle='rgba(0,0,0,0.03)'; g.fillRect(x,y,32,32); }
            }
        }
        // 岩場テクスチャ
        const rng = new SeededRandom(42);
        for (let i=0; i<40; i++) {
            const rx=1600+rng.next()*800, ry=600+rng.next()*600, rs=8+rng.next()*20;
            g.fillStyle=`rgba(${80+Math.floor(rng.next()*40)},${80+Math.floor(rng.next()*30)},${85+Math.floor(rng.next()*30)},0.5)`;
            g.beginPath(); g.arc(rx,ry,rs,0,Math.PI*2); g.fill();
        }
        // 沼の水たまり
        for (let i=0; i<30; i++) {
            const sx=rng.next()*2400, sy=1200+rng.next()*600, sr=15+rng.next()*30;
            g.fillStyle=`rgba(20,${60+Math.floor(rng.next()*40)},${50+Math.floor(rng.next()*30)},0.3)`;
            g.beginPath(); g.ellipse(sx,sy,sr,sr*0.6,0,0,Math.PI*2); g.fill();
        }
        // 草テクスチャ
        g.lineWidth=1;
        for (let i=0; i<800; i++) {
            const x=rng.next()*WORLD_W, y=rng.next()*1200;
            const h=4+rng.next()*6, lean=(rng.next()-0.5)*4;
            const green=Math.floor(80+rng.next()*60);
            const dark = y<600?0.7:1.0;
            g.strokeStyle=`rgb(${Math.floor((30+rng.next()*30)*dark)},${Math.floor(green*dark)},${Math.floor((20+rng.next()*20)*dark)})`;
            g.beginPath(); g.moveTo(x,y); g.lineTo(x+lean,y-h); g.stroke();
        }
        // マップ端の壁
        g.fillStyle='#333340';
        g.fillRect(0,0,WORLD_W,8); g.fillRect(0,WORLD_H-8,WORLD_W,8);
        g.fillRect(0,0,8,WORLD_H); g.fillRect(WORLD_W-8,0,8,WORLD_H);
        // 木を描画
        for (const tree of TREES) {
            g.fillStyle='rgba(0,0,0,0.15)';
            g.beginPath(); g.ellipse(tree.x+3,tree.y+TREE_CANOPY_R-2,TREE_CANOPY_R,TREE_CANOPY_R*0.4,0,0,Math.PI*2); g.fill();
            g.fillStyle='#5a3a1a'; g.beginPath(); g.arc(tree.x,tree.y+10,TREE_TRUNK_R,0,Math.PI*2); g.fill();
            g.fillStyle='#1a6a20'; g.beginPath(); g.arc(tree.x,tree.y-12,TREE_CANOPY_R,0,Math.PI*2); g.fill();
            g.fillStyle='#2a8a30'; g.beginPath(); g.arc(tree.x-8,tree.y-16,TREE_CANOPY_R*0.7,0,Math.PI*2); g.fill();
            g.fillStyle='#1d7a25'; g.beginPath(); g.arc(tree.x+10,tree.y-8,TREE_CANOPY_R*0.6,0,Math.PI*2); g.fill();
        }
        this.grassCanvas = gc;
    }

    /** Canvasを画面サイズに合わせる */
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.W = this.canvas.width;
        this.H = this.canvas.height;
        // ロビー背景を再生成
        this.generateLobbyBg();
    }

    /** ロビー背景（星・山・森・月）のプリレンダリング */
    generateLobbyBg() {
        const W = this.W || 800, H = this.H || 600;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0a0a1a'); grad.addColorStop(1, '#1a0a0a');
        g.fillStyle = grad; g.fillRect(0, 0, W, H);
        const rng = new SeededRandom(77);
        for (let i = 0; i < 100; i++) {
            const sx = rng.next()*W, sy = rng.next()*H*0.65, sr = 0.5+rng.next()*1.5;
            g.fillStyle = `rgba(255,255,255,${0.3+rng.next()*0.5})`;
            g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI*2); g.fill();
        }
        // 月
        const moonX = W*0.85, moonY = H*0.13;
        g.fillStyle='rgba(255,255,220,0.06)'; g.beginPath(); g.arc(moonX,moonY,60,0,Math.PI*2); g.fill();
        g.fillStyle='rgba(255,255,220,0.1)'; g.beginPath(); g.arc(moonX,moonY,35,0,Math.PI*2); g.fill();
        g.fillStyle='rgba(255,255,230,0.7)'; g.beginPath(); g.arc(moonX,moonY,22,0,Math.PI*2); g.fill();
        // 山
        g.fillStyle='#0c0c18'; g.beginPath(); g.moveTo(0,H*0.83);
        for (let x=0;x<=W;x+=W/10) g.lineTo(x, H*0.6+Math.sin(x*0.008)*H*0.1);
        g.lineTo(W,H); g.lineTo(0,H); g.closePath(); g.fill();
        // 森
        g.fillStyle='#080812'; g.beginPath(); g.moveTo(0,H*0.87);
        for (let x=0;x<=W;x+=20) {
            const h=H*0.8+Math.sin(x*0.02)*H*0.05+Math.sin(x*0.05)*H*0.025;
            g.lineTo(x, h-(x%40<20?H*0.025:0));
        }
        g.lineTo(W,H); g.lineTo(0,H); g.closePath(); g.fill();
        this.lobbyBgCanvas = c;
    }

    /** 風音の開始/停止 */
    startWind() {
        if (this.windNode || !Sound.ctx) return;
        const ctx = Sound.ctx;
        const bufSize = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 400;
        const gain = ctx.createGain(); gain.gain.value = 0.04;
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        src.start();
        this.windNode = { src, gain };
    }
    stopWind() {
        if (!this.windNode) return;
        this.windNode.src.stop();
        this.windNode = null;
    }

    /** ロビーに戻る（セーブ付き） */
    _returnToLobbyWithSave() {
        // プレイヤーデータをセーブ用に保持
        if (this.player) {
            this._savedPlayerLevel = this.player.level;
            this._savedPlayerExp = this.player.exp;
            this._savedPlayerMaxHp = this.player.maxHp;
            this._savedBonusDamage = this.player.bonusDamage;
            this._savedBaseSpeed = this.player.baseSpeed;
            this._savedSkills = this.player.acquiredSkills;
            this._savedSkillMeleeMult = this.player.skillMeleeMult;
            this._savedSkillBowCdMult = this.player.skillBowCdMult;
            this._savedSkillDefMult = this.player.skillDefMult;
            this._savedSkillAtkSpdMult = this.player.skillAtkSpdMult;
            this._savedSkillExtraDrop = this.player.skillExtraDrop;
            this._savedSkillShowHpNum = this.player.skillShowHpNum;
        }
        this.state = 'lobby';
        this.saveGame();
    }

    /** ゲームデータを保存 */
    saveGame() {
        try {
            const data = {
                version: 1,
                inventory: this.inventory.serialize(),
                playerLevel: this.player ? this.player.level : (this._savedPlayerLevel || 1),
                playerExp: this.player ? this.player.exp : (this._savedPlayerExp || 0),
                playerMaxHp: this.player ? this.player.maxHp : (this._savedPlayerMaxHp || 100),
                playerBonusDamage: this.player ? this.player.bonusDamage : (this._savedBonusDamage || 0),
                playerBaseSpeed: this.player ? this.player.baseSpeed : (this._savedBaseSpeed || 260),
                acquiredSkills: this.player ? this.player.acquiredSkills : (this._savedSkills || []),
                skillMeleeMult: this.player ? this.player.skillMeleeMult : 1,
                skillBowCdMult: this.player ? this.player.skillBowCdMult : 1,
                skillDefMult: this.player ? this.player.skillDefMult : 1,
                skillAtkSpdMult: this.player ? this.player.skillAtkSpdMult : 1,
                skillExtraDrop: this.player ? this.player.skillExtraDrop : 0,
                skillShowHpNum: this.player ? this.player.skillShowHpNum : false,
                totalHunts: this.totalHunts,
            };
            localStorage.setItem('monsterHunt2D_save', JSON.stringify(data));
            this.saveIndicatorTimer = 2000;
        } catch (e) { console.warn('Save failed:', e); }
    }

    /** ゲームデータをロード */
    loadGame() {
        try {
            const raw = localStorage.getItem('monsterHunt2D_save');
            if (!raw) return false;
            const data = JSON.parse(raw);
            this.inventory.deserialize(data.inventory);
            // プレイヤーが存在しない（ロビー中）場合に復元用に保持
            this._savedPlayerLevel = data.playerLevel || 1;
            this._savedPlayerExp = data.playerExp || 0;
            this._savedPlayerMaxHp = data.playerMaxHp || 100;
            this._savedBonusDamage = data.playerBonusDamage || 0;
            this._savedBaseSpeed = data.playerBaseSpeed || 260;
            this._savedSkills = data.acquiredSkills || [];
            this._savedSkillMeleeMult = data.skillMeleeMult || 1;
            this._savedSkillBowCdMult = data.skillBowCdMult || 1;
            this._savedSkillDefMult = data.skillDefMult || 1;
            this._savedSkillAtkSpdMult = data.skillAtkSpdMult || 1;
            this._savedSkillExtraDrop = data.skillExtraDrop || 0;
            this._savedSkillShowHpNum = data.skillShowHpNum || false;
            this.totalHunts = data.totalHunts || 0;
            // bestTimesも復元
            this.inventory.bestTimes = data.inventory.bestTimes || {};
            return true;
        } catch (e) { console.warn('Load failed:', e); return false; }
    }

    /** プレイヤー生成時にセーブデータのステータスを適用 */
    applyLoadedStats(player) {
        if (!this._savedPlayerLevel) return;
        player.level = this._savedPlayerLevel;
        player.exp = this._savedPlayerExp;
        player.maxHp = this._savedPlayerMaxHp;
        player.hp = player.maxHp;
        player.bonusDamage = this._savedBonusDamage;
        player.baseSpeed = this._savedBaseSpeed;
        player.speed = player.baseSpeed;
        player.acquiredSkills = this._savedSkills || [];
        player.skillMeleeMult = this._savedSkillMeleeMult || 1;
        player.skillBowCdMult = this._savedSkillBowCdMult || 1;
        player.skillDefMult = this._savedSkillDefMult || 1;
        player.skillAtkSpdMult = this._savedSkillAtkSpdMult || 1;
        player.skillExtraDrop = this._savedSkillExtraDrop || 0;
        player.skillShowHpNum = this._savedSkillShowHpNum || false;
    }

    /** データリセット */
    resetGame() {
        try { localStorage.removeItem('monsterHunt2D_save'); localStorage.removeItem('mh2d_bestTimes'); localStorage.removeItem('mh2d_totalHunts'); } catch(e){}
        this.inventory = new Inventory();
        this.totalHunts = 0;
        this._savedPlayerLevel = 1; this._savedPlayerExp = 0;
        this._savedPlayerMaxHp = 100; this._savedBonusDamage = 0;
        this._savedBaseSpeed = 260; this._savedSkills = [];
        this._savedSkillMeleeMult = 1; this._savedSkillBowCdMult = 1;
        this._savedSkillDefMult = 1; this._savedSkillAtkSpdMult = 1;
        this._savedSkillExtraDrop = 0; this._savedSkillShowHpNum = false;
        this.player = null;
        this.saveMenuActive = false; this.saveMenuConfirm = false;
    }

    loadImages() {
        const files = { player:'assets/player.png', forestDrake:'assets/forest_drake.png', giantDrake:'assets/giant_drake.png', iceWolf:'assets/ice_wolf.png', lobbyBg:'assets/lobby_bg.jpg' };
        return Promise.all(Object.entries(files).map(([k,s])=>new Promise(r=>{
            const img=new Image(); img.onload=()=>{this.images[k]=img;r();}; img.onerror=()=>{console.warn(`Load fail: ${s}`);r();}; img.src=s;
        })));
    }

    startQuest(quest) {
        this.currentQuest = quest;
        this.player = new Player(WORLD_W/2-16, WORLD_H/2+200, this.inventory);
        this.applyLoadedStats(this.player);
        this.monsters = quest.monsters.map(m=>new Monster(m.name,m.x,m.y,m.config));
        this.droppedItems=[]; this.arrows=[]; this.particles=[]; this.iceBreaths=[]; this.damageNumbers=[];
        this.questSuccess=false; this.shakeTimer=0; this.resultAnimTimer=0;
        this.questTimer=0; this.questTimeLimit=quest.timeLimit||0;
        this.subQuestState = { damageTaken:0, parryCount:0, headBroken:false, tailBroken:false };
        this.subQuestResults=[]; this.subQuestBanner=''; this.subQuestBannerTimer=0;
        // ボス登場演出
        if (quest.monsters.some(m => m.config.isBoss)) {
            this.bossIntroActive = true;
            this.bossIntroTimer = 3;
            this.state = 'bossIntro';
        } else {
            this.bossIntroActive = false;
            this.state = 'playing';
        }
    }

    /**
     * ヒットパーティクルを生成（火花エフェクト）
     */
    spawnHitParticles(x, y, count, isComboFinish) {
        const colors = isComboFinish
            ? ['#ffaa00','#ff6600','#ffdd44','#ff4400']
            : ['#ffcc44','#ffffff','#ff8844'];
        for (let i=0; i<count; i++) {
            const angle = (Math.PI*2/count)*i + (Math.random()-0.5)*0.5;
            const speed = 80 + Math.random()*120;
            const size = isComboFinish ? 3+Math.random()*3 : 2+Math.random()*2;
            this.particles.push(new Particle(
                x, y, Math.cos(angle)*speed, Math.sin(angle)*speed - 40,
                colors[Math.floor(Math.random()*colors.length)],
                200 + Math.random()*150, size
            ));
        }
    }

    /**
     * Ice Wolfの氷の息を生成
     */
    spawnIceBreath(x, y, dirX, dirY) {
        this.iceBreaths.push({ x, y, vx: dirX * 250, vy: dirY * 250, alive: true, life: 1500 });
    }

    /**
     * クリア時の金色パーティクルを生成
     */
    spawnVictoryParticles() {
        const colors = ['#ffcc00','#ffdd44','#ffaa22','#ffe066'];
        for (let i=0; i<40; i++) {
            this.particles.push(new Particle(
                Math.random()*800, -10 - Math.random()*100,
                (Math.random()-0.5)*60, 30+Math.random()*60,
                colors[Math.floor(Math.random()*colors.length)],
                2000+Math.random()*2000, 2+Math.random()*3
            ));
        }
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            // タイトル画面 → ロビーへ
            if (this.state==='title') { this.state='lobby'; return; }
            // セーブメニュー
            if (this.saveMenuActive) {
                if (this.saveMenuConfirm) {
                    if (key==='y') { this.resetGame(); this.saveMenuActive=false; this.saveMenuConfirm=false; }
                    else if (key==='n'||key==='escape') { this.saveMenuConfirm=false; }
                } else {
                    if (key==='arrowup'||key==='w') this.saveMenuCursor=Math.max(0,this.saveMenuCursor-1);
                    else if (key==='arrowdown'||key==='s') this.saveMenuCursor=Math.min(2,this.saveMenuCursor+1);
                    else if (key==='z'||key==='enter') {
                        if (this.saveMenuCursor===0) { this.saveGame(); this.saveMenuActive=false; }
                        else if (this.saveMenuCursor===1) { this.loadGame(); this.saveMenuActive=false; }
                        else if (this.saveMenuCursor===2) { this.saveMenuConfirm=true; }
                    }
                    else if (key==='escape') { this.saveMenuActive=false; }
                }
                return;
            }
            if (this.state==='lobby') {
                if (key==='escape') { this.saveMenuActive=true; this.saveMenuCursor=0; this.saveMenuConfirm=false; return; }
                if (key==='arrowup'||key==='w') this.lobbyCursor=Math.max(0,this.lobbyCursor-1);
                else if (key==='arrowdown'||key==='s') this.lobbyCursor=Math.min(QUESTS.length-1,this.lobbyCursor+1);
                else if (key==='enter'||key==='z') {
                    const q = QUESTS[this.lobbyCursor];
                    if (!this.isQuestLocked(q)) this.startQuest(q);
                }
                if (key==='t') { this.timeAttackMode=!this.timeAttackMode; }
                if (key==='i') {this.state='inventory';this._returnToLobby=true;return;}
                if (key==='c') {this.state='craft';this.craftCursor=0;this.craftTab=0;this._returnToLobby=true;return;}
                return;
            }
            if (this.state==='result') { if (key==='r'||key==='enter') this._returnToLobbyWithSave(); return; }
            if (this.state==='gameover') { if (key==='r') this._returnToLobbyWithSave(); return; }
            if (key==='i') {
                if (this.state==='inventory') {this.state=this._returnToLobby?'lobby':'playing';this._returnToLobby=false;}
                else if (this.state==='playing') {this.state='inventory';this._returnToLobby=false;}
                return;
            }
            if (key==='c') {
                if (this.state==='craft') {this.state=this._returnToLobby?'lobby':'playing';this._returnToLobby=false;}
                else if (this.state==='playing') {this.state='craft';this.craftCursor=0;this._returnToLobby=false;}
                return;
            }
            if (this.state==='craft') {
                if (key==='tab'||key==='e') { this.craftTab=1-this.craftTab; this.upgradeCursor=0; return; }
                if (this.craftTab===0) {
                    if (key==='arrowup'||key==='w') this.craftCursor=Math.max(0,this.craftCursor-1);
                    else if (key==='arrowdown'||key==='s') this.craftCursor=Math.min(RECIPES.length-1,this.craftCursor+1);
                    else if (key==='enter'||key==='z') this.executeCraft();
                } else {
                    const items=[...this.inventory.weapons.filter(w=>w.name!=='Basic Sword'),...this.inventory.armors];
                    if (key==='arrowup'||key==='w') this.upgradeCursor=Math.max(0,this.upgradeCursor-1);
                    else if (key==='arrowdown'||key==='s') this.upgradeCursor=Math.min(items.length-1,this.upgradeCursor+1);
                    else if (key==='enter'||key==='z') this.executeUpgrade(items);
                }
                return;
            }
            // スキル選択画面
            if (this.state==='skillSelect') {
                if (key==='w'||key==='arrowup') this.skillCursor=Math.max(0,this.skillCursor-1);
                else if (key==='s'||key==='arrowdown') this.skillCursor=Math.min(this.skillChoices.length-1,this.skillCursor+1);
                else if (key==='z'||key==='enter') this.confirmSkill();
                return;
            }
            if (this.state!=='playing') return;
            if (key==='z') {
                const style = this.player.weapon.style;
                if (style === 'charge' || (style === 'bow' && this.player.weapon.type === 'ranged')) {
                    this.player.startCharge();
                } else {
                    this.handleAttack();
                }
            }
            if (key==='x') this.player.startBlock();
            if (key==='q') { this.player.cycleWeapon(); this.weaponSwitchMessage=`Equipped: ${this.player.weapon.name}`; this.weaponSwitchTimer=1500; }
        });
        window.addEventListener('keyup',(e)=>{
            const key = e.key.toLowerCase();
            this.keys[key]=false;
            if (key==='z' && this.player && this.state==='playing') {
                if (this.player.charging) this.handleChargeRelease();
            }
            if (key==='x' && this.player) this.player.stopBlock();
        });
        this.canvas.addEventListener('click',(e)=>{
            if (this.state!=='lobby') return;
            const r=this.canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
            const cw=Math.min(600,this.W*0.75),ch=100,cx=(this.W-cw)/2; let cy=120;
            for (let i=0;i<QUESTS.length;i++) {
                if (mx>=cx&&mx<=cx+cw&&my>=cy&&my<=cy+ch) {this.lobbyCursor=i;this.startQuest(QUESTS[i]);return;}
                cy+=ch+20;
            }
        });
        this.canvas.addEventListener('mousemove',(e)=>{const r=this.canvas.getBoundingClientRect();this.mouseX=e.clientX-r.left;this.mouseY=e.clientY-r.top;});
    }

    isQuestLocked(quest) {
        if (!quest.unlockCondition) return false;
        if (quest.unlockCondition === 'allClear+lv5') {
            const baseIds = ['forestDrake','doubleDrake','iceWolf','giantDrake'];
            const allCleared = baseIds.every(id => this.inventory.clearedQuests.has(id));
            return !allCleared || !this.player || (this.player && this.player.level < 5);
        }
        if (quest.unlockCondition === 'elderClear') {
            return !this.inventory.clearedQuests.has('elderDrake');
        }
        return false;
    }

    executeUpgrade(items) {
        if (this.upgradeCursor >= items.length) return;
        const item = items[this.upgradeCursor];
        let success = false;
        if (item instanceof Weapon) {
            success = this.inventory.upgradeWeapon(item);
        } else if (item instanceof Armor) {
            success = this.inventory.upgradeArmor(item);
        }
        if (success) { this.craftMessage = `Upgraded to ${item.getDisplayName ? item.getDisplayName() : item.name}+${item.upgradeLevel}!`; this.craftMessageTimer = 2000; Sound.playLevelUp(); }
        else { this.craftMessage = 'Not enough materials!'; this.craftMessageTimer = 1500; }
    }

    executeCraft() {
        const r=RECIPES[this.craftCursor]; if (!r) return;
        if (this.inventory.alreadyOwns(r)) {this.craftMessage='Already owned!';this.craftMessageTimer=1500;return;}
        if (this.inventory.craft(r)) {this.craftMessage=`Crafted: ${r.name}!`;this.craftMessageTimer=2000;}
        else {this.craftMessage='Not enough materials!';this.craftMessageTimer=1500;}
    }

    handleAttack() {
        if (this.player.attackCooldown > 0) return;
        const style = this.player.weapon.style;
        // 弓の通常射撃（タップ）
        if (this.player.weapon.type === 'ranged') {
            this.player.attack();
            const cx=this.player.x+this.player.width/2, cy=this.player.y+this.player.height/2;
            this.arrows.push(new Arrow(cx,cy,this.player.facing,this.player.weapon.damage+this.player.bonusDamage));
            return;
        }
        const hitbox = this.player.attack(); if (!hitbox) return;
        let hitAny = false;
        for (const m of this.monsters) {
            if (m.alive && this.checkCollision(hitbox, m)) {
                this.applyMeleeDamageToMonster(m);
                hitAny = true;
            }
        }
        if (hitAny) {
            this.shakeTimer = 60;
            this.shakeIntensity = style === 'hammer' ? 8 : (this.player.comboCount >= 2 ? 6 : 4);
        }
    }

    /** チャージ解放処理 */
    handleChargeRelease() {
        const wasReady = this.player.releaseCharge();
        const style = this.player.weapon.style;
        if (this.player.attackCooldown > 0 && !wasReady) return;
        if (style === 'charge') {
            // Iron Sword: チャージ完了→扇形範囲攻撃
            if (wasReady) {
                this.player.attackCooldown = this.player.weapon.cooldown * this.player.skillAtkSpdMult;
                this.player.isAttacking = true; this.player.attackTimer = 300;
                const cx=this.player.x+this.player.width/2, cy=this.player.y+this.player.height/2;
                // 扇形範囲の全モンスターにダメージ
                for (const m of this.monsters) {
                    if (!m.alive) continue;
                    const dx=(m.x+m.width/2)-cx, dy=(m.y+m.height/2)-cy;
                    const dist=Math.sqrt(dx*dx+dy*dy);
                    if (dist > this.player.weapon.range + 20) continue;
                    // 角度判定（前方60度）
                    let facing; switch(this.player.facing){case'up':facing=Math.atan2(-1,0);break;case'down':facing=Math.atan2(1,0);break;case'left':facing=Math.atan2(0,-1);break;case'right':facing=Math.atan2(0,1);break;}
                    const angle = Math.atan2(dy,dx);
                    let diff = Math.abs(angle-facing); if(diff>Math.PI) diff=2*Math.PI-diff;
                    if (diff < Math.PI/6) { // 30度以内（合計60度）
                        const {dmg,isWeak} = this.calcDamage(80, this.player.weapon, 1, m);
                        const {partBroken} = m.takeDamage(dmg,dx/dist*8,dy/dist*8,m.x+m.width/2,m.y+m.height/2);
                        const nc = partBroken ? '#ff4444' : (isWeak ? '#ffaa22' : '#ffcc00');
                        const nl = partBroken ? 'BREAK!' : (isWeak ? 'WEAK!' : 'CHARGE!');
                        this.damageNumbers.push(new DamageNumber(m.x+m.width/2,m.y-20,dmg,nc,nl));
                        this.spawnHitParticles(m.x+m.width/2,m.y+m.height/2,10,true);
                        if (partBroken) {
            Sound.playPartBreak();
            if (partBroken==='head') this.subQuestState.headBroken=true;
            if (partBroken==='tail') this.subQuestState.tailBroken=true;
            const matId=partBroken==='head'?'drakeHeadScale':'drakeTail';
            const item=new DroppedItem(monster.x+monster.width/2,monster.y+monster.height/2,matId,1);
            item.setScatter(monster.x+monster.width/2,monster.y+monster.height/2);this.droppedItems.push(item);
        }
                        if (!m.alive) { Sound.playMonsterDie(); this.onMonsterDefeated(m); }
                    }
                }
                Sound.playComboHit();
                this.shakeTimer = 80; this.shakeIntensity = 6;
            } else {
                // 通常攻撃
                this.handleAttack();
            }
        } else if (style === 'bow') {
            // Hunter Bow: チャージ完了→3連矢
            const cx=this.player.x+this.player.width/2, cy=this.player.y+this.player.height/2;
            if (wasReady) {
                this.player.attackCooldown = this.player.weapon.cooldown * this.player.skillAtkSpdMult * this.player.skillBowCdMult;
                const dmg = 25 + this.player.bonusDamage;
                const dir = this.player.facing;
                // 中央 + 左右15度
                this.arrows.push(new Arrow(cx,cy,dir,dmg));
                const spread = 15 * Math.PI/180;
                for (const off of [-spread, spread]) {
                    const a = new Arrow(cx,cy,dir,dmg);
                    const baseAngle = Math.atan2(a.vy, a.vx) + off;
                    a.vx = Math.cos(baseAngle); a.vy = Math.sin(baseAngle);
                    this.arrows.push(a);
                }
                Sound.playComboHit();
            } else {
                this.player.attack();
                this.arrows.push(new Arrow(cx,cy,this.player.facing,this.player.weapon.damage+this.player.bonusDamage));
            }
        }
    }

    /**
     * ダメージ計算（弱点・スキル・コンボ・レベル補正を統合）
     */
    calcDamage(baseDmg, weapon, comboMult, monster) {
        let dmg = (baseDmg + this.player.bonusDamage) * comboMult;
        if (weapon.type === 'melee') dmg *= this.player.skillMeleeMult;
        // 弱点判定（氷属性武器 → 氷弱点モンスター）
        let isWeak = false;
        if (monster.weakness === 'ice' && weapon.style === 'frost') {
            dmg *= monster.weaknessMult;
            isWeak = true;
        }
        return { dmg: Math.floor(dmg), isWeak };
    }

    applyMeleeDamageToMonster(monster) {
        const dx=(monster.x+monster.width/2)-(this.player.x+this.player.width/2);
        const dy=(monster.y+monster.height/2)-(this.player.y+this.player.height/2);
        const dist=Math.sqrt(dx*dx+dy*dy)||1;
        const kb=this.player.weapon.knockback;
        const comboMult = this.player.getComboMultiplier();
        let { dmg, isWeak } = this.calcDamage(this.player.weapon.damage, this.player.weapon, comboMult, monster);
        // パリィカウンターボーナス
        if (this.player.parryBonus > 0) dmg = Math.floor(dmg * 1.3);
        // ハンマー部位破壊ボーナス
        const style = this.player.weapon.style;
        const partDmgMult = style === 'hammer' ? 1.5 : 1.0;
        const hx = monster.x+monster.width/2, hy = monster.y+monster.height/2;
        const { partBroken } = monster.takeDamage(Math.floor(dmg * partDmgMult), (dx/dist)*kb*comboMult, (dy/dist)*kb*comboMult, hx, hy);
        // Frost Blade: 凍結カウンター
        if (style === 'frost' && monster.alive && monster.frozenTimer <= 0) {
            monster.frostCount++;
            if (monster.frostCount >= 3) {
                monster.frozenTimer = 2000; monster.frostCount = 0;
                // 氷エフェクト
                for (let i=0;i<8;i++) { const a=Math.random()*Math.PI*2; this.particles.push(new Particle(hx,hy,Math.cos(a)*80,Math.sin(a)*80,'#aaeeff',400,3)); }
            }
        }
        // Poison Dagger: 3段目で毒付与
        if (style === 'poison' && this.player.comboCount === 2 && monster.alive) {
            monster.poisonTimer = 3000; monster.poisonTickTimer = 1000;
        }
        // ダメージ数値表示
        let numColor = '#fff', numLabel = '';
        if (partBroken) { numColor = '#ff4444'; numLabel = 'BREAK!'; Sound.playPartBreak();
            // 部位破壊素材ドロップ
            const cx=monster.x+monster.width/2, cy=monster.y+monster.height/2;
            const matId = partBroken === 'head' ? 'drakeHeadScale' : 'drakeTail';
            const item = new DroppedItem(cx, cy, matId, 1); item.setScatter(cx, cy);
            this.droppedItems.push(item);
        }
        if (isWeak && !partBroken) { numColor = '#ffaa22'; numLabel = 'WEAK!'; }
        this.damageNumbers.push(new DamageNumber(hx, hy - 20, dmg, numColor, numLabel));
        // ヒットパーティクル
        const isFinish = this.player.comboCount === 2;
        this.spawnHitParticles(hx, hy, isFinish ? 12 : 7, isFinish);
        if (isFinish) Sound.playComboHit(); else Sound.playHit();
        if (!monster.alive) { Sound.playMonsterDie(); this.onMonsterDefeated(monster); }
    }

    confirmSkill() {
        const skill = this.skillChoices[this.skillCursor];
        if (skill) {
            skill.apply(this.player);
            this.player.acquiredSkills.push(skill.id);
        }
        this.skillSelectActive = false;
        this.state = 'playing';
    }

    triggerLevelUp() {
        this.levelUpTimer = 2000;
        Sound.playLevelUp();
        // レベルアップパーティクル
        const px = this.player.x + this.player.width/2, py = this.player.y + this.player.height/2;
        for (let i=0; i<15; i++) {
            const a = Math.random()*Math.PI*2, sp = 60+Math.random()*80;
            this.particles.push(new Particle(px, py, Math.cos(a)*sp, Math.sin(a)*sp-60, '#ffcc00', 600+Math.random()*400, 3));
        }
        // スキル選択画面を表示
        const available = SKILLS.filter(s => !this.player.acquiredSkills.includes(s.id));
        // ランダムに3つ選択
        const shuffled = available.sort(() => Math.random() - 0.5);
        this.skillChoices = shuffled.slice(0, Math.min(3, shuffled.length));
        if (this.skillChoices.length > 0) {
            this.skillCursor = 0;
            this.skillSelectActive = true;
            this.state = 'skillSelect';
        }
    }

    onMonsterDefeated(monster) {
        // ドロップ生成（スキル「採掘」の追加ドロップ対応）
        const drops = monster.generateDrops();
        // 採掘スキル: 各ドロップに+1
        if (this.player.skillExtraDrop > 0) {
            for (const d of drops) d.count += this.player.skillExtraDrop;
        }
        this.droppedItems.push(...drops);
        // 討伐数カウント
        this.totalHunts++;
        try { localStorage.setItem('mh2d_totalHunts', String(this.totalHunts)); } catch(e){}
        // 称号更新
        if (this.totalHunts >= 1 && !this.inventory.title) this.inventory.title = 'Novice Hunter';
        if (this.totalHunts >= 10 && this.inventory.title === 'Novice Hunter') this.inventory.title = 'Hunter';
        if (monster.name === 'Giant Drake' && this.inventory.title !== 'Dragon Slayer') this.inventory.title = 'Drake Slayer';
        // EXP獲得
        const expAmount = MONSTER_EXP[monster.name] || 50;
        const leveled = this.player.addExp(expAmount);
        if (leveled) this.triggerLevelUp();
        // Giant Drake討伐時の特別パーティクル
        if (monster.isBoss) {
            for (let i = 0; i < 30; i++) {
                const a = Math.random()*Math.PI*2, sp = 50+Math.random()*150;
                this.particles.push(new Particle(
                    monster.x+monster.width/2, monster.y+monster.height/2,
                    Math.cos(a)*sp, Math.sin(a)*sp-50,
                    ['#ffcc00','#ffdd44','#ff8800','#ffffff'][Math.floor(Math.random()*4)],
                    800+Math.random()*800, 3+Math.random()*3
                ));
            }
        }
        if (this.monsters.every(m=>!m.alive)) {
            this.questSuccess=true;
            this.questRewards=this.currentQuest.rewards.map(r=>({...r}));
            // サブクエスト判定
            this.subQuestResults = [];
            let expMult = 1, matMult = 1;
            if (this.subQuestState.damageTaken === 0) { this.subQuestResults.push(SUB_QUESTS[0]); expMult = 2; }
            if (this.questTimer <= 60) { this.subQuestResults.push(SUB_QUESTS[1]); matMult = 2; }
            if (this.subQuestState.headBroken && this.subQuestState.tailBroken) this.subQuestResults.push(SUB_QUESTS[2]);
            if (this.subQuestState.parryCount >= 3) {
                this.subQuestResults.push(SUB_QUESTS[3]);
                this.questRewards.push({ materialId: 'drakeCore', count: 1 });
            }
            // 報酬適用
            for (const r of this.questRewards) {
                this.inventory.addMaterial(r.materialId, r.count * matMult);
            }
            // クリア記録
            this.inventory.clearedQuests.add(this.currentQuest.id);
            // 称号
            if (this.currentQuest.id === 'abyss') this.inventory.title = 'Dragon Slayer';
            // タイムアタック記録
            if (this.timeAttackMode) {
                const prev = this.inventory.bestTimes[this.currentQuest.id];
                if (!prev || this.questTimer < prev) {
                    this.inventory.bestTimes[this.currentQuest.id] = Math.round(this.questTimer * 100) / 100;
                    try { localStorage.setItem('mh2d_bestTimes', JSON.stringify(this.inventory.bestTimes)); } catch(e){}
                }
            }
            Sound.playQuestComplete();
            this.resultTimer=this.resultDuration; this.resultAnimTimer=0;
            this.spawnVictoryParticles();
            this.state='result';
            // クエスト完了時オートセーブ
            if (this.player) {
                this._savedPlayerLevel = this.player.level;
                this._savedPlayerExp = this.player.exp;
                this._savedPlayerMaxHp = this.player.maxHp;
                this._savedBonusDamage = this.player.bonusDamage;
                this._savedBaseSpeed = this.player.baseSpeed;
                this._savedSkills = this.player.acquiredSkills;
                this._savedSkillMeleeMult = this.player.skillMeleeMult;
                this._savedSkillBowCdMult = this.player.skillBowCdMult;
                this._savedSkillDefMult = this.player.skillDefMult;
                this._savedSkillAtkSpdMult = this.player.skillAtkSpdMult;
                this._savedSkillExtraDrop = this.player.skillExtraDrop;
                this._savedSkillShowHpNum = this.player.skillShowHpNum;
            }
            this.saveGame();
        }
    }

    checkCollision(a,b) { return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y; }

    loop(timestamp) {
        const dt=this.lastTime?(timestamp-this.lastTime)/1000:0;
        this.lastTime=timestamp;
        this.update(Math.min(dt,0.1));
        this.draw();
        requestAnimationFrame((t)=>this.loop(t));
    }

    update(dt) {
        if (this.craftMessageTimer>0) this.craftMessageTimer-=dt*1000;
        if (this.weaponSwitchTimer>0) this.weaponSwitchTimer-=dt*1000;
        if (this.shakeTimer>0) this.shakeTimer-=dt*1000;
        if (this.levelUpTimer>0) this.levelUpTimer-=dt*1000;
        if (this.saveIndicatorTimer>0) this.saveIndicatorTimer-=dt*1000;

        // ダメージ数値更新
        for (const dn of this.damageNumbers) dn.update(dt);
        this.damageNumbers = this.damageNumbers.filter(d => d.alive);

        // ロビーアニメーション
        if (this.state === 'lobby' || this.state === 'title') {
            this.lobbyTime += dt;
            if (Sound.ctx && !this.windNode) this.startWind();
        } else {
            if (this.windNode) this.stopWind();
        }

        // タイトル画面タイマー
        if (this.state==='title') {
            this.titleTimer += dt;
            if (this.titleTimer > 3) this.state = 'lobby';
            return;
        }

        // パーティクル更新（常に）
        for (const p of this.particles) p.update(dt);
        this.particles = this.particles.filter(p=>p.alive);

        if (this.state==='result') {
            this.resultAnimTimer += dt;
            this.resultTimer-=dt;
            if (this.resultTimer<=0) { this._returnToLobbyWithSave(); }
            return;
        }
        if (this.state==='gameover') {
            this.resultAnimTimer += dt;
            this.resultTimer-=dt;
            if (this.resultTimer<=0) { this._returnToLobbyWithSave(); }
            return;
        }
        // ボス登場演出
        if (this.state === 'bossIntro') {
            this.bossIntroTimer -= dt;
            if (this.bossIntroTimer <= 0) { this.state = 'playing'; this.bossIntroActive = false; }
            return;
        }

        if (this.state!=='playing') return;

        // クエストタイマー
        this.questTimer += dt;
        if (this.subQuestBannerTimer > 0) this.subQuestBannerTimer -= dt * 1000;
        // 制限時間チェック
        if (this.questTimeLimit > 0 && this.questTimer >= this.questTimeLimit) {
            this.questSuccess=false; Sound.playQuestFailed();
            this.resultTimer=this.resultDuration; this.resultAnimTimer=0;
            this.state='gameover'; return;
        }
        this.player.update(dt, this.keys, WORLD_W, WORLD_H, TREES);
        // カメラ追従
        this.camera.x = this.player.x + this.player.width/2 - this.W/2;
        this.camera.y = this.player.y + this.player.height/2 - this.H/2;
        this.camera.x = Math.max(0, Math.min(WORLD_W - this.W, this.camera.x));
        this.camera.y = Math.max(0, Math.min(WORLD_H - this.H, this.camera.y));
        // Frost Blade 2連撃目のヒット判定
        if (this.player._frostSecondHitReady) {
            this.player._frostSecondHitReady = false;
            const hb = this.player.getAttackHitbox();
            if (hb) {
                for (const m of this.monsters) {
                    if (m.alive && this.checkCollision(hb, m)) {
                        this.applyMeleeDamageToMonster(m);
                    }
                }
            }
        }
        for (const m of this.monsters) if (m.alive) m.update(dt, this.player, this);

        for (const arrow of this.arrows) {
            arrow.update(dt, this.canvas.width, this.canvas.height);
            if (arrow.alive) {
                for (let mi=0; mi<this.monsters.length; mi++) {
                    const m = this.monsters[mi];
                    if (!m.alive) continue;
                    if (arrow.pierce && arrow.hitIds.has(mi)) continue;
                    const ab={x:arrow.x-3,y:arrow.y-3,width:6,height:6};
                    if (this.checkCollision(ab,m)) {
                        const { dmg, isWeak } = this.calcDamage(arrow.damage, this.player.weapon, 1.0, m);
                        m.takeDamage(dmg,0,0, arrow.x, arrow.y);
                        const nc = isWeak ? '#ffaa22' : '#fff';
                        const nl = isWeak ? 'WEAK!' : '';
                        this.damageNumbers.push(new DamageNumber(arrow.x, arrow.y-10, dmg, nc, nl));
                        this.spawnHitParticles(arrow.x, arrow.y, 5, false);
                        Sound.playHit();
                        if (!m.alive) { Sound.playMonsterDie(); this.onMonsterDefeated(m); }
                        if (arrow.pierce) { arrow.hitIds.add(mi); }
                        else { arrow.alive=false; break; }
                    }
                }
            }
        }
        this.arrows=this.arrows.filter(a=>a.alive);

        // 氷の息の更新
        for (const ib of this.iceBreaths) {
            ib.x += ib.vx * dt; ib.y += ib.vy * dt;
            ib.life -= dt * 1000;
            if (ib.life <= 0 || ib.x < -20 || ib.x > 820 || ib.y < -20 || ib.y > 620) { ib.alive = false; continue; }
            const pdx = (this.player.x+this.player.width/2) - ib.x;
            const pdy = (this.player.y+this.player.height/2) - ib.y;
            if (Math.sqrt(pdx*pdx+pdy*pdy) < 20) {
                this.player.slowTimer = 2000;
                ib.alive = false;
                for (let i=0; i<5; i++) {
                    const a = Math.random()*Math.PI*2;
                    this.particles.push(new Particle(ib.x,ib.y,Math.cos(a)*60,Math.sin(a)*60,'#aaeeff',300,2));
                }
            }
        }
        this.iceBreaths = this.iceBreaths.filter(ib => ib.alive);

        for (const item of this.droppedItems) {
            item.update(dt);
            if (!item.collected&&item.animProgress>=1) {
                const dx=(this.player.x+this.player.width/2)-item.x;
                const dy=(this.player.y+this.player.height/2)-item.y;
                if (Math.sqrt(dx*dx+dy*dy)<32) {
                    item.collected=true; item.collectEffectTimer=item.collectEffectDuration;
                    this.inventory.addMaterial(item.materialId, item.count);
                    Sound.playPickup();
                }
            }
        }
        this.droppedItems=this.droppedItems.filter(i=>!i.isFullyDone());

        if (this.player.hp<=0) {
            this.questSuccess=false; Sound.playQuestFailed();
            this.resultTimer=this.resultDuration; this.resultAnimTimer=0;
            this.state='gameover';
        }
    }

    // ========================================
    // 描画
    // ========================================
    draw() {
        const ctx=this.ctx;
        // カメラシェイク適用
        ctx.save();
        if (this.shakeTimer>0) {
            const sx=(Math.random()-0.5)*this.shakeIntensity*2;
            const sy=(Math.random()-0.5)*this.shakeIntensity*2;
            ctx.translate(sx,sy);
        }
        switch(this.state) {
            case 'title': this.drawTitle(ctx); break;
            case 'lobby': this.drawLobby(ctx); break;
            case 'playing': this.drawField(ctx); break;
            case 'inventory':
                if (this._returnToLobby) this.drawLobby(ctx); else this.drawField(ctx);
                this.drawInventory(ctx); break;
            case 'craft':
                if (this._returnToLobby) this.drawLobby(ctx); else this.drawField(ctx);
                this.drawCraftMenu(ctx); break;
            case 'skillSelect': this.drawField(ctx); this.drawSkillSelect(ctx); break;
            case 'bossIntro': this.drawBossIntro(ctx); break;
            case 'gameover': this.drawField(ctx); this.drawGameOver(ctx); break;
            case 'result': this.drawField(ctx); this.drawQuestComplete(ctx); break;
        }
        // セーブインジケーター（右上）
        if (this.saveIndicatorTimer > 0) {
            const a = Math.min(1, this.saveIndicatorTimer / 500);
            ctx.globalAlpha = a;
            ctx.fillStyle = '#44cc44'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'right';
            ctx.fillText('SAVED \u2713', 790, 20);
            ctx.globalAlpha = 1;
        }
        // セーブメニュー
        if (this.saveMenuActive) {
            this.drawSaveMenu(ctx);
        }
        ctx.restore();
    }

    drawSaveMenu(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0,0,this.W,this.H);
        const pw = 300, ph = 220, px = (this.W-pw)/2, py = (this.H-ph)/2;
        ctx.fillStyle = '#1a1a2e';
        roundRect(ctx, px, py, pw, ph, 10); ctx.fill();
        ctx.strokeStyle = '#cc8844'; ctx.lineWidth = 2;
        roundRect(ctx, px, py, pw, ph, 10); ctx.stroke();
        ctx.fillStyle = '#cc8844'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
        ctx.fillText('MENU', 400, py + 35);
        if (this.saveMenuConfirm) {
            ctx.fillStyle = '#ff4444'; ctx.font = '14px monospace';
            ctx.fillText('Reset all data?', 400, py + 90);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace';
            ctx.fillText('Y: Yes   N: No', 400, py + 130);
        } else {
            const items = ['Save Game', 'Load Game', 'New Game (Reset)'];
            for (let i = 0; i < items.length; i++) {
                const sel = i === this.saveMenuCursor;
                const iy = py + 65 + i * 40;
                if (sel) {
                    ctx.fillStyle = 'rgba(200,140,60,0.15)';
                    roundRect(ctx, px+20, iy-12, pw-40, 30, 4); ctx.fill();
                    ctx.fillStyle = '#ffcc44'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
                    ctx.fillText('>', px + 30, iy + 5);
                }
                ctx.fillStyle = sel ? '#fff' : '#aaa';
                ctx.font = sel ? 'bold 14px monospace' : '14px monospace'; ctx.textAlign = 'left';
                ctx.fillText(items[i], px + 50, iy + 5);
            }
        }
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
        ctx.fillText('Esc: Close', 400, py + ph - 15);
        ctx.restore();
    }

    drawField(ctx) {
        ctx.save(); ctx.globalAlpha = 1;

        // === ワールド空間描画（カメラオフセット適用） ===
        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);

        // マップ背景（カメラ範囲のみ描画）
        if (this.grassCanvas) {
            ctx.drawImage(this.grassCanvas,
                this.camera.x, this.camera.y, this.W, this.H,
                this.camera.x, this.camera.y, this.W, this.H);
        } else {
            ctx.fillStyle = '#2d5a27'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
        }

        for (const item of this.droppedItems) { ctx.save(); item.draw(ctx); ctx.restore(); }
        for (const arrow of this.arrows) { ctx.save(); arrow.draw(ctx); ctx.restore(); }
        for (const m of this.monsters) {
            ctx.save();
            const mImg = m.isIceWolf ? this.images.iceWolf : (m.isBoss ? this.images.giantDrake : this.images.forestDrake);
            m.draw(ctx, mImg);
            ctx.restore();
        }
        if (this.player) { ctx.save(); this.player.draw(ctx, this.images.player); ctx.restore(); }
        // 氷の息
        for (const ib of this.iceBreaths) {
            if (!ib.alive) continue;
            ctx.save();
            ctx.fillStyle = '#88ddff'; ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.arc(ib.x, ib.y, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#aaeeff'; ctx.globalAlpha = 0.4;
            ctx.beginPath(); ctx.arc(ib.x, ib.y, 12, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        // パーティクル・ダメージ数値（ワールド空間）
        for (const p of this.particles) { ctx.save(); p.draw(ctx); ctx.restore(); }
        for (const dn of this.damageNumbers) { ctx.save(); dn.draw(ctx); ctx.restore(); }
        // プレイヤースロー
        if (this.player && this.player.slowTimer > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(100,200,255,0.4)'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, 24, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore(); // カメラオフセット終了

        // === スクリーン空間描画（カメラ影響なし） ===
        // レベルアップテキスト
        if (this.levelUpTimer > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, this.levelUpTimer / 500);
            ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center';
            ctx.fillText(`LEVEL UP! Lv${this.player.level}`, 400, 200);
            ctx.restore();
        }
        // ボス第2形態 赤ビネット
        const bossPhase2 = this.monsters.find(m => m.isBoss && m.alive && m.phase2);
        if (bossPhase2) {
            ctx.save();
            const pa = 0.08 + Math.sin(Date.now() * 0.005) * 0.05;
            const g = ctx.createRadialGradient(this.W/2, this.H/2, this.W*0.25, this.W/2, this.H/2, this.W*0.56);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, `rgba(150,0,0,${pa})`);
            ctx.fillStyle = g; ctx.fillRect(0,0,this.W,this.H);
            ctx.restore();
        }
        // HUD
        if (this.player) { ctx.save(); this.drawUI(ctx); ctx.restore(); }
        ctx.restore();
    }

    // ========================================
    // UI描画（HPバー改善版）
    // ========================================
    drawUI(ctx) {
        // === プレイヤーHPバー（角丸・色変化・点滅） ===
        const pBarX=20, pBarY=20, pBarW=200, pBarH=20, r=5;
        ctx.fillStyle='#fff'; ctx.font='14px monospace'; ctx.textAlign='left';
        ctx.fillText('PLAYER HP', pBarX, pBarY-5);
        // バー背景
        roundRect(ctx, pBarX, pBarY, pBarW, pBarH, r);
        ctx.fillStyle='#222'; ctx.fill();
        // HP量で色変化
        const ratio = this.player.hp / this.player.maxHp;
        let hpColor;
        if (ratio > 0.7) hpColor = '#44cc44';
        else if (ratio > 0.3) hpColor = '#cccc22';
        else {
            // 30%以下は点滅
            const blink = Math.sin(Date.now()*0.01) > 0 ? '#ee3333' : '#aa1111';
            hpColor = blink;
        }
        if (ratio > 0) {
            ctx.save();
            roundRect(ctx, pBarX, pBarY, pBarW, pBarH, r); ctx.clip();
            ctx.fillStyle = hpColor;
            ctx.fillRect(pBarX, pBarY, pBarW*ratio, pBarH);
            ctx.restore();
        }
        // バー枠
        roundRect(ctx, pBarX, pBarY, pBarW, pBarH, r);
        ctx.strokeStyle='#aaa'; ctx.lineWidth=2; ctx.stroke();
        // HP数値
        ctx.fillStyle='#fff'; ctx.font='12px monospace'; ctx.textAlign='center';
        ctx.fillText(`${this.player.hp} / ${this.player.maxHp}`, pBarX+pBarW/2, pBarY+15);
        // EXPバー（HP下）
        const expBarY = pBarY + pBarH + 5;
        roundRect(ctx, pBarX, expBarY, pBarW, 10, 3);
        ctx.fillStyle='#111'; ctx.fill();
        if (this.player.level < MAX_LEVEL) {
            const expRatio = this.player.exp / this.player.getExpToNext();
            ctx.save();
            roundRect(ctx, pBarX, expBarY, pBarW, 10, 3); ctx.clip();
            ctx.fillStyle='#4488cc';
            ctx.fillRect(pBarX, expBarY, pBarW*expRatio, 10);
            ctx.restore();
        } else {
            ctx.save();
            roundRect(ctx, pBarX, expBarY, pBarW, 10, 3); ctx.clip();
            ctx.fillStyle='#ccaa44';
            ctx.fillRect(pBarX, expBarY, pBarW, 10);
            ctx.restore();
        }
        roundRect(ctx, pBarX, expBarY, pBarW, 10, 3);
        ctx.strokeStyle='#666'; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle='#aaa'; ctx.font='10px monospace'; ctx.textAlign='left';
        if (this.player.level < MAX_LEVEL) {
            ctx.fillText(`Lv${this.player.level}  ${this.player.exp}/${this.player.getExpToNext()} EXP`, pBarX, expBarY + 22);
        } else {
            ctx.fillText(`Lv${this.player.level}  MAX`, pBarX, expBarY + 22);
        }

        // コンボ/チャージ表示
        const wStyle = this.player.weapon.style;
        if (this.player.comboTimer > 0 && (wStyle==='combo3'||wStyle==='poison')) {
            const max = wStyle==='poison'?4:3;
            let dots = '';
            for (let i=0;i<max;i++) dots += i<=this.player.comboCount ? '\u25cf' : '\u25cb';
            ctx.fillStyle = wStyle==='poison'?'#44cc44':'#ffcc44';
            ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
            ctx.fillText(`COMBO ${dots}`, pBarX, pBarY+60);
        }
        if (this.player.charging) {
            const threshold = wStyle==='bow'?1000:800;
            const p = Math.min(1,this.player.chargeTime/threshold);
            ctx.fillStyle='#444'; ctx.fillRect(pBarX,pBarY+55,pBarW*0.5,8);
            ctx.fillStyle=this.player.chargeReady?'#ffcc00':'#8888cc';
            ctx.fillRect(pBarX,pBarY+55,pBarW*0.5*p,8);
            ctx.strokeStyle='#888';ctx.lineWidth=1;ctx.strokeRect(pBarX,pBarY+55,pBarW*0.5,8);
            ctx.fillStyle='#fff';ctx.font='10px monospace';ctx.textAlign='left';
            ctx.fillText(this.player.chargeReady?'CHARGE READY!':'Charging...',pBarX+pBarW*0.5+5,pBarY+63);
        }
        if (this.player.blocking) {
            ctx.fillStyle='#8888ff';ctx.font='bold 12px monospace';ctx.textAlign='left';
            ctx.fillText('BLOCKING',pBarX,pBarY+75);
        }
        // クエストタイマー（上部中央）
        if (this.timeAttackMode || this.questTimeLimit > 0) {
            ctx.fillStyle='#fff'; ctx.font='bold 18px monospace'; ctx.textAlign='center';
            const t = this.questTimeLimit > 0 ? Math.max(0, this.questTimeLimit - this.questTimer) : this.questTimer;
            const m = Math.floor(t/60), s = Math.floor(t%60), ms = Math.floor((t%1)*100);
            ctx.fillText(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(2,'0')}`, 400, 18);
        }
        // 称号表示
        if (this.inventory.title) {
            ctx.fillStyle='#ffcc44'; ctx.font='bold 11px monospace'; ctx.textAlign='right';
            ctx.fillText(this.inventory.title, 780, 590);
        }
        // サブクエストバナー
        if (this.subQuestBannerTimer > 0) {
            const a = Math.min(1, this.subQuestBannerTimer/500);
            ctx.globalAlpha=a; ctx.fillStyle='#44ff44'; ctx.font='bold 20px monospace'; ctx.textAlign='center';
            ctx.fillText(this.subQuestBanner, 400, 160); ctx.globalAlpha=1;
        }

        // === モンスターHPバー（遅延ダメージ表現） ===
        const alive = this.monsters.filter(m=>m.alive);
        if (alive.length>0) {
            const mBarW=300, mBarH=18; let mBarY=25;
            for (const m of alive) {
                const mBarX=(this.W-mBarW)/2;
                ctx.fillStyle='#fff'; ctx.font='bold 13px monospace'; ctx.textAlign='center';
                ctx.fillText(m.name, 400, mBarY-4);
                // バー背景（角丸）
                roundRect(ctx, mBarX, mBarY, mBarW, mBarH, 4);
                ctx.fillStyle='#222'; ctx.fill();
                ctx.save();
                roundRect(ctx, mBarX, mBarY, mBarW, mBarH, 4); ctx.clip();
                // 遅延HP（白バー）
                const delayRatio = m.displayHp / m.maxHp;
                if (delayRatio > 0) {
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.fillRect(mBarX, mBarY, mBarW*delayRatio, mBarH);
                }
                // 実HP
                const mRatio = m.hp / m.maxHp;
                ctx.fillStyle = m.enraged ? '#dd8822' : (m.isBoss ? '#cc6622' : '#cc3333');
                ctx.fillRect(mBarX, mBarY, mBarW*mRatio, mBarH);
                ctx.restore();
                // 枠
                roundRect(ctx, mBarX, mBarY, mBarW, mBarH, 4);
                ctx.strokeStyle='#aaa'; ctx.lineWidth=2; ctx.stroke();
                ctx.fillStyle='#fff'; ctx.font='11px monospace';
                ctx.fillText(`${m.hp} / ${m.maxHp}`, 400, mBarY+14);
                mBarY += mBarH+22;
            }
        }

        // 装備表示
        const eqX=this.W-210; let eqY=this.H-55;
        if (this.player.armor) eqY-=22;
        ctx.fillStyle='rgba(0,0,0,0.5)';
        const eqH=this.player.armor?57:35;
        roundRect(ctx,eqX,eqY,195,eqH,6); ctx.fill();
        roundRect(ctx,eqX,eqY,195,eqH,6); ctx.strokeStyle='#666';ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle='#fff';ctx.font='12px monospace';ctx.textAlign='left';
        ctx.fillText(`Weapon: ${this.player.weapon.name}`,eqX+8,eqY+15);
        ctx.fillStyle='#aaa';ctx.font='10px monospace';
        ctx.fillText(`${this.player.weapon.desc}  Q:Switch`,eqX+8,eqY+28);
        if (this.player.armor) {
            ctx.fillStyle='#aaddff';ctx.font='12px monospace';
            ctx.fillText(`Armor: ${this.player.armor.name} (x${this.player.armor.damageMultiplier})`,eqX+8,eqY+45);
        }
        if (this.weaponSwitchTimer>0) {
            ctx.fillStyle=`rgba(255,255,100,${Math.min(1,this.weaponSwitchTimer/300)})`;
            ctx.font='bold 18px monospace';ctx.textAlign='center';
            ctx.fillText(this.weaponSwitchMessage,400,400);
        }
        ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='12px monospace';ctx.textAlign='center';
        ctx.fillText('WASD:Move  Z:Attack  X:Block/Parry  Q:Switch  I:Inv  C:Craft',400,590);
        // ミニマップ描画
        this.drawMinimap(ctx);
    }

    // ========================================
    // クエスト完了画面（スライドイン + 順次表示）
    // ========================================
    drawQuestComplete(ctx) {
        ctx.save(); ctx.globalAlpha=1;
        ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(0,0,this.W,this.H);
        const t = this.resultAnimTimer;
        // タイトルスライドイン（上から）
        const titleY = Math.min(220, -50 + t * 500);
        ctx.fillStyle='#44ff44'; ctx.font='bold 42px monospace'; ctx.textAlign='center';
        ctx.fillText('QUEST COMPLETE!', 400, titleY);
        // 報酬ヘッダ
        if (t > 0.4) {
            ctx.fillStyle='#fff'; ctx.font='bold 18px monospace';
            ctx.fillText('Rewards', 400, 270);
        }
        // 報酬アイテムを0.3秒ごとに1個ずつ表示
        let ry = 300;
        for (let i=0; i<this.questRewards.length; i++) {
            const showTime = 0.6 + i * 0.3;
            if (t < showTime) break;
            const r = this.questRewards[i];
            const mat = MATERIALS[r.materialId];
            const itemAlpha = Math.min(1, (t - showTime) / 0.2);
            ctx.globalAlpha = itemAlpha;
            ctx.fillStyle = mat.color;
            ctx.beginPath(); ctx.arc(320, ry-4, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle='#fff'; ctx.font='16px monospace'; ctx.textAlign='left';
            ctx.fillText(`${mat.name}  x${r.count}`, 340, ry);
            ctx.globalAlpha = 1;
            ry += 35;
        }
        // サブクエスト結果
        if (this.subQuestResults.length > 0 && t > 1.5) {
            ctx.fillStyle = '#ffcc44'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
            ctx.fillText('SUB QUEST COMPLETE!', 400, ry + 10);
            ry += 25;
            ctx.font = '12px monospace'; ctx.fillStyle = '#aaa';
            for (const sq of this.subQuestResults) {
                ctx.fillText(`${sq.name}: ${sq.desc}`, 400, ry);
                ry += 20;
            }
        }
        // タイムアタック結果
        if (this.timeAttackMode) {
            ctx.fillStyle='#ffcc44'; ctx.font='bold 14px monospace'; ctx.textAlign='center';
            const time = this.questTimer.toFixed(2);
            const best = this.inventory.bestTimes[this.currentQuest.id];
            ctx.fillText(`TIME: ${time}s${best && best <= this.questTimer ? '' : ' NEW BEST!'}`, 400, ry + 30);
        }
        // カウントダウン
        ctx.fillStyle='#aaa'; ctx.font='16px monospace'; ctx.textAlign='center';
        ctx.fillText(`Returning to lobby in ${Math.max(0,Math.ceil(this.resultTimer))}s  (R: now)`, 400, 520);
        ctx.restore();
    }

    // ========================================
    // ゲームオーバー画面（赤フェード）
    // ========================================
    drawGameOver(ctx) {
        ctx.save(); ctx.globalAlpha=1;
        const t = this.resultAnimTimer;
        // 赤フェードオーバーレイ
        const redAlpha = Math.min(0.4, t * 0.5);
        ctx.fillStyle = `rgba(100,0,0,${redAlpha})`;
        ctx.fillRect(0,0,this.W,this.H);
        // 黒オーバーレイ
        ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, t*0.4)})`;
        ctx.fillRect(0,0,this.W,this.H);
        // テキスト
        if (t > 0.5) {
            const a = Math.min(1, (t-0.5)/0.3);
            ctx.globalAlpha = a;
            ctx.fillStyle='#ff4444'; ctx.font='bold 42px monospace'; ctx.textAlign='center';
            ctx.fillText('QUEST FAILED...', 400, 280);
            ctx.fillStyle='#aaa'; ctx.font='16px monospace';
            ctx.fillText(`Returning to lobby in ${Math.max(0,Math.ceil(this.resultTimer))}s  (R: now)`, 400, 380);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    // ========================================
    // ロビー / インベントリ / クラフト（Phase 3と同じ）
    // ========================================
    // ========================================
    // スキル選択画面
    // ========================================
    drawSkillSelect(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,this.W,this.H);
        ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
        ctx.fillText('LEVEL UP! Select a Skill', 400, 150);
        const cardW = 400, cardH = 70;
        const startY = 200;
        for (let i = 0; i < this.skillChoices.length; i++) {
            const skill = this.skillChoices[i];
            const sel = i === this.skillCursor;
            const cy = startY + i * (cardH + 15);
            const cx = (800 - cardW) / 2;
            ctx.fillStyle = sel ? '#1a2a3a' : '#111122';
            roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.fill();
            ctx.strokeStyle = sel ? '#ffcc00' : '#444';
            ctx.lineWidth = sel ? 2 : 1;
            roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.stroke();
            if (sel) {
                ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left';
                ctx.fillText('>', cx - 20, cy + 30);
            }
            ctx.fillStyle = sel ? '#fff' : '#aaa'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left';
            ctx.fillText(skill.name, cx + 20, cy + 28);
            ctx.fillStyle = '#888'; ctx.font = '13px monospace';
            ctx.fillText(skill.desc, cx + 20, cy + 52);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
        ctx.fillText('W/S: Select  Z: Confirm', 400, startY + this.skillChoices.length*(cardH+15) + 30);
        ctx.restore();
    }

    // ========================================
    // ボス登場演出
    // ========================================
    drawBossIntro(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,this.W,this.H);
        const t = 3 - this.bossIntroTimer; // 経過時間
        if (t > 0.5) {
            const a = Math.min(1, (t - 0.5) / 0.5);
            ctx.globalAlpha = a;
            ctx.fillStyle = '#cc2222'; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center';
            ctx.fillText('GIANT DRAKE', 400, 270);
            ctx.fillStyle = '#ff4444'; ctx.font = 'bold 28px monospace';
            ctx.fillText('APPEARS!', 400, 320);
        }
        // 赤い脈動エフェクト
        if (t > 1.0) {
            const pulse = Math.sin(t * 6) * 0.15;
            ctx.globalAlpha = Math.max(0, pulse);
            ctx.fillStyle = '#330000';
            ctx.fillRect(0,0,this.W,this.H);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // ========================================
    // タイトル画面
    // ========================================
    drawTitle(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        // ダークグリーンのグラデーション背景
        const grad = ctx.createLinearGradient(0, 0, 0, 600);
        grad.addColorStop(0, '#0a2a0a');
        grad.addColorStop(0.5, '#143814');
        grad.addColorStop(1, '#0a1a0a');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,this.W,this.H);
        // 装飾パーティクル（ゆっくり浮かぶ光）
        const t = this.titleTimer;
        for (let i = 0; i < 15; i++) {
            const x = 100 + (i * 137) % 600;
            const y = 500 - ((t * 30 + i * 80) % 600);
            const a = 0.1 + Math.sin(t * 2 + i) * 0.1;
            ctx.globalAlpha = a;
            ctx.fillStyle = '#88cc44';
            ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // ロゴ（ゴールドテキスト）
        const logoAlpha = Math.min(1, t / 0.8);
        ctx.globalAlpha = logoAlpha;
        ctx.fillStyle = '#cc9933';
        ctx.font = 'bold 52px monospace'; ctx.textAlign = 'center';
        ctx.fillText('MONSTER HUNT 2D', 400, 230);
        // ロゴの影
        ctx.fillStyle = '#664411';
        ctx.fillText('MONSTER HUNT 2D', 402, 233);
        // ロゴ上に重ねて明るい色
        ctx.fillStyle = '#ffcc44';
        ctx.fillText('MONSTER HUNT 2D', 400, 230);
        ctx.globalAlpha = 1;
        // サブタイトル
        if (t > 0.5) {
            const subAlpha = Math.min(1, (t - 0.5) / 0.5);
            ctx.globalAlpha = subAlpha;
            ctx.fillStyle = '#88aa66';
            ctx.font = '18px monospace';
            ctx.fillText('Hunt. Craft. Survive.', 400, 280);
            ctx.globalAlpha = 1;
        }
        // 「Press any key to start」点滅
        if (t > 1.0) {
            const blinkAlpha = 0.4 + Math.sin(t * 4) * 0.4;
            ctx.globalAlpha = blinkAlpha;
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px monospace';
            ctx.fillText('Press any key to start', 400, 420);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    // ========================================
    // ミニマップ描画
    // ========================================
    drawMinimap(ctx) {
        const mmW = 150, mmH = 112;
        const mmX = this.W - mmW - 10, mmY = 10;
        const scaleX = mmW / WORLD_W, scaleY = mmH / WORLD_H;
        ctx.save();
        // 背景（エリア色分け）
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        roundRect(ctx, mmX, mmY, mmW, mmH, 4); ctx.fill();
        // エリア色
        ctx.save();
        roundRect(ctx, mmX, mmY, mmW, mmH, 4); ctx.clip();
        for (const area of AREAS) {
            ctx.fillStyle = area.color; ctx.globalAlpha = 0.4;
            ctx.fillRect(mmX + area.x * scaleX, mmY + area.y * scaleY, area.w * scaleX, area.h * scaleY);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        // 枠
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
        roundRect(ctx, mmX, mmY, mmW, mmH, 4); ctx.stroke();
        // 木（緑の小点）
        ctx.fillStyle = '#2a6a2a';
        for (const tree of TREES) {
            ctx.fillRect(mmX + tree.x * scaleX - 1, mmY + tree.y * scaleY - 1, 2, 2);
        }
        // カメラ表示範囲（白枠）
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
        ctx.strokeRect(
            mmX + this.camera.x * scaleX,
            mmY + this.camera.y * scaleY,
            this.W * scaleX,
            this.H * scaleY
        );
        // モンスター（赤い点）
        for (const m of this.monsters) {
            if (!m.alive) continue;
            ctx.fillStyle = m.isBoss ? '#ff6622' : '#ff3333';
            const mx = mmX + (m.x + m.width / 2) * scaleX;
            const my = mmY + (m.y + m.height / 2) * scaleY;
            ctx.beginPath(); ctx.arc(mx, my, m.isBoss ? 3 : 2, 0, Math.PI * 2); ctx.fill();
        }
        // プレイヤー（白い点）
        if (this.player) {
            ctx.fillStyle = '#ffffff';
            const px = mmX + (this.player.x + this.player.width / 2) * scaleX;
            const py = mmY + (this.player.y + this.player.height / 2) * scaleY;
            ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    drawLobby(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        const t = this.lobbyTime;

        // === 背景画像 ===
        if (this.images.lobbyBg) {
            ctx.drawImage(this.images.lobbyBg, 0, 0, this.W, this.H);
            // 半透明の暗幕で文字を読みやすく
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(0, 0, this.W, this.H);
        } else {
            ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, this.W, this.H);
        }

        // === タイトルロゴ ===
        const cx = this.W / 2;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 10;
        ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = '#ffcc44'; ctx.fillText('MONSTER HUNT 2D', cx, 40);
        ctx.restore();
        // アンダーライン（流れる光）
        const lineProgress = (t * 0.4) % 1;
        const lineGrad = ctx.createLinearGradient(cx-300, 0, cx+300, 0);
        lineGrad.addColorStop(Math.max(0, lineProgress - 0.15), 'rgba(255,80,30,0)');
        lineGrad.addColorStop(lineProgress, 'rgba(255,80,30,0.8)');
        lineGrad.addColorStop(Math.min(1, lineProgress + 0.15), 'rgba(255,80,30,0)');
        ctx.strokeStyle = lineGrad; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx-250, 48); ctx.lineTo(cx+250, 48); ctx.stroke();
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
        ctx.fillStyle = '#ddc99a'; ctx.font = 'italic 13px monospace';
        ctx.fillText('Hunt. Craft. Survive.', cx, 65);
        ctx.restore();

        // === クエストカード（2列グリッド） ===
        const cardW = Math.min(355, (this.W-45)/2), cardH = Math.min(120, (this.H-200)/3);
        const gap = 8;
        const colX = [15, this.W/2 + 5];
        const startY = 80;
        const diffColors = ['#44aa44', '#ccaa22', '#cc4444', '#aa44cc'];

        for (let i = 0; i < QUESTS.length; i++) {
            const q = QUESTS[i];
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx = colX[col];
            const cy = startY + row * (cardH + gap);
            const sel = i === this.lobbyCursor;
            const locked = this.isQuestLocked(q);

            // カード背景（深紫半透明）
            ctx.fillStyle = sel ? 'rgba(10,5,20,0.85)' : 'rgba(0,0,0,0.75)';
            roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.fill();

            // 選択枠（金色）
            if (sel) {
                ctx.strokeStyle = '#cc9944'; ctx.lineWidth = 2;
                roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.stroke();
                // 波リングエフェクト
                const ringAlpha = 0.15 + Math.sin(t * 5) * 0.1;
                ctx.strokeStyle = `rgba(200,150,60,${ringAlpha})`; ctx.lineWidth = 1;
                const ringR = 20 + (t * 40) % 60;
                ctx.beginPath(); ctx.arc(cx + cardW / 2, cy + cardH / 2, ringR, 0, Math.PI * 2); ctx.stroke();
            } else {
                ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 1;
                roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.stroke();
            }

            // 左端の難易度色帯
            const dc = diffColors[Math.min(q.difficulty - 1, 3)];
            ctx.fillStyle = dc;
            ctx.save();
            roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.clip();
            ctx.fillRect(cx, cy, 5, cardH);
            ctx.restore();

            // 特殊クエスト: URGENTバッジ
            if (q.special) {
                ctx.fillStyle = '#cc2222'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'right';
                roundRect(ctx, cx + cardW - 62, cy + 4, 55, 16, 3);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.fillText('SPECIAL', cx + cardW - 10, cy + 15);
                ctx.textAlign = 'left';
            }

            // 難易度星
            const stars = this.getDifficultyStars(q.difficulty);
            ctx.fillStyle = '#ffcc44'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
            ctx.fillText(stars, cx + 14, cy + 18);

            // クエスト名
            ctx.fillStyle = sel ? '#fff' : '#bbb';
            ctx.font = 'bold 14px monospace';
            ctx.fillText(q.name, cx + 14, cy + 38);

            // 説明
            ctx.fillStyle = '#777'; ctx.font = '10px monospace';
            ctx.fillText(q.description, cx + 14, cy + 55);

            // 報酬
            ctx.fillStyle = '#666'; ctx.font = '9px monospace';
            let rt = '';
            for (const r of q.rewards) rt += `${MATERIALS[r.materialId].name} x${r.count}  `;
            ctx.fillText('Reward: ' + rt, cx + 14, cy + 72);

            // ベストタイム
            const bt = this.inventory.bestTimes[q.id];
            if (bt) {
                ctx.fillStyle = '#ccaa44'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
                ctx.fillText(`BEST ${bt.toFixed(2)}s`, cx + cardW - 8, cy + cardH - 8);
                ctx.textAlign = 'left';
            }

            // クリア済み
            if (this.inventory.clearedQuests.has(q.id) && !bt) {
                ctx.fillStyle = '#44aa44'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
                ctx.fillText('CLEARED', cx + cardW - 8, cy + cardH - 8);
                ctx.textAlign = 'left';
            }

            // ロック
            if (locked) {
                ctx.save();
                roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.clip();
                ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(cx, cy, cardW, cardH);
                ctx.restore();
                ctx.fillStyle = '#aa4444'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
                ctx.fillText('\u{1F512} LOCKED', cx + cardW / 2, cy + cardH / 2 - 2);
                ctx.fillStyle = '#666'; ctx.font = '9px monospace';
                const cond = q.unlockCondition === 'allClear+lv5' ? 'Clear all quests + Lv5' : 'Clear Elder Drake';
                ctx.fillText(cond, cx + cardW / 2, cy + cardH / 2 + 14);
                ctx.textAlign = 'left';
            }
        }

        // === プレイヤーステータスパネル（左下） ===
        const spY = this.H - 125;
        ctx.fillStyle = 'rgba(10,10,20,0.75)';
        roundRect(ctx, 10, spY, 210, 110, 8); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        roundRect(ctx, 10, spY, 210, 110, 8); ctx.stroke();
        // プレイヤーアイコン（簡易シルエット）
        ctx.fillStyle = '#2a6a2a';
        ctx.beginPath(); ctx.arc(35, spY+25, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(29, spY+35, 12, 15);
        // レベル・称号
        const pLvl = this.player ? this.player.level : (this.inventory._lastLevel || 1);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
        ctx.fillText(`Lv ${pLvl}`, 55, spY+27);
        ctx.fillStyle = '#cc9944'; ctx.font = '11px monospace';
        ctx.fillText(this.inventory.title || 'Novice', 55, spY+43);
        ctx.fillStyle = '#888'; ctx.font = '10px monospace';
        ctx.fillText(`Total Hunts: ${this.totalHunts}`, 18, spY+70);
        // EXPバー
        if (this.player) {
            const expR = this.player.level >= MAX_LEVEL ? 1 : this.player.exp / this.player.getExpToNext();
            const ebY = spY+80;
            ctx.fillStyle = '#222'; roundRect(ctx, 18, ebY, 190, 8, 3); ctx.fill();
            ctx.save(); roundRect(ctx, 18, ebY, 190, 8, 3); ctx.clip();
            ctx.fillStyle = '#4488cc'; ctx.fillRect(18, ebY, 190 * expR, 8);
            ctx.restore();
            ctx.strokeStyle = '#444'; ctx.lineWidth = 1; roundRect(ctx, 18, ebY, 190, 8, 3); ctx.stroke();
            ctx.fillStyle = '#666'; ctx.font = '8px monospace';
            ctx.fillText(this.player.level >= MAX_LEVEL ? 'MAX' : `${this.player.exp}/${this.player.getExpToNext()} EXP`, 18, ebY+15);
        }

        // === 操作ガイド（最下部固定） ===
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
        const taLabel = this.timeAttackMode ? ' [TA:ON]' : '';
        ctx.fillText(`W/S:Select  Z:Start  T:TimeAtk${taLabel}  I:Inv  C:Craft`, this.W/2+100, this.H-8);
        ctx.restore();
    }
    getDifficultyStars(l) { let s='';for(let i=0;i<3;i++)s+=i<l?'\u2605':'\u2606';return s; }

    drawInventory(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        // 全画面オーバーレイ
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0,0,this.W,this.H);
        // タイトル
        ctx.fillStyle = '#4488cc'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
        ctx.fillText('INVENTORY', 400, 40);
        ctx.strokeStyle = '#333355'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(30, 52); ctx.lineTo(770, 52); ctx.stroke();

        // === 左列: 素材 ===
        let y = 75;
        ctx.fillStyle = '#88ccff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left';
        ctx.fillText('Materials', 30, y);
        y += 22; ctx.font = '13px monospace';
        let has = false;
        for (const [id, mat] of Object.entries(MATERIALS)) {
            const c = this.inventory.getMaterialCount(id);
            if (c > 0) {
                has = true;
                ctx.fillStyle = mat.color;
                ctx.beginPath(); ctx.arc(45, y - 4, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ddd';
                ctx.fillText(`${mat.name}`, 58, y);
                ctx.fillStyle = '#ffcc44'; ctx.textAlign = 'right';
                ctx.fillText(`x${c}`, 370, y);
                ctx.textAlign = 'left';
                y += 24;
            }
        }
        if (!has) { ctx.fillStyle = '#555'; ctx.fillText('No materials', 58, y); y += 24; }

        // === 右列上: 武器 ===
        let wy = 75;
        ctx.fillStyle = '#ffcc44'; ctx.font = 'bold 15px monospace';
        ctx.fillText('Weapons', 420, wy);
        wy += 22; ctx.font = '13px monospace';
        for (const w of this.inventory.weapons) {
            const eq = this.player && w === this.player.weapon;
            if (eq) { ctx.fillStyle = '#44ff44'; ctx.fillText('E', 425, wy); }
            ctx.fillStyle = eq ? '#fff' : '#aaa';
            ctx.fillText(w.name, 445, wy);
            ctx.fillStyle = '#777'; ctx.textAlign = 'right';
            ctx.fillText(`DMG:${w.damage} ${w.desc}`, 770, wy);
            ctx.textAlign = 'left';
            wy += 24;
        }

        // === 右列下: 防具 ===
        wy += 12;
        ctx.fillStyle = '#aaddff'; ctx.font = 'bold 15px monospace';
        ctx.fillText('Armor', 420, wy);
        wy += 22; ctx.font = '13px monospace';
        if (this.inventory.armors.length === 0) {
            ctx.fillStyle = '#555'; ctx.fillText('No armor', 445, wy);
        } else {
            for (const a of this.inventory.armors) {
                const eq = this.player && a === this.player.armor;
                if (eq) { ctx.fillStyle = '#44ff44'; ctx.fillText('E', 425, wy); }
                ctx.fillStyle = eq ? '#fff' : '#aaa';
                ctx.fillText(`${a.name}  DEF+${a.defense} (x${a.damageMultiplier})`, 445, wy);
                wy += 24;
            }
        }

        // 操作ガイド（最下部固定）
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
        ctx.fillText('Press I to close', 400, 580);
        ctx.restore();
    }

    drawCraftMenu(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        // 全画面オーバーレイ
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0,0,this.W,this.H);
        // タイトル
        // タブ表示
        const tabNames = ['CRAFT', 'UPGRADE'];
        for (let t = 0; t < 2; t++) {
            const tx = 200 + t * 200, tw = 160;
            ctx.fillStyle = this.craftTab === t ? '#cc8844' : '#444';
            roundRect(ctx, tx, 10, tw, 30, 5); ctx.fill();
            ctx.fillStyle = this.craftTab === t ? '#fff' : '#888';
            ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
            ctx.fillText(tabNames[t], tx + tw / 2, 30);
        }
        ctx.strokeStyle = '#443322'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(30, 48); ctx.lineTo(770, 48); ctx.stroke();

        if (this.craftTab === 1) {
            // === UPGRADEタブ ===
            const items = [...this.inventory.weapons.filter(w=>w.name!=='Basic Sword'), ...this.inventory.armors];
            let uy = 65;
            if (items.length === 0) {
                ctx.fillStyle = '#666'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
                ctx.fillText('No upgradeable items', 400, 200);
            } else {
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const sel = i === this.upgradeCursor;
                    const isWeapon = item instanceof Weapon;
                    const canUp = isWeapon ? this.inventory.canUpgrade(item) : this.inventory.canUpgradeArmor(item);
                    const lvl = item.upgradeLevel || 0;
                    const maxed = lvl >= 3;
                    // カード
                    ctx.fillStyle = sel ? 'rgba(100,150,200,0.15)' : '#111122';
                    roundRect(ctx, 30, uy, 740, 55, 6); ctx.fill();
                    if (sel) { ctx.strokeStyle = '#4488cc'; ctx.lineWidth = 2; roundRect(ctx, 30, uy, 740, 55, 6); ctx.stroke(); }
                    // 名前
                    ctx.fillStyle = sel ? '#fff' : '#aaa'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
                    const dname = item.getDisplayName ? item.getDisplayName() : `${item.name}+${lvl}`;
                    ctx.fillText(dname, 50, uy + 22);
                    // レベルドット
                    ctx.font = '12px monospace'; ctx.fillStyle = '#888';
                    let dots = ''; for (let d = 0; d < 3; d++) dots += d < lvl ? '\u2605' : '\u2606';
                    ctx.fillText(dots, 250, uy + 22);
                    // ステータス
                    if (isWeapon) { ctx.fillStyle='#aaa'; ctx.fillText(`DMG:${item.damage}`, 330, uy+22); }
                    else { ctx.fillText(`x${item.damageMultiplier}`, 330, uy+22); }
                    // コスト表示
                    if (!maxed) {
                        const id = this.inventory.getWeaponId ? this.inventory.getWeaponId(item) : 'drakeArmor';
                        const costDef = UPGRADE_COSTS[id || 'drakeArmor'];
                        if (costDef) {
                            const c = costDef.costs[lvl];
                            ctx.fillStyle = '#888'; ctx.font = '11px monospace';
                            ctx.fillText(`Cost: ${MATERIALS[costDef.mat].name} x${c.m}${c.c>0?' + Core x'+c.c:''}`, 50, uy+42);
                        }
                    } else {
                        ctx.fillStyle = '#ffcc00'; ctx.font = '11px monospace';
                        ctx.fillText('MAX LEVEL', 50, uy + 42);
                    }
                    // ボタン
                    if (sel && !maxed) {
                        const bx = 640, by = uy + 8, bw = 110, bh = 26;
                        ctx.fillStyle = canUp ? '#44aa44' : '#333';
                        roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();
                        ctx.fillStyle = canUp ? '#fff' : '#777';
                        ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
                        ctx.fillText('UPGRADE [Z]', bx + bw/2, by + 17);
                        ctx.textAlign = 'left';
                    }
                    uy += 62;
                }
            }
        } else {
        // === CRAFTタブ（2列グリッド） ===
        const cardW = 370, cardH = 120, gap = 10;
        const colX = [15, 415];
        const startY = 55;

        for (let i = 0; i < RECIPES.length; i++) {
            const r = RECIPES[i];
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx = colX[col];
            const cy = startY + row * (cardH + gap);
            const cc = this.inventory.canCraft(r);
            const own = this.inventory.alreadyOwns(r);
            const sel = i === this.craftCursor;

            // カード背景
            if (sel) {
                ctx.fillStyle = 'rgba(204,136,68,0.12)';
                roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.fill();
                ctx.strokeStyle = '#cc8844'; ctx.lineWidth = 2;
                roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.stroke();
            } else {
                ctx.fillStyle = '#111122';
                roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.fill();
                ctx.strokeStyle = '#333344'; ctx.lineWidth = 1;
                roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.stroke();
            }

            // カーソル
            if (sel) {
                ctx.fillStyle = '#cc8844'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left';
                ctx.fillText('>', cx + 8, cy + 24);
            }

            // 武器名
            ctx.fillStyle = own ? '#666' : (cc ? '#fff' : '#888');
            ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left';
            ctx.fillText(r.name, cx + 25, cy + 24);

            // [OWNED]
            if (own) {
                ctx.fillStyle = '#44cc44'; ctx.font = '11px monospace';
                ctx.fillText('[OWNED]', cx + 25 + ctx.measureText(r.name).width + 8, cy + 24);
            }

            // 説明
            ctx.fillStyle = '#999'; ctx.font = '11px monospace';
            ctx.fillText(r.description, cx + 25, cy + 44);

            // 必要素材
            ctx.fillStyle = '#888'; ctx.font = '11px monospace';
            let mx = cx + 25;
            const my = cy + 68;
            for (const req of r.materials) {
                const mat = MATERIALS[req.materialId];
                const ow = this.inventory.getMaterialCount(req.materialId);
                const en = ow >= req.count;
                ctx.fillStyle = mat.color;
                ctx.beginPath(); ctx.arc(mx + 4, my - 3, 4, 0, Math.PI * 2); ctx.fill();
                mx += 12;
                ctx.fillStyle = en ? '#44cc44' : '#cc4444';
                const tx = `${mat.name} ${ow}/${req.count}  `;
                ctx.fillText(tx, mx, my);
                mx += ctx.measureText(tx).width;
            }

            // クラフトボタン
            if (sel && !own) {
                const bx = cx + cardW - 110, by = cy + cardH - 35;
                const bw = 95, bh = 26;
                ctx.fillStyle = cc ? '#44aa44' : '#333';
                roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();
                ctx.fillStyle = cc ? '#fff' : '#777';
                ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
                ctx.fillText('CRAFT [Z]', bx + bw / 2, by + 17);
                ctx.textAlign = 'left';
            }
        }

        } // craftTab === 0 の閉じ括弧

        // クラフトメッセージ
        if (this.craftMessageTimer > 0) {
            const alpha = Math.min(1, this.craftMessageTimer / 300);
            ctx.fillStyle = `rgba(255,255,100,${alpha})`;
            ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
            ctx.fillText(this.craftMessage, 400, 545);
        }

        // 操作ガイド（最下部固定）
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
        ctx.fillText('W/S:Select  Z:Execute  E:Tab  C:Close', 400, 580);
        ctx.restore();
    }
}

// ========================================
// ゲーム起動
// ========================================
window.addEventListener('load', () => { new Game('gameCanvas'); });
