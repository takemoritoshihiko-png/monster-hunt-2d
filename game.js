// ========================================
// MONSTER HUNT 2D - Phase 5
// フィールド改善・エフェクト・コンボ・UI仕上げ
// ========================================
import { MATERIALS, UPGRADE_COSTS, UPGRADE_DMG_MULT, ARMOR_UPGRADE_MULT, SUB_QUESTS, EXP_TABLE, MONSTER_EXP, MAX_LEVEL, SKILLS, SKILL_TREE, DROP_TABLES, WORLD_W, WORLD_H, AREAS, TREES, TREE_TRUNK_R, TREE_CANOPY_R, TREE_COLLISION_R, QUESTS, Weapon, WEAPONS, Armor, ARMORS, RECIPES, FRAGMENT_DROPS, BOX_RECIPES, COMPANION_TYPES } from './data.js';
import { SeededRandom, Particle, DamageNumber, SoundManager, Sound, roundRect } from './utils.js';
import { DroppedItem, Arrow } from './weapon.js';
import { Inventory } from './inventory.js';
import { Player } from './player.js';
import { Monster } from './monster.js';
import { Companion, PARTY_BONUSES } from './companion.js';

// ========================================
// ローグライクモード定数
// ========================================
const ROGUE_CARDS = [
    { id:'blood',   name:'血の契約',  desc:'HP-20・ダメージ+30%',   apply:(p,g)=>{p.maxHp=Math.max(20,p.maxHp-20);p.hp=Math.min(p.hp,p.maxHp);g._rogueAtkMult*=1.3;} },
    { id:'sharp',   name:'鋭利化',    desc:'近距離ダメージ+20%',    apply:(p,g)=>{p.skillMeleeMult*=1.2;} },
    { id:'swift',   name:'素早さ',    desc:'移動速度+15%・回避+20%', apply:(p,g)=>{p.baseSpeed=Math.floor(p.baseSpeed*1.15);} },
    { id:'heal',    name:'回復',      desc:'HP全回復',              apply:(p,g)=>{p.hp=p.maxHp;} },
    { id:'explode', name:'爆発矢',    desc:'矢ヒット時に爆発ダメ',  apply:(p,g)=>{g._rogueExplode=true;} },
    { id:'dual',    name:'二刀流',    desc:'攻撃2回ヒット・各×0.7', apply:(p,g)=>{g._rogueDual=true;} },
    { id:'vampire', name:'吸血',      desc:'攻撃ヒット時HP+3',      apply:(p,g)=>{g._rogueVampire=true;} },
    { id:'rage',    name:'怒り',      desc:'HP50%以下でダメージ+50%', apply:(p,g)=>{g._rogueRage=true;} },
    { id:'guard',   name:'守護',      desc:'被ダメージ-25%',        apply:(p,g)=>{p.skillDefMult*=0.75;} },
    { id:'chain',   name:'連鎖',      desc:'敵撃破で周囲に50ダメ',   apply:(p,g)=>{g._rogueChain=true;} },
];

const ROGUE_FLOOR_MONSTERS = ['Forest Drake','Ice Wolf','Forest Drake','Ice Wolf'];
const ROGUE_BOSS_CONFIGS = {
    5:  [{ name:'Giant Drake', config:{ hp:2000,width:132,height:132,speed:70,color:'#882222',attackDamage:18,attackRange:90,attackCooldown:1000,aggroRange:350,dropTableId:'giantDrake',isBoss:true }}],
    10: [{ name:'Elder Drake', config:{ hp:3000,width:180,height:180,speed:100,color:'#220022',attackDamage:25,attackRange:100,attackCooldown:800,aggroRange:450,dropTableId:'giantDrake',isBoss:true,isElder:true }}],
};

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
        // スキルツリー
        this.skillTreeCursor = { branch: 'common', idx: 0 };
        this.skillPointHintTimer = 0;
        // ローグライクモード
        this.rogueActive = false;
        this.rogueFloor = 0;
        this.rogueEnemiesLeft = 0;
        this.rogueKills = 0;
        this.rogueCards = [];          // 取得済みカード
        this.rogueCardChoices = [];    // 3択カード
        this.rogueCardCursor = 0;
        this.rogueFloorClearTimer = 0;
        this._rogueAtkMult = 1.0;
        this._rogueExplode = false;
        this._rogueDual = false;
        this._rogueVampire = false;
        this._rogueRage = false;
        this._rogueChain = false;
        this.rogueBestFloor = 0;
        try { this.rogueBestFloor = parseInt(localStorage.getItem('mh2d_rogueBest') || '0'); } catch(e){}
        // ガチャ演出
        this.gachaActive = false;
        this.gachaTimer = 0;
        this.gachaResult = null;    // Companion
        this.gachaFrameColor = '#fff';
        // クラフトアニメーション
        this.craftAnimTimer = 0;     // アニメ進行(ms)
        this.craftAnimName = '';     // クラフトした武器名
        this.craftAnimActive = false;
        // インベントリUI
        this.invTab = 0;         // 0=武器, 1=防具, 2=素材, 3=アイテム
        this.invCursor = 0;      // 選択カーソル
        // 必殺技表示
        this.slowMoTimer = 0;
        this.ultimateName = '';
        this.ultimateWeaponName = '';
        this.ultimateDisplayTimer = 0;
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
        // ヒットストップ
        this.hitStopFrames = 0;
        // ゲーム内時間（昼夜サイクル: 60秒=1サイクル）
        this.gameTime = 0;
        this.isNight = false;
        // パーティ（2スロット）
        this.partySlots = [null, null]; // Companion references
        this.activeCompanions = [];     // フィールド上の仲間
        this.partyBonus = null;
        this.partyCursor = 0;
        this.partyTab = 0; // 0=スロット, 1=一覧

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
            this._savedTreeSkills = [...this.player.treeSkills];
            this._savedSkillPoints = this.player.skillPoints;
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
                treeSkills: this.player ? [...this.player.treeSkills] : (this._savedTreeSkills || []),
                skillPoints: this.player ? this.player.skillPoints : (this._savedSkillPoints || 0),
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
            this._savedTreeSkills = data.treeSkills || [];
            this._savedSkillPoints = data.skillPoints || 0;
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
        player.treeSkills = new Set(this._savedTreeSkills || []);
        player.skillPoints = this._savedSkillPoints || 0;
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
        // パーティメンバーの配置
        this.activeCompanions = [];
        this.activeCompanion = null;
        for (let i = 0; i < 2; i++) {
            const c = this.partySlots[i];
            if (!c) continue;
            c.x = this.player.x + (i===0 ? -80 : 80);
            c.y = this.player.y + 80;
            c.followOffsetX = (i===0 ? -80 : 80);
            c.followOffsetY = 80;
            c.hp = c.maxHp; c.alive = true;
            c._recalcStats();
            this.activeCompanions.push(c);
        }
        if (this.activeCompanions.length > 0) this.activeCompanion = this.activeCompanions[0];
        // 旧互換: inventory.activeCompanionも設定
        if (!this.activeCompanion && this.inventory.activeCompanion) {
            const c = this.inventory.activeCompanion;
            c.x = this.player.x + 50; c.y = this.player.y + 30;
            c.hp = c.maxHp; c.alive = true;
            this.activeCompanion = c;
            this.activeCompanions = [c];
        }
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
                if (key==='i') {this.state='inventory';this._returnToLobby=true;this.invTab=0;this.invCursor=0;return;}
                if (key==='c') {this.state='craft';this.craftCursor=0;this.craftTab=0;this._returnToLobby=true;return;}
                if (key==='p') {this.state='skillTree';this._returnToLobby=true;this.skillTreeCursor={branch:'common',idx:0};return;}
                if (key==='b') {this.state='party';this._returnToLobby=true;this.partyCursor=0;this.partyTab=0;return;}
                if (key==='m') { this.startRoguelike(); return; }
                return;
            }
            if (this.state==='result') { if (key==='r'||key==='enter') this._returnToLobbyWithSave(); return; }
            if (this.state==='gameover') { if (key==='r') this._returnToLobbyWithSave(); return; }
            if (key==='i') {
                if (this.state==='inventory') {this.state=this._returnToLobby?'lobby':'playing';this._returnToLobby=false;}
                else if (this.state==='playing') {this.state='inventory';this._returnToLobby=false;this.invTab=0;this.invCursor=0;}
                return;
            }
            if (key==='c') {
                if (this.state==='craft') {this.state=this._returnToLobby?'lobby':'playing';this._returnToLobby=false;}
                else if (this.state==='playing') {this.state='craft';this.craftCursor=0;this._returnToLobby=false;}
                return;
            }
            // インベントリ内操作
            if (this.state==='inventory') {
                if (key==='arrowleft'||key==='a') { this.invTab=Math.max(0,this.invTab-1); this.invCursor=0; }
                else if (key==='arrowright'||key==='d') { this.invTab=Math.min(4,this.invTab+1); this.invCursor=0; }
                else if (key==='arrowup'||key==='w') this.invCursor=Math.max(0,this.invCursor-1);
                else if (key==='arrowdown'||key==='s') this.invCursor++;
                else if ((key==='z'||key==='enter') && this.invTab===4) {
                    // 仲間の出撃/待機切替
                    const comps = this.inventory.companions;
                    if (comps[this.invCursor]) {
                        const c = comps[this.invCursor];
                        if (c === this.inventory.activeCompanion) {
                            this.inventory.activeCompanion = null;
                            this.activeCompanion = null;
                        } else {
                            this.inventory.activeCompanion = c;
                        }
                    }
                }
                return;
            }
            if (this.state==='craft') {
                if (key==='tab'||key==='e') { this.craftTab=(this.craftTab+1)%3; this.upgradeCursor=0; this.craftCursor=0; return; }
                if (this.craftTab===0) {
                    if (key==='arrowup'||key==='w') this.craftCursor=Math.max(0,this.craftCursor-1);
                    else if (key==='arrowdown'||key==='s') this.craftCursor=Math.min(RECIPES.length-1,this.craftCursor+1);
                    else if (key==='enter'||key==='z') this.executeCraft();
                } else if (this.craftTab===2) {
                    // BOXタブ
                    if (key==='arrowup'||key==='w') this.craftCursor=Math.max(0,this.craftCursor-1);
                    else if (key==='arrowdown'||key==='s') this.craftCursor=Math.min(BOX_RECIPES.length-1,this.craftCursor+1);
                    else if (key==='enter'||key==='z') this.openBox();
                } else {
                    const items=[...this.inventory.weapons.filter(w=>w.name!=='Basic Sword'),...this.inventory.armors];
                    if (key==='arrowup'||key==='w') this.upgradeCursor=Math.max(0,this.upgradeCursor-1);
                    else if (key==='arrowdown'||key==='s') this.upgradeCursor=Math.min(items.length-1,this.upgradeCursor+1);
                    else if (key==='enter'||key==='z') this.executeUpgrade(items);
                }
                return;
            }
            // パーティ画面
            if (this.state==='party') {
                if (key==='b'||key==='escape') { this.state=this._returnToLobby?'lobby':'playing'; this._returnToLobby=false; return; }
                if (key==='arrowleft'||key==='a') this.partyTab=0;
                if (key==='arrowright'||key==='d') this.partyTab=1;
                if (key==='arrowup'||key==='w') this.partyCursor=Math.max(0,this.partyCursor-1);
                if (key==='arrowdown'||key==='s') this.partyCursor++;
                if (key==='z'||key==='enter') this.handlePartyAction();
                return;
            }
            // ローグライクカード選択
            if (this.state==='rogueCard') {
                if (key==='arrowup'||key==='w') this.rogueCardCursor=Math.max(0,this.rogueCardCursor-1);
                else if (key==='arrowdown'||key==='s') this.rogueCardCursor=Math.min(this.rogueCardChoices.length-1,this.rogueCardCursor+1);
                else if (key==='z'||key==='enter') this.selectRogueCard();
                return;
            }
            // ローグライクゲームオーバー
            if (this.state==='rogueOver') {
                if (key==='r'||key==='enter') this.state='lobby';
                return;
            }
            // スキルツリー画面
            if (this.state==='skillTree') {
                const branches = ['common','swordsman','tank','archer','mage'];
                const bi = branches.indexOf(this.skillTreeCursor.branch);
                if (key==='arrowleft'||key==='a') { const ni=Math.max(0,bi-1); this.skillTreeCursor.branch=branches[ni]; this.skillTreeCursor.idx=0; }
                else if (key==='arrowright'||key==='d') { const ni=Math.min(4,bi+1); this.skillTreeCursor.branch=branches[ni]; this.skillTreeCursor.idx=0; }
                else if (key==='arrowup'||key==='w') this.skillTreeCursor.idx=Math.max(0,this.skillTreeCursor.idx-1);
                else if (key==='arrowdown'||key==='s') {
                    const list=this.skillTreeCursor.branch==='common'?SKILL_TREE.common:SKILL_TREE[this.skillTreeCursor.branch].skills;
                    this.skillTreeCursor.idx=Math.min(list.length-1,this.skillTreeCursor.idx+1);
                }
                else if (key==='z'||key==='enter') this.learnTreeSkill();
                else if (key==='p'||key==='escape') { this.state=this._returnToLobby?'lobby':'playing'; this._returnToLobby=false; }
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
            if (key==='shift') {
                // ダッシュ回避
                let ddx=0, ddy=0;
                if (this.keys['w']||this.keys['arrowup']) ddy=-1;
                if (this.keys['s']||this.keys['arrowdown']) ddy=1;
                if (this.keys['a']||this.keys['arrowleft']) ddx=-1;
                if (this.keys['d']||this.keys['arrowright']) ddx=1;
                if (this.player.dodge(ddx, ddy)) {
                    // ジャスト回避判定（モンスターが攻撃溜め中かチェック）
                    let isJust = false;
                    for (const m of this.monsters) {
                        if (m.alive && m.atkPhase === 'windup' && m.telegraphTimer < 200) isJust = true;
                    }
                    if (isJust) {
                        this.damageNumbers.push(new DamageNumber(this.player.x+this.player.width/2, this.player.y-30, 0, '#ffcc00', 'JUST EVADE!!'));
                        this.player.justEvadeBonus = 2000;
                    } else {
                        this.damageNumbers.push(new DamageNumber(this.player.x+this.player.width/2, this.player.y-20, 0, '#44ddff', 'EVADE!'));
                    }
                }
            }
            if (key==='r') this.tryUltimate();
            if (key==='p') { this.state='skillTree'; this._returnToLobby=false; this.skillTreeCursor={branch:'common',idx:0}; }
            if (key==='b') { this.state='party'; this._returnToLobby=false; this.partyCursor=0; this.partyTab=0; }
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

    // ========================================
    // ローグライクモード
    // ========================================
    startRoguelike() {
        this.rogueActive = true;
        this.rogueFloor = 0;
        this.rogueKills = 0;
        this.rogueCards = [];
        this._rogueAtkMult = 1.0;
        this._rogueExplode = false;
        this._rogueDual = false;
        this._rogueVampire = false;
        this._rogueRage = false;
        this._rogueChain = false;
        // リセットされたプレイヤー
        const rogueInv = new Inventory();
        this.player = new Player(WORLD_W/2, WORLD_H/2+200, rogueInv);
        this.activeCompanion = null;
        this.nextRogueFloor();
    }

    nextRogueFloor() {
        this.rogueFloor++;
        this.droppedItems=[]; this.arrows=[]; this.particles=[]; this.iceBreaths=[]; this.damageNumbers=[];
        this.rogueFloorClearTimer = 0;
        // ランダムマップ生成（草テクスチャ再生成）
        this.generateGrassTexture();

        const isBossFloor = this.rogueFloor % 5 === 0;
        const scaleMult = Math.pow(1.15, this.rogueFloor - 1);

        if (isBossFloor) {
            // ボスフロア
            const bossData = ROGUE_BOSS_CONFIGS[this.rogueFloor] || ROGUE_BOSS_CONFIGS[10];
            if (this.rogueFloor >= 15) {
                // 15F以降: ランダムボス×2
                this.monsters = [];
                for (let i = 0; i < 2; i++) {
                    const bd = bossData[0] || ROGUE_BOSS_CONFIGS[5][0];
                    const cfg = { ...bd.config };
                    cfg.hp = Math.floor(cfg.hp * scaleMult);
                    cfg.attackDamage = Math.floor(cfg.attackDamage * scaleMult);
                    this.monsters.push(new Monster(bd.name, 800+i*600, 700+i*200, cfg));
                }
            } else {
                this.monsters = bossData.map((bd,i) => {
                    const cfg = { ...bd.config };
                    cfg.hp = Math.floor(cfg.hp * scaleMult);
                    cfg.attackDamage = Math.floor(cfg.attackDamage * scaleMult);
                    return new Monster(bd.name, 1100+i*300, 700, cfg);
                });
            }
        } else {
            // 通常フロア: 3〜5体
            const count = 3 + Math.floor(Math.random() * 3);
            this.monsters = [];
            for (let i = 0; i < count; i++) {
                const typeName = ROGUE_FLOOR_MONSTERS[Math.floor(Math.random() * ROGUE_FLOOR_MONSTERS.length)];
                const isWolf = typeName === 'Ice Wolf';
                const cfg = {
                    hp: Math.floor((isWolf ? 450 : 700) * scaleMult),
                    width: isWolf ? 78 : 96, height: isWolf ? 78 : 96,
                    speed: Math.floor((isWolf ? 156 : 96) * scaleMult * 0.3 + (isWolf ? 156 : 96) * 0.7),
                    color: isWolf ? '#88ccee' : '#cc3333',
                    attackDamage: Math.floor((isWolf ? 12 : 10) * scaleMult),
                    attackRange: isWolf ? 60 : 70,
                    attackCooldown: isWolf ? 1200 : 1200,
                    aggroRange: 400,
                    dropTableId: isWolf ? 'iceWolf' : 'forestDrake',
                    isIceWolf: isWolf,
                };
                const mx = 600 + Math.random() * 1200;
                const my = 500 + Math.random() * 800;
                this.monsters.push(new Monster(typeName, mx, my, cfg));
            }
        }

        this.rogueEnemiesLeft = this.monsters.length;
        // プレイヤーを中央に
        this.player.x = WORLD_W/2 - 16;
        this.player.y = WORLD_H/2 + 200;
        this.player.hp = Math.min(this.player.hp + 20, this.player.maxHp); // 少し回復
        this.state = 'playing';
    }

    onRogueMonsterDefeated(monster) {
        this.rogueKills++;
        this.rogueEnemiesLeft--;
        this.droppedItems.push(...monster.generateDrops());

        // 連鎖カード: 周囲50ダメ
        if (this._rogueChain) {
            const cx = monster.x+monster.width/2, cy = monster.y+monster.height/2;
            for (const m of this.monsters) {
                if (!m.alive) continue;
                const d = Math.sqrt((m.x+m.width/2-cx)**2+(m.y+m.height/2-cy)**2);
                if (d < 100) { m.takeDamage(50); this.damageNumbers.push(new DamageNumber(m.x+m.width/2,m.y-10,50,'#ff8844','CHAIN')); }
            }
        }

        // フロアクリアチェック
        if (this.monsters.every(m => !m.alive)) {
            this.rogueFloorClearTimer = 2000;
            Sound.playQuestComplete();
            // ハイスコア更新
            if (this.rogueFloor > this.rogueBestFloor) {
                this.rogueBestFloor = this.rogueFloor;
                try { localStorage.setItem('mh2d_rogueBest', String(this.rogueBestFloor)); } catch(e){}
            }
            // カード選択画面へ（ボスフロアは追加1枚）
            const cardCount = 3;
            const shuffled = [...ROGUE_CARDS].sort(() => Math.random()-0.5);
            this.rogueCardChoices = shuffled.slice(0, cardCount);
            this.rogueCardCursor = 0;
            setTimeout(() => { this.state = 'rogueCard'; }, 1500);
        }
    }

    selectRogueCard() {
        const card = this.rogueCardChoices[this.rogueCardCursor];
        if (card) {
            card.apply(this.player, this);
            this.rogueCards.push(card);
            Sound.playLevelUp();
        }
        this.nextRogueFloor();
    }

    rogueGameOver() {
        this.rogueActive = false;
        if (this.rogueFloor > this.rogueBestFloor) {
            this.rogueBestFloor = this.rogueFloor;
            try { localStorage.setItem('mh2d_rogueBest', String(this.rogueBestFloor)); } catch(e){}
        }
        Sound.playQuestFailed();
        this.state = 'rogueOver';
    }

    handlePartyAction() {
        if (this.partyTab === 0) {
            // スロット操作: 外す
            const idx = this.partyCursor;
            if (idx < 2 && this.partySlots[idx]) {
                this.partySlots[idx] = null;
                this.calcPartyBonus();
            }
        } else {
            // 一覧から追加
            const comps = this.inventory.companions;
            if (this.partyCursor >= comps.length) return;
            const c = comps[this.partyCursor];
            // 空きスロットに追加
            if (!this.partySlots[0]) { this.partySlots[0] = c; }
            else if (!this.partySlots[1]) { this.partySlots[1] = c; }
            else { this.partySlots[0] = c; } // 上書き
            this.calcPartyBonus();
        }
    }

    calcPartyBonus() {
        this.partyBonus = null;
        const types = this.partySlots.filter(s=>s).map(s=>s.type).sort();
        for (const b of PARTY_BONUSES) {
            const bt = [...b.types].sort();
            if (types.length === bt.length && types.every((t,i)=>t===bt[i])) {
                this.partyBonus = b; break;
            }
            // Giant Drake Miniは1体でもOK
            if (bt.length === 1 && types.includes(bt[0])) {
                this.partyBonus = b; break;
            }
        }
    }

    /** 群れ行動更新 */
    updatePacks() {
        // 同種モンスターの群れを形成
        const byName = {};
        for (const m of this.monsters) {
            if (!m.alive || m.isBoss) continue;
            if (!byName[m.name]) byName[m.name] = [];
            byName[m.name].push(m);
        }
        for (const [name, pack] of Object.entries(byName)) {
            if (pack.length < 2) { for (const m of pack) m.packLeader=null; continue; }
            // リーダー=HP最大
            const leader = pack.reduce((a,b) => a.hp > b.hp ? a : b);
            for (const m of pack) m.packLeader = leader;
            // リーダーがダメージを受けていたら群れ怒り
            if (leader.hitFlashTimer > 0) {
                for (const m of pack) {
                    m.packRage = true;
                    m.speed = Math.floor(m.baseSpeed * 1.2);
                }
            }
            // リーダーが死んだら残りが逃走解除
            if (!leader.alive) {
                for (const m of pack) { m.packRage = false; m.packLeader = null; }
            }
        }
    }

    learnTreeSkill() {
        if (!this.player || this.player.skillPoints <= 0) return;
        const c = this.skillTreeCursor;
        const list = c.branch === 'common' ? SKILL_TREE.common : SKILL_TREE[c.branch].skills;
        const skill = list[c.idx];
        if (!skill || this.player.treeSkills.has(skill.id)) return;
        // 前提スキルチェック
        if (skill.requires.length > 0 && !skill.requires.every(r => this.player.treeSkills.has(r))) return;
        // スキル習得
        this.player.treeSkills.add(skill.id);
        this.player.skillPoints--;
        // 即時効果適用
        if (skill.id === 'robust') this.player.maxHp += 50;
        if (skill.id === 'training') this.player.skillMeleeMult *= 1.1;
        if (skill.id === 'sw_power') this.player.skillMeleeMult *= 1.25;
        if (skill.id === 'tk_grit' && this.player.hp < this.player.maxHp * 0.3) this.player.skillMeleeMult *= 1.2;
        Sound.playLevelUp();
        this.craftMessage = `Learned: ${skill.name}!`; this.craftMessageTimer = 2000;
    }

    openBox() {
        const box = BOX_RECIPES[this.craftCursor];
        if (!box) return;
        const companion = this.inventory.openBox(box);
        if (!companion) { this.craftMessage='Not enough materials!'; this.craftMessageTimer=1500; return; }
        // ガチャ演出開始
        this.gachaActive = true;
        this.gachaTimer = 3000; // 3秒演出
        this.gachaResult = companion;
        this.gachaFrameColor = box.frameColor;
        Sound.playLevelUp();
    }

    executeCraft() {
        const r=RECIPES[this.craftCursor]; if (!r) return;
        if (this.inventory.alreadyOwns(r)) {this.craftMessage='Already owned!';this.craftMessageTimer=1500;return;}
        if (this.inventory.craft(r)) {
            this.craftMessage=`Crafted: ${r.name}!`;this.craftMessageTimer=2000;
            this.craftAnimActive=true; this.craftAnimTimer=1500; this.craftAnimName=r.name;
            // 金パーティクル
            for (let i=0;i<20;i++) { const a=Math.random()*Math.PI*2,sp=80+Math.random()*120;
                this.particles.push(new Particle(this.W/2,this.H/2,Math.cos(a)*sp,Math.sin(a)*sp-40,'#ffcc00',600+Math.random()*400,3)); }
            Sound.playLevelUp();
        }
        else {this.craftMessage='Not enough materials!';this.craftMessageTimer=1500;}
    }

    /** 必殺技発動 */
    tryUltimate() {
        if (!this.player || this.player.ultimateGauge < 100) return;
        this.player.ultimateGauge = 0;
        this.player.ultimateActive = true;
        this.player.ultimateTimer = 500; // 0.5秒スローモーション
        this.slowMoTimer = 500;
        const style = this.player.weapon.style;
        const px = this.player.x+this.player.width/2, py = this.player.y+this.player.height/2;
        // 武器別必殺技名
        const ultNames = {
            combo3:'乱舞斬り', charge:'大地割り', bow:'矢の雨',
            frost:'吹雪', hammer:'天地崩壊', poison:'毒霧'
        };
        this.ultimateName = ultNames[style] || 'Ultimate';
        this.ultimateWeaponName = this.player.weapon.name;
        this.ultimateDisplayTimer = 1500;
        // 武器別効果
        if (style === 'combo3') {
            // 乱舞斬り: 前方5連撃
            for (const m of this.monsters) {
                if (!m.alive) continue;
                const d=Math.sqrt((m.x+m.width/2-px)**2+(m.y+m.height/2-py)**2);
                if (d < 150) { for (let i=0;i<5;i++) setTimeout(()=>{ m.takeDamage(Math.floor(this.player.weapon.damage*1.5)); this.spawnHitParticles(m.x+m.width/2,m.y+m.height/2,5,true); }, i*100); }
            }
        } else if (style === 'charge') {
            // 大地割り: 全モンスター200ダメージ
            for (const m of this.monsters) { if (m.alive) { m.takeDamage(200); this.spawnHitParticles(m.x+m.width/2,m.y+m.height/2,15,true); if (!m.alive) { Sound.playMonsterDie(); this.onMonsterDefeated(m); } } }
        } else if (style === 'bow') {
            // 矢の雨: 10本の矢
            const arrowCount = this.player.hasSkill('ar_storm') ? 25 : 10;
            for (let i=0;i<arrowCount;i++) { const ax=px-200+Math.random()*400; this.arrows.push(new Arrow(ax,-50,'down',80)); }
        } else if (style === 'frost') {
            // 吹雪: 全モンスター凍結+150ダメージ
            for (const m of this.monsters) { if (m.alive) { m.frozenTimer=3000; m.takeDamage(150); this.spawnHitParticles(m.x+m.width/2,m.y+m.height/2,10,true); for(let i=0;i<8;i++){const a=Math.random()*Math.PI*2;this.particles.push(new Particle(m.x+m.width/2,m.y+m.height/2,Math.cos(a)*100,Math.sin(a)*100,'#aaeeff',500,3));} if (!m.alive) { Sound.playMonsterDie(); this.onMonsterDefeated(m); } } }
        } else if (style === 'hammer') {
            // 天地崩壊: 300ダメージ+ノックバック
            for (const m of this.monsters) { if (m.alive) { const d=Math.sqrt((m.x-px)**2+(m.y-py)**2)||1; m.takeDamage(300,(m.x-px)/d*20,(m.y-py)/d*20); this.spawnHitParticles(m.x+m.width/2,m.y+m.height/2,15,true); if (!m.alive) { Sound.playMonsterDie(); this.onMonsterDefeated(m); } } }
            this.shakeTimer = 200; this.shakeIntensity = 10;
        } else if (style === 'poison') {
            // 毒霧: 全モンスター毒5秒
            for (const m of this.monsters) { if (m.alive) { m.poisonTimer=5000; m.poisonTickTimer=1000; for(let i=0;i<6;i++){const a=Math.random()*Math.PI*2;this.particles.push(new Particle(m.x+m.width/2,m.y+m.height/2,Math.cos(a)*60,Math.sin(a)*60,'#44cc44',600,3));} } }
        }
        // エフェクト
        for (let i=0;i<20;i++) { const a=Math.random()*Math.PI*2,sp=100+Math.random()*100; this.particles.push(new Particle(px,py,Math.cos(a)*sp,Math.sin(a)*sp-50,'#ffcc00',600+Math.random()*400,4)); }
        Sound.playLevelUp();
    }

    handleAttack() {
        if (this.player.attackCooldown > 0) return;
        const style = this.player.weapon.style;
        // 弓の通常射撃（タップ）
        if (this.player.weapon.type === 'ranged') {
            this.player.attack();
            const cx=this.player.x+this.player.width/2, cy=this.player.y+this.player.height/2;
            const arPierce = this.player.hasSkill('ar_pierce');
            this.arrows.push(new Arrow(cx,cy,this.player.facing,this.player.weapon.damage+this.player.bonusDamage, arPierce));
            // 連矢スキル: 2本同時
            if (this.player.hasSkill('ar_double')) {
                const spread = 10 * Math.PI/180;
                const a2 = new Arrow(cx,cy,this.player.facing,this.player.weapon.damage+this.player.bonusDamage, arPierce);
                const baseAngle = Math.atan2(a2.vy,a2.vx) + spread;
                a2.vx = Math.cos(baseAngle); a2.vy = Math.sin(baseAngle);
                this.arrows.push(a2);
            }
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
                const dmg = 15 + this.player.bonusDamage;
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
        // ジャスト回避ボーナス
        if (this.player.justEvadeBonus > 0) dmg *= 1.5;
        // 武練スキル
        if (this.player.hasSkill('training')) dmg *= 1.1;
        // 居合スキル: ダッシュ直後
        if (this.player.hasSkill('sw_iai') && this.player.dashTimer > 0) dmg *= 1.5;
        // 属性強化スキル
        if (this.player.hasSkill('mg_element') && (weapon.style === 'frost' || weapon.style === 'poison')) dmg *= 1.3;
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
        const partDmgMult = style === 'hammer' ? 1.3 : 1.0;
        const hx = monster.x+monster.width/2, hy = monster.y+monster.height/2;
        // 弱点ゾーン判定（プレイヤー位置ベース）
        const px = this.player.x + this.player.width/2, py = this.player.y + this.player.height/2;
        const { zone: hitZone, mult: spotMult, label: spotLabel } = monster.getHitZone(px, py);
        console.log(`Hit zone: ${hitZone} (${spotLabel || 'normal'}) x${spotMult}`);
        dmg = Math.floor(dmg * partDmgMult * spotMult);
        const { partBroken } = monster.takeDamage(dmg, (dx/dist)*kb*comboMult, (dy/dist)*kb*comboMult, hx, hy);
        // ローグライク: 吸血
        if (this._rogueVampire) this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3);
        // ローグライク: 怒り
        if (this._rogueRage && this.player.hp < this.player.maxHp * 0.5) dmg = Math.floor(dmg * 1.5);
        // 必殺技ゲージ加算
        this.player.addUltGauge(this.player.hasSkill('sw_king') ? 15 : 10);
        // Frost Blade: 凍結カウンター
        if (style === 'frost' && monster.alive && monster.frozenTimer <= 0) {
            monster.frostCount++;
            if (monster.frostCount >= 3) {
                monster.frozenTimer = this.player.hasSkill('mg_freeze') ? 5000 : 2000; monster.frostCount = 0;
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
        if (!partBroken && !isWeak && spotLabel === 'WEAK!') { numColor = '#ffaa22'; numLabel = 'WEAK!'; this.shakeTimer = 40; this.shakeIntensity = 3; }
        if (spotLabel === 'HARD') { numColor = '#888888'; numLabel = 'HARD'; }
        this.damageNumbers.push(new DamageNumber(hx, hy - 20, dmg, numColor, numLabel));
        // ヒットパーティクル
        const isFinish = this.player.comboCount === 2;
        this.spawnHitParticles(hx, hy, isFinish ? 12 : 7, isFinish);
        // ヒットストップ
        this.hitStopFrames = (style === 'hammer') ? 5 : 3;
        // 画面振動
        this.shakeTimer = 100; this.shakeIntensity = style === 'hammer' ? 8 : 3;
        // 大ダメージ時は画面端赤フラッシュ
        if (dmg >= 100) { this.shakeIntensity = 8; this.shakeTimer = 200; }
        // 武器別ヒット音
        if (style === 'hammer') Sound.playComboHit();
        else if (style === 'poison') { Sound._beep(600+this.player.comboCount*100, 0.04, 'square', 0.1); }
        else if (isFinish) Sound.playComboHit();
        else Sound.playHit();
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
        this.skillPointHintTimer = 3000; // SP獲得ヒント3秒
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
        // RESCUE BONUS: 逃走中モンスターを倒した場合
        if (monster.fleeingFromPredator) {
            this.damageNumbers.push(new DamageNumber(monster.x+monster.width/2, monster.y-30, 0, '#44ffaa', 'RESCUE BONUS!'));
            // 追加ドロップ+1
            const extraDrops = monster.generateDrops();
            for (const d of extraDrops) d.count = 1;
            this.droppedItems.push(...extraDrops);
        }
        // 縄張り争い中のモンスターを倒した場合、相手を解放
        if (monster.territoryFight) {
            monster.territoryFight.territoryFight = null;
            monster.territoryFight.ecoState = 'normal';
        }
        // ローグライクモードの場合は専用処理
        if (this.rogueActive) {
            this.onRogueMonsterDefeated(monster);
            return;
        }
        // フラグメントレアドロップ（1%）
        const fragId = FRAGMENT_DROPS[monster.name];
        if (fragId && Math.random() < 0.01) {
            this.inventory.addMaterial(fragId, 1);
            const cx = monster.x+monster.width/2, cy = monster.y+monster.height/2;
            this.damageNumbers.push(new DamageNumber(cx, cy-40, 0, '#ff88ff', 'RARE DROP!'));
            // 虹色パーティクル
            for (let i=0;i<12;i++) {
                const a=Math.random()*Math.PI*2, sp=60+Math.random()*80;
                const colors=['#ff4444','#ffaa00','#ffff00','#44ff44','#4488ff','#aa44ff'];
                this.particles.push(new Particle(cx,cy,Math.cos(a)*sp,Math.sin(a)*sp-30,colors[i%6],800,3));
            }
        }
        // 討伐数カウント
        this.totalHunts++;
        try { localStorage.setItem('mh2d_totalHunts', String(this.totalHunts)); } catch(e){}
        // 称号更新
        if (this.totalHunts >= 1 && !this.inventory.title) this.inventory.title = 'Novice Hunter';
        if (this.totalHunts >= 10 && this.inventory.title === 'Novice Hunter') this.inventory.title = 'Hunter';
        if (monster.name === 'Giant Drake' && this.inventory.title !== 'Dragon Slayer') this.inventory.title = 'Drake Slayer';
        // 全パーティメンバーEXP獲得
        const cExpBase = monster.isBoss ? 150 : 30;
        for (const comp of this.activeCompanions) {
            if (!comp.alive) continue;
            const cLeveled = comp.addExp(cExpBase);
            if (cLeveled) {
                this.damageNumbers.push(new DamageNumber(comp.x, comp.y-20, 0, '#ffcc00', 'LEVEL UP!'));
                for (let i=0;i<8;i++) { const a=Math.random()*Math.PI*2; this.particles.push(new Particle(comp.x+14, comp.y+14, Math.cos(a)*50, Math.sin(a)*50-30, '#ffcc00', 400, 2)); }
            }
        }
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
        // ヒットストップ: フレームスキップ
        if (this.hitStopFrames > 0) { this.hitStopFrames--; this.draw(); requestAnimationFrame((t)=>this.loop(t)); return; }
        this.update(Math.min(dt,0.1));
        this.draw();
        requestAnimationFrame((t)=>this.loop(t));
    }

    update(dt) {
        if (this.craftMessageTimer>0) this.craftMessageTimer-=dt*1000;
        if (this.weaponSwitchTimer>0) this.weaponSwitchTimer-=dt*1000;
        if (this.shakeTimer>0) this.shakeTimer-=dt*1000;
        if (this.levelUpTimer>0) this.levelUpTimer-=dt*1000;
        if (this.skillPointHintTimer>0) this.skillPointHintTimer-=dt*1000;
        if (this.saveIndicatorTimer>0) this.saveIndicatorTimer-=dt*1000;
        if (this.slowMoTimer>0) { this.slowMoTimer-=dt*1000; dt *= 0.3; } // スローモーション
        if (this.ultimateDisplayTimer>0) this.ultimateDisplayTimer-=dt*1000;
        if (this.craftAnimTimer>0) { this.craftAnimTimer-=dt*1000; if (this.craftAnimTimer<=0) this.craftAnimActive=false; }
        if (this.rogueFloorClearTimer>0) this.rogueFloorClearTimer-=dt*1000;
        if (this.gachaTimer>0) { this.gachaTimer-=dt*1000; if (this.gachaTimer<=0) this.gachaActive=false; }

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
        // 全パーティメンバー更新
        for (const comp of this.activeCompanions) {
            if (!comp.alive) continue;
            const hitResult = comp.update(dt, this.player, this.monsters);
            if (hitResult && hitResult.hit) {
                const label = hitResult.isRush ? 'RUSH!' : '';
                this.damageNumbers.push(new DamageNumber(hitResult.target.x+hitResult.target.width/2, hitResult.target.y-10, hitResult.dmg, '#aaffaa', label));
                for (let i=0;i<3;i++) { const a=Math.random()*Math.PI*2; this.particles.push(new Particle(hitResult.target.x+hitResult.target.width/2,hitResult.target.y+hitResult.target.height/2,Math.cos(a)*40,Math.sin(a)*40-20,'#aaffaa',200,2)); }
                Sound.playHit();
                if (!hitResult.target.alive) { Sound.playMonsterDie(); this.onMonsterDefeated(hitResult.target); }
            }
            // 被ダメージ
            for (const m of this.monsters) {
                if (!m.alive || m.atkPhase !== 'strike') continue;
                const dx = (m.x+m.width/2)-(comp.x+14), dy = (m.y+m.height/2)-(comp.y+14);
                if (Math.sqrt(dx*dx+dy*dy) < m.attackRange+20) {
                    comp.takeDamage(Math.floor(m.attackDamage*0.5));
                    if (!comp.alive) this.damageNumbers.push(new DamageNumber(comp.x,comp.y-20,0,'#ff4444',`${comp.name}が倒れた...`));
                }
            }
        }
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
        // 生態系更新
        for (const m of this.monsters) if (m.alive) m.updateEcosystem(dt, this.monsters, this);
        // 群れ行動
        this.updatePacks();
        // 昼夜サイクル
        this.gameTime += dt;
        this.isNight = (this.gameTime % 60) > 30;

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

        // 立ち止まりペナルティ（1.5秒以上）
        if (this.player.stationaryTimer > 1500) {
            this.player.hp = Math.max(0, this.player.hp - 20);
            this.player.stationaryTimer = 0;
            this.damageNumbers.push(new DamageNumber(this.player.x+this.player.width/2, this.player.y-20, 20, '#ff4444', 'GROUND BREAK!'));
            this.shakeTimer = 100; this.shakeIntensity = 5;
            Sound.playDamage();
        }
        if (this.player.hp<=0) {
            if (this.rogueActive) { this.rogueGameOver(); return; }
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
            case 'skillTree':
                if (this._returnToLobby) this.drawLobby(ctx); else this.drawField(ctx);
                this.drawSkillTree(ctx); break;
            case 'party':
                if (this._returnToLobby) this.drawLobby(ctx); else this.drawField(ctx);
                this.drawPartyScreen(ctx); break;
            case 'rogueCard': this.drawField(ctx); this.drawRogueCardSelect(ctx); break;
            case 'rogueOver': this.drawField(ctx); this.drawRogueOver(ctx); break;
            case 'bossIntro': this.drawBossIntro(ctx); break;
            case 'gameover': this.drawField(ctx); this.drawGameOver(ctx); break;
            case 'result': this.drawField(ctx); this.drawQuestComplete(ctx); break;
        }
        // ガチャ演出オーバーレイ
        if (this.gachaActive && this.gachaResult) {
            ctx.save(); ctx.globalAlpha = 1;
            const gt = 3000 - this.gachaTimer;
            const W2 = this.W, H2 = this.H;
            // 暗転
            ctx.fillStyle = `rgba(0,0,0,${Math.min(0.85, gt/500)})`;
            ctx.fillRect(0, 0, W2, H2);
            if (gt < 500) {
                // ドキドキ
            } else if (gt < 1500) {
                // ???表示
                ctx.fillStyle = '#fff'; ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center';
                const pulse = 1 + Math.sin(gt*0.01)*0.1;
                ctx.save(); ctx.translate(W2/2, H2/2-20); ctx.scale(pulse, pulse);
                ctx.fillText('???', 0, 0); ctx.restore();
            } else if (gt < 2000) {
                // 光って割れる
                const p = (gt-1500)/500;
                ctx.fillStyle = `rgba(255,255,200,${0.5*(1-p)})`;
                ctx.beginPath(); ctx.arc(W2/2, H2/2, p*200, 0, Math.PI*2); ctx.fill();
                // モンスターシルエット→色つき
                ctx.globalAlpha = p;
                ctx.fillStyle = this.gachaResult.color;
                ctx.beginPath(); ctx.arc(W2/2, H2/2, 40, 0, Math.PI*2); ctx.fill();
            } else {
                // 結果表示
                const a = Math.min(1, (gt-2000)/300);
                ctx.globalAlpha = a;
                // 枠
                ctx.strokeStyle = this.gachaFrameColor; ctx.lineWidth = 4;
                roundRect(ctx, W2/2-120, H2/2-80, 240, 160, 12); ctx.stroke();
                // モンスター
                ctx.fillStyle = this.gachaResult.color;
                ctx.beginPath(); ctx.arc(W2/2, H2/2-20, 35, 0, Math.PI*2); ctx.fill();
                // テキスト
                ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
                ctx.fillText(`${this.gachaResult.name}`, W2/2, H2/2+40);
                ctx.fillStyle = '#c8a800'; ctx.font = 'bold 14px monospace';
                ctx.fillText('が仲間になった!', W2/2, H2/2+62);
            }
            ctx.restore();
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
        // 全パーティメンバー描画
        for (const comp of this.activeCompanions) {
            if (comp.alive) { ctx.save(); comp.draw(ctx); ctx.restore(); }
        }
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
            ctx.fillText(`LEVEL UP! Lv${this.player.level}`, this.W/2, 200);
            ctx.restore();
        }
        // SPヒント
        if (this.skillPointHintTimer > 0 && this.levelUpTimer <= 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, this.skillPointHintTimer / 500);
            ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
            ctx.fillText('スキルポイントを獲得！PキーでSkill Treeを開こう', this.W/2, 220);
            ctx.restore();
        }
        // 昼夜サイクル描画
        if (this.isNight) {
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,30,0.25)';
            ctx.fillRect(0, 0, this.W, this.H);
            // 月
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#dddde8';
            ctx.beginPath(); ctx.arc(this.W-80, 50, 18, 0, Math.PI*2); ctx.fill();
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

        // スタミナバー
        const stBarY = expBarY + 20;
        roundRect(ctx, pBarX, stBarY, pBarW*0.6, 6, 2);
        ctx.fillStyle='#222'; ctx.fill();
        ctx.save(); roundRect(ctx, pBarX, stBarY, pBarW*0.6, 6, 2); ctx.clip();
        ctx.fillStyle='#44cc44'; ctx.fillRect(pBarX, stBarY, pBarW*0.6*(this.player.stamina/this.player.maxStamina), 6);
        ctx.restore();
        // 必殺技ゲージ
        const ultBarY = stBarY + 12;
        roundRect(ctx, pBarX, ultBarY, pBarW*0.6, 8, 3);
        ctx.fillStyle='#1a1a00'; ctx.fill();
        ctx.save(); roundRect(ctx, pBarX, ultBarY, pBarW*0.6, 8, 3); ctx.clip();
        ctx.fillStyle = this.player.ultimateGauge >= 100 ? '#ffcc00' : '#886600';
        ctx.fillRect(pBarX, ultBarY, pBarW*0.6*(this.player.ultimateGauge/100), 8);
        ctx.restore();
        roundRect(ctx, pBarX, ultBarY, pBarW*0.6, 8, 3); ctx.strokeStyle='#555'; ctx.lineWidth=1; ctx.stroke();
        if (this.player.ultimateGauge >= 100) {
            ctx.fillStyle='#ffcc00'; ctx.font='bold 10px monospace'; ctx.textAlign='left';
            ctx.fillText('R: ULTIMATE READY!', pBarX + pBarW*0.6+5, ultBarY+8);
        }
        // 必殺技名表示
        if (this.ultimateDisplayTimer > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, this.ultimateDisplayTimer/300);
            ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
            ctx.fillText(this.ultimateWeaponName, this.W/2, this.H/2-30);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace';
            ctx.fillText(this.ultimateName, this.W/2, this.H/2+5);
            ctx.restore();
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
        // ローグライクフロア表示
        if (this.rogueActive) {
            ctx.save();
            ctx.fillStyle='#c8a800'; ctx.font='bold 16px monospace'; ctx.textAlign='center';
            ctx.fillText(`Floor ${this.rogueFloor}  |  Enemies: ${this.rogueEnemiesLeft}`, this.W/2, 18);
            if (this.rogueFloorClearTimer > 0) {
                ctx.globalAlpha = Math.min(1, this.rogueFloorClearTimer/500);
                ctx.fillStyle='#44ff44'; ctx.font='bold 28px monospace';
                ctx.fillText('FLOOR CLEAR!', this.W/2, this.H/2 - 30);
            }
            ctx.restore();
        }
        // クエストタイマー（上部中央）
        if (!this.rogueActive && (this.timeAttackMode || this.questTimeLimit > 0)) {
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
        ctx.fillText('WASD:Move  Z:Atk  X:Block  Shift:Dodge  R:Ult  Q:Swap  B:Party  P:Skills',this.W/2,this.H-10);
        // パーティメンバーステータスパネル（左下）
        let cpIdx = 0;
        for (const c of this.activeCompanions) {
            if (!c.alive) { cpIdx++; continue; }
            const cpX = 15, cpY = this.H - 70 - cpIdx*60;
            ctx.fillStyle = 'rgba(10,10,20,0.7)';
            roundRect(ctx, cpX, cpY, 160, 52, 6); ctx.fill();
            ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
            roundRect(ctx, cpX, cpY, 160, 52, 6); ctx.stroke();
            ctx.fillStyle = c.color;
            ctx.beginPath(); ctx.arc(cpX+16, cpY+16, 9, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
            ctx.fillText(`Lv.${c.level} ${c.name}`, cpX+30, cpY+14);
            const hpR = c.hp/c.maxHp;
            ctx.fillStyle = '#222'; roundRect(ctx, cpX+30, cpY+20, 118, 7, 2); ctx.fill();
            ctx.save(); roundRect(ctx, cpX+30, cpY+20, 118, 7, 2); ctx.clip();
            ctx.fillStyle = hpR>0.3?'#44cc44':'#cc4444'; ctx.fillRect(cpX+30, cpY+20, 118*hpR, 7);
            ctx.restore();
            ctx.fillStyle = '#888'; ctx.font = '7px monospace';
            ctx.fillText(`HP:${c.hp}/${c.maxHp} ATK:${c.atk}`, cpX+30, cpY+40);
            cpIdx++;
        }
        // パーティボーナス表示
        if (this.partyBonus) {
            ctx.fillStyle = '#c8a800'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
            ctx.fillText(`${this.partyBonus.name}: ${this.partyBonus.desc}`, 15, this.H - 70 - cpIdx*60 - 5);
        }
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
    // ========================================
    // スキルツリー画面
    // ========================================
    drawSkillTree(ctx) {
        try { this._drawSkillTreeInner(ctx); } catch(e) { console.error('SkillTree error:', e); ctx.fillStyle='#f00';ctx.fillText('Error: '+e.message,50,50); }
    }
    _drawSkillTreeInner(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        const W = this.W, H = this.H;
        // 金属背景（インベントリと同じ）
        ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
        for (let x=0;x<W;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
        for (let y=0;y<H;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
        ctx.strokeStyle='#c8a800';ctx.lineWidth=3;ctx.strokeRect(5,5,W-10,H-10);
        for (const [rx,ry] of [[10,10],[W-10,10],[10,H-10],[W-10,H-10]]){
            ctx.fillStyle='#c8a800';ctx.beginPath();ctx.arc(rx,ry,5,0,Math.PI*2);ctx.fill();
        }
        // タイトル
        const tg=ctx.createLinearGradient(0,18,0,52);
        tg.addColorStop(0,'#3a3a44');tg.addColorStop(0.5,'#4a4a55');tg.addColorStop(1,'#2a2a33');
        ctx.fillStyle=tg;ctx.fillRect(10,18,W-20,36);
        ctx.fillStyle='#c8a800';ctx.font='bold 22px monospace';ctx.textAlign='center';
        ctx.fillText('SKILL TREE',W/2,43);
        // スキルポイント
        const sp = this.player ? this.player.skillPoints : 0;
        ctx.fillStyle=sp>0?'#ffcc00':'#888';ctx.font='bold 14px monospace';ctx.textAlign='right';
        ctx.fillText(`SP: ${sp}`,W-20,43);

        const branches = ['common','swordsman','tank','archer','mage'];
        const branchNames = ['Common','Swordsman','Tank','Archer','Mage'];
        const branchColors = ['#c8a800','#cc4444','#4488cc','#44aa44','#aa44cc'];
        const colW = Math.floor((W-40)/5);
        const startY = 70;
        const nodeR = 18;
        const nodeGap = 65;

        for (let bi=0; bi<branches.length; bi++) {
            const bKey = branches[bi];
            const bColor = branchColors[bi];
            const cx = 20 + bi*colW + colW/2;
            // 系統名
            ctx.fillStyle = bColor; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
            ctx.fillText(branchNames[bi], cx, startY);
            const list = bKey === 'common' ? SKILL_TREE.common : SKILL_TREE[bKey].skills;
            for (let si=0; si<list.length; si++) {
                const skill = list[si];
                const ny = startY + 20 + si * nodeGap;
                const has = this.player && this.player.treeSkills.has(skill.id);
                const canLearn = !has && sp > 0 && (skill.requires.length === 0 || skill.requires.every(r => this.player && this.player.treeSkills.has(r)));
                const isSel = this.skillTreeCursor.branch === bKey && this.skillTreeCursor.idx === si;
                // 接続線
                if (si > 0) {
                    const prevHas = this.player && this.player.treeSkills.has(list[si-1].id);
                    ctx.strokeStyle = prevHas ? bColor : '#333'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(cx, ny-nodeGap+nodeR+5); ctx.lineTo(cx, ny-nodeR-5); ctx.stroke();
                }
                // ノード（六角形）
                ctx.save();
                ctx.beginPath();
                for (let h=0;h<6;h++){const a=h*Math.PI/3-Math.PI/2;ctx.lineTo(cx+Math.cos(a)*nodeR,ny+Math.sin(a)*nodeR);}
                ctx.closePath();
                if (has) { ctx.fillStyle = bColor; }
                else if (canLearn) { ctx.fillStyle = '#3a3a44'; }
                else { ctx.fillStyle = '#222233'; }
                ctx.fill();
                ctx.strokeStyle = isSel ? '#fff' : (has ? bColor : '#444');
                ctx.lineWidth = isSel ? 3 : 1;
                ctx.stroke();
                // 選択時光
                if (isSel && canLearn) {
                    ctx.globalAlpha = 0.15 + Math.sin(Date.now()*0.005)*0.1;
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    for (let h=0;h<6;h++){const a=h*Math.PI/3-Math.PI/2;ctx.lineTo(cx+Math.cos(a)*(nodeR+3),ny+Math.sin(a)*(nodeR+3));}
                    ctx.closePath(); ctx.fill();
                    ctx.globalAlpha = 1;
                }
                ctx.restore();
                // スキル名
                ctx.fillStyle = has ? '#fff' : (canLearn ? '#ccc' : '#555');
                ctx.font = '9px monospace'; ctx.textAlign = 'center';
                ctx.fillText(skill.name, cx, ny+nodeR+14);
            }
        }

        // 右パネル: 選択中スキル詳細
        const c = this.skillTreeCursor;
        const selList = c.branch === 'common' ? SKILL_TREE.common : SKILL_TREE[c.branch].skills;
        const selSkill = selList[c.idx];
        if (selSkill) {
            const dpX = W - 220, dpY = startY + 20, dpW = 200, dpH = 200;
            ctx.fillStyle = 'rgba(26,26,34,0.95)';
            roundRect(ctx, dpX, dpY, dpW, dpH, 8); ctx.fill();
            ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 1;
            roundRect(ctx, dpX, dpY, dpW, dpH, 8); ctx.stroke();
            const dcx = dpX + dpW/2;
            let dy = dpY + 25;
            ctx.fillStyle = '#c8a800'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
            ctx.fillText(selSkill.name, dcx, dy); dy += 25;
            ctx.fillStyle = '#bbb'; ctx.font = '11px monospace';
            // ワードラップ
            const words = selSkill.desc.split('');
            let line = '';
            for (const ch of words) {
                if (ctx.measureText(line+ch).width > dpW-20) { ctx.fillText(line, dcx, dy); dy+=16; line=''; }
                line += ch;
            }
            if (line) { ctx.fillText(line, dcx, dy); dy+=20; }
            dy += 10;
            const has = this.player && this.player.treeSkills.has(selSkill.id);
            const canLearn = !has && sp > 0 && (selSkill.requires.length === 0 || selSkill.requires.every(r => this.player && this.player.treeSkills.has(r)));
            if (has) {
                ctx.fillStyle = '#44cc44'; ctx.font = 'bold 12px monospace';
                ctx.fillText('LEARNED', dcx, dy);
            } else if (canLearn) {
                ctx.fillStyle = '#c8a800'; ctx.font = 'bold 12px monospace';
                ctx.fillText('[Z] LEARN (1 SP)', dcx, dy);
            } else {
                ctx.fillStyle = '#666'; ctx.font = '11px monospace';
                if (selSkill.requires.length > 0) ctx.fillText(`Requires: ${selSkill.requires.join(', ')}`, dcx, dy);
                else ctx.fillText('Need SP', dcx, dy);
            }
        }

        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
        ctx.fillText('A/D:Branch  W/S:Select  Z:Learn  P:Close', W/2, H-18);
        ctx.restore();
    }

    // ========================================
    // パーティ画面
    // ========================================
    drawPartyScreen(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        const W = this.W, H = this.H;
        // 金属背景
        ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
        for (let x=0;x<W;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
        for (let y=0;y<H;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
        ctx.strokeStyle='#c8a800';ctx.lineWidth=3;ctx.strokeRect(5,5,W-10,H-10);
        // タイトル
        const tg=ctx.createLinearGradient(0,18,0,52);
        tg.addColorStop(0,'#3a3a44');tg.addColorStop(0.5,'#4a4a55');tg.addColorStop(1,'#2a2a33');
        ctx.fillStyle=tg;ctx.fillRect(10,18,W-20,36);
        ctx.fillStyle='#c8a800';ctx.font='bold 22px monospace';ctx.textAlign='center';
        ctx.fillText('PARTY',W/2,43);

        const leftW = Math.floor(W*0.45), rightX = leftW+20;

        // === 左側: パーティスロット ===
        ctx.fillStyle='#c8a800';ctx.font='bold 14px monospace';ctx.textAlign='left';
        ctx.fillText('Party Slots', 25, 75);
        for (let i = 0; i < 2; i++) {
            const sy = 90 + i*130;
            const c = this.partySlots[i];
            const sel = this.partyTab===0 && this.partyCursor===i;
            ctx.fillStyle = sel ? 'rgba(200,168,0,0.12)' : '#111122';
            roundRect(ctx, 20, sy, leftW-30, 115, 8); ctx.fill();
            ctx.strokeStyle = sel ? '#c8a800' : '#333'; ctx.lineWidth = sel?2:1;
            roundRect(ctx, 20, sy, leftW-30, 115, 8); ctx.stroke();
            if (c) {
                // アイコン
                ctx.fillStyle = c.color;
                ctx.beginPath(); ctx.arc(50, sy+35, 18, 0, Math.PI*2); ctx.fill();
                // 名前・ステータス
                ctx.fillStyle='#fff';ctx.font='bold 13px monospace';ctx.textAlign='left';
                ctx.fillText(`Lv.${c.level} ${c.name}`, 75, sy+25);
                ctx.fillStyle='#aaa';ctx.font='11px monospace';
                ctx.fillText(`HP:${c.maxHp}  ATK:${c.atk}`, 75, sy+42);
                ctx.fillText(`Kills:${c.totalKills}`, 75, sy+57);
                // スキル
                const skills = Companion.getSkills(c.type);
                let skY = sy+72;
                for (const s of skills) {
                    const has = c.level >= s.level;
                    ctx.fillStyle = has ? '#c8a800' : '#444'; ctx.font = '9px monospace';
                    ctx.fillText(`${has?'\u2605':'\u2606'} ${s.name}(Lv${s.level})`, 35, skY);
                    skY += 13;
                }
                // 装備表示
                ctx.fillStyle='#777';ctx.font='9px monospace';
                ctx.fillText(c.equippedWeapon?`W:${c.equippedWeapon.name}`:'W: ---', 200, sy+25);
                ctx.fillText(c.equippedArmor?`A:${c.equippedArmor.name}`:'A: ---', 200, sy+38);
                // 外すボタン
                if (sel) {
                    ctx.fillStyle='#662222';roundRect(ctx,leftW-100,sy+85,60,22,3);ctx.fill();
                    ctx.fillStyle='#ff8888';ctx.font='bold 10px monospace';ctx.textAlign='center';
                    ctx.fillText('REMOVE',leftW-70,sy+100);ctx.textAlign='left';
                }
            } else {
                ctx.fillStyle='#555';ctx.font='14px monospace';ctx.textAlign='center';
                ctx.fillText('+ Add Companion',leftW/2,sy+55);ctx.textAlign='left';
            }
        }
        // パーティボーナス表示
        if (this.partyBonus) {
            ctx.fillStyle='#c8a800';ctx.font='bold 12px monospace';ctx.textAlign='left';
            ctx.fillText(`Bonus: ${this.partyBonus.name} - ${this.partyBonus.desc}`, 25, 360);
        }

        // === 右側: 所持仲間一覧 ===
        ctx.fillStyle='#c8a800';ctx.font='bold 14px monospace';ctx.textAlign='left';
        ctx.fillText('Companions', rightX, 75);
        const comps = this.inventory.companions;
        if (comps.length===0) {
            ctx.fillStyle='#555';ctx.font='12px monospace';
            ctx.fillText('No companions yet', rightX+10, 110);
        } else {
            let cy = 90;
            for (let i=0;i<comps.length;i++) {
                const c = comps[i];
                const sel = this.partyTab===1 && this.partyCursor===i;
                const inParty = this.partySlots.includes(c);
                ctx.fillStyle = sel ? 'rgba(200,168,0,0.12)' : '#111122';
                roundRect(ctx, rightX, cy, W-rightX-20, 40, 6); ctx.fill();
                ctx.strokeStyle = inParty ? '#c8a800' : (sel?'#c8a800':'#333');
                ctx.lineWidth = sel||inParty?2:1;
                roundRect(ctx, rightX, cy, W-rightX-20, 40, 6); ctx.stroke();
                ctx.fillStyle = c.color;
                ctx.beginPath(); ctx.arc(rightX+18, cy+20, 10, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = sel?'#fff':'#bbb';ctx.font='bold 11px monospace';ctx.textAlign='left';
                ctx.fillText(`Lv.${c.level} ${c.name}`, rightX+35, cy+16);
                ctx.fillStyle='#888';ctx.font='9px monospace';
                ctx.fillText(`HP:${c.maxHp} ATK:${c.atk} Kills:${c.totalKills}`, rightX+35, cy+30);
                if (inParty) {
                    ctx.fillStyle='#c8a800';ctx.textAlign='right';ctx.font='9px monospace';
                    ctx.fillText('[IN PARTY]',W-25,cy+20);ctx.textAlign='left';
                }
                cy += 46;
            }
        }

        ctx.fillStyle='rgba(255,255,255,0.35)';ctx.font='12px monospace';ctx.textAlign='center';
        ctx.fillText('A/D:Tab  W/S:Select  Z:Add/Remove  B:Close',W/2,H-18);
        ctx.restore();
    }

    // ========================================
    // ローグライクカード選択画面
    // ========================================
    drawRogueCardSelect(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, this.W, this.H);
        ctx.fillStyle = '#c8a800'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
        ctx.fillText(`Floor ${this.rogueFloor} Clear!`, this.W/2, 80);
        ctx.fillStyle = '#fff'; ctx.font = '16px monospace';
        ctx.fillText('Choose an upgrade', this.W/2, 110);
        const cardW = 280, cardH = 100;
        for (let i = 0; i < this.rogueCardChoices.length; i++) {
            const card = this.rogueCardChoices[i];
            const sel = i === this.rogueCardCursor;
            const cx = this.W/2 - cardW/2, cy = 140 + i * (cardH + 15);
            ctx.fillStyle = sel ? 'rgba(200,168,0,0.15)' : '#111122';
            roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.fill();
            ctx.strokeStyle = sel ? '#c8a800' : '#444'; ctx.lineWidth = sel ? 2 : 1;
            roundRect(ctx, cx, cy, cardW, cardH, 8); ctx.stroke();
            if (sel) { ctx.fillStyle = '#c8a800'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left'; ctx.fillText('>', cx+10, cy+40); }
            ctx.fillStyle = sel ? '#c8a800' : '#ccc'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left';
            ctx.fillText(card.name, cx+30, cy+35);
            ctx.fillStyle = '#999'; ctx.font = '13px monospace';
            ctx.fillText(card.desc, cx+30, cy+60);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '13px monospace'; ctx.textAlign = 'center';
        ctx.fillText('W/S: Select  Z: Choose', this.W/2, this.H-30);
        ctx.restore();
    }

    // ========================================
    // ローグライクゲームオーバー画面
    // ========================================
    drawRogueOver(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, this.W, this.H);
        const cx = this.W/2, cy = this.H/2;
        ctx.fillStyle = '#ff4444'; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', cx, cy-80);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace';
        ctx.fillText(`Reached Floor ${this.rogueFloor}`, cx, cy-40);
        ctx.fillStyle = '#aaa'; ctx.font = '16px monospace';
        ctx.fillText(`Total Kills: ${this.rogueKills}`, cx, cy-10);
        ctx.fillText(`Upgrades: ${this.rogueCards.length}`, cx, cy+15);
        ctx.fillStyle = '#c8a800'; ctx.font = 'bold 16px monospace';
        ctx.fillText(`BEST: Floor ${this.rogueBestFloor}`, cx, cy+50);
        // 取得カード一覧
        if (this.rogueCards.length > 0) {
            ctx.fillStyle = '#888'; ctx.font = '12px monospace';
            let cy2 = cy + 80;
            for (const c of this.rogueCards) {
                ctx.fillText(c.name, cx, cy2); cy2 += 18;
            }
        }
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '16px monospace';
        ctx.fillText('R: Return to Lobby', cx, this.H-40);
        ctx.restore();
    }

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
        // 縄張り争い赤点滅
        for (const m of this.monsters) {
            if (!m.alive || m.ecoState !== 'territory') continue;
            if (Math.sin(Date.now()*0.01) > 0) {
                ctx.fillStyle = '#ff4444';
                const mx2 = mmX + (m.x+m.width/2)*scaleX;
                const my2 = mmY + (m.y+m.height/2)*scaleY;
                ctx.beginPath(); ctx.arc(mx2, my2, 4, 0, Math.PI*2); ctx.fill();
            }
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
        ctx.fillText(`W/S:Select  Z:Start  T:TimeAtk${taLabel}  M:Roguelike  I:Inv  C:Craft  P:Skills`, this.W/2+100, this.H-8);
        // ローグライクハイスコア表示
        if (this.rogueBestFloor > 0) {
            ctx.fillStyle = '#c8a800'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
            ctx.fillText(`Roguelike Best: Floor ${this.rogueBestFloor}`, this.W-15, this.H-22);
        }
        ctx.restore();
    }
    getDifficultyStars(l) { let s='';for(let i=0;i<3;i++)s+=i<l?'\u2605':'\u2606';return s; }

    drawInventory(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        const W = this.W, H = this.H;

        // === 背景: 濃いグレー格子 ===
        ctx.fillStyle = '#1a1a22';
        ctx.fillRect(0, 0, W, H);
        // 格子パターン
        ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
        for (let gx = 0; gx < W; gx += 20) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
        for (let gy = 0; gy < H; gy += 20) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }

        // === フレーム: 金ボーダー ===
        ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, W-16, H-16);
        // リベット
        const rivetR = 5;
        for (const [rx,ry] of [[15,15],[W-15,15],[15,H-15],[W-15,H-15]]) {
            ctx.fillStyle = '#aa9000'; ctx.beginPath(); ctx.arc(rx,ry,rivetR,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ddc840'; ctx.beginPath(); ctx.arc(rx-1,ry-1,rivetR*0.5,0,Math.PI*2); ctx.fill();
        }

        // === タイトル帯 ===
        const titleGrad = ctx.createLinearGradient(0, 18, 0, 52);
        titleGrad.addColorStop(0, '#3a3a44'); titleGrad.addColorStop(0.5, '#4a4a55'); titleGrad.addColorStop(1, '#2a2a33');
        ctx.fillStyle = titleGrad;
        ctx.fillRect(15, 18, W-30, 36);
        ctx.fillStyle = '#c8a800'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
        ctx.fillText('INVENTORY', W/2, 43);

        // === タブ ===
        const tabNames = ['Weapons', 'Armor', 'Materials', 'Items', 'Companions'];
        const tabW = Math.min(120, (W-80)/5);
        const tabStartX = 20;
        const tabY = 62;
        for (let t = 0; t < 4; t++) {
            const tx = tabStartX + t * (tabW + 6);
            const sel = t === this.invTab;
            ctx.fillStyle = sel ? '#2a2a38' : '#1a1a22';
            roundRect(ctx, tx, tabY, tabW, 26, 4); ctx.fill();
            ctx.strokeStyle = sel ? '#c8a800' : '#444'; ctx.lineWidth = sel ? 2 : 1;
            roundRect(ctx, tx, tabY, tabW, 26, 4); ctx.stroke();
            ctx.fillStyle = sel ? '#c8a800' : '#666'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
            ctx.fillText(tabNames[t], tx + tabW/2, tabY + 18);
            // 選択中アンダーライン
            if (sel) {
                ctx.fillStyle = '#c8a800';
                ctx.fillRect(tx + 10, tabY + 24, tabW - 20, 2);
            }
        }

        const contentY = 100;
        const contentH = H - contentY - 40;
        const detailX = W * 0.62; // 右パネル開始

        // === 左側: リスト/グリッド ===
        if (this.invTab === 0) {
            // 武器タブ
            const weapons = this.inventory.weapons;
            this.invCursor = Math.min(this.invCursor, weapons.length - 1);
            let wy = contentY;
            for (let i = 0; i < weapons.length; i++) {
                const w = weapons[i];
                const sel = i === this.invCursor;
                const eq = this.player && w === this.player.weapon;
                // 行背景
                ctx.fillStyle = sel ? 'rgba(200,168,0,0.12)' : (i%2===0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0)');
                ctx.fillRect(20, wy, detailX - 30, 32);
                if (sel) { ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 1; ctx.strokeRect(20, wy, detailX - 30, 32); }
                // 装備マーク
                if (eq) { ctx.fillStyle = '#c8a800'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText('\u25b6', 26, wy + 22); }
                // 武器アイコン（色分け）
                const iconColors = { combo3:'#aaaaaa', charge:'#cc8844', bow:'#88cc44', frost:'#66bbee', hammer:'#aa6633', poison:'#66aa66' };
                ctx.fillStyle = iconColors[w.style] || '#888';
                ctx.fillRect(48, wy + 6, 18, 18);
                ctx.fillStyle = '#222'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
                ctx.fillText(w.type==='ranged'?'B':'S', 57, wy + 19);
                // 名前
                ctx.fillStyle = eq ? '#c8a800' : (sel ? '#fff' : '#bbb');
                ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
                ctx.fillText(w.getDisplayName(), 74, wy + 15);
                // 強化★
                let stars = '';
                for (let s = 0; s < 3; s++) stars += s < w.upgradeLevel ? '\u2605' : '\u2606';
                ctx.fillStyle = '#c8a800'; ctx.font = '10px monospace';
                ctx.fillText(stars, 74, wy + 28);
                // DMG
                ctx.fillStyle = '#888'; ctx.textAlign = 'right';
                ctx.fillText(`DMG:${w.damage}`, detailX - 15, wy + 20);
                ctx.textAlign = 'left';
                wy += 34;
            }
            // 右パネル: 選択武器詳細
            const selW = weapons[this.invCursor];
            if (selW) this._drawInvDetail(ctx, detailX, contentY, W - detailX - 15, contentH, 'weapon', selW);
        } else if (this.invTab === 1) {
            // 防具タブ
            const armors = this.inventory.armors;
            this.invCursor = Math.min(this.invCursor, Math.max(0, armors.length - 1));
            if (armors.length === 0) {
                ctx.fillStyle = '#555'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
                ctx.fillText('No armor crafted yet', W/3, contentY + 40);
            } else {
                let ay = contentY;
                for (let i = 0; i < armors.length; i++) {
                    const a = armors[i];
                    const sel = i === this.invCursor;
                    const eq = this.player && a === this.player.armor;
                    ctx.fillStyle = sel ? 'rgba(200,168,0,0.12)' : 'rgba(0,0,0,0)';
                    ctx.fillRect(20, ay, detailX - 30, 32);
                    if (sel) { ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 1; ctx.strokeRect(20, ay, detailX - 30, 32); }
                    if (eq) { ctx.fillStyle = '#c8a800'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText('\u25b6', 26, ay + 22); }
                    ctx.fillStyle = '#6688cc'; ctx.fillRect(48, ay + 6, 18, 18);
                    ctx.fillStyle = eq ? '#c8a800' : (sel ? '#fff' : '#bbb');
                    ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
                    ctx.fillText(a.getDisplayName(), 74, ay + 20);
                    ctx.fillStyle = '#888'; ctx.textAlign = 'right';
                    ctx.fillText(`DEF x${a.damageMultiplier}`, detailX - 15, ay + 20);
                    ctx.textAlign = 'left';
                    ay += 34;
                }
            }
        } else if (this.invTab === 2) {
            // 素材タブ: 5列グリッド
            const matEntries = Object.entries(MATERIALS);
            const cols = 5, cellW = 70, cellH = 70, pad = 8;
            const gridX = 25;
            this.invCursor = Math.min(this.invCursor, matEntries.length - 1);
            for (let i = 0; i < matEntries.length; i++) {
                const [id, mat] = matEntries[i];
                const c = this.inventory.getMaterialCount(id);
                const col = i % cols, row = Math.floor(i / cols);
                const cx = gridX + col * (cellW + pad);
                const cy = contentY + row * (cellH + pad);
                const sel = i === this.invCursor;
                // セル背景
                ctx.fillStyle = '#222233';
                roundRect(ctx, cx, cy, cellW, cellH, 4); ctx.fill();
                ctx.strokeStyle = sel ? '#c8a800' : '#333344'; ctx.lineWidth = sel ? 2 : 1;
                roundRect(ctx, cx, cy, cellW, cellH, 4); ctx.stroke();
                // 選択時光エフェクト
                if (sel) {
                    ctx.fillStyle = 'rgba(200,168,0,0.08)';
                    roundRect(ctx, cx, cy, cellW, cellH, 4); ctx.fill();
                }
                // アイコン描画
                const icx = cx + cellW/2, icy = cy + cellH/2 - 5;
                this._drawMatIcon(ctx, id, icx, icy, 14);
                // 個数バッジ
                if (c > 0) {
                    ctx.fillStyle = '#222'; roundRect(ctx, cx+cellW-22, cy+cellH-18, 20, 15, 3); ctx.fill();
                    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
                    ctx.fillText(c, cx+cellW-12, cy+cellH-7);
                }
            }
            // 右パネル: 選択素材詳細
            if (matEntries[this.invCursor]) {
                const [selId, selMat] = matEntries[this.invCursor];
                this._drawInvDetail(ctx, detailX, contentY, W - detailX - 15, contentH, 'material', selMat);
            }
        } else if (this.invTab === 4) {
            // 仲間タブ
            const comps = this.inventory.companions;
            this.invCursor = Math.min(this.invCursor, Math.max(0, comps.length-1));
            if (comps.length === 0) {
                ctx.fillStyle = '#555'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
                ctx.fillText('No companions yet', W/3, contentY+40);
                ctx.fillStyle = '#666'; ctx.font = '11px monospace';
                ctx.fillText('Defeat monsters for fragments, then craft boxes!', W/3, contentY+65);
            } else {
                let cy = contentY;
                for (let i = 0; i < comps.length; i++) {
                    const c = comps[i];
                    const sel = i === this.invCursor;
                    const isActive = c === this.inventory.activeCompanion;
                    ctx.fillStyle = sel ? 'rgba(200,168,0,0.12)' : (i%2===0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0)');
                    ctx.fillRect(20, cy, detailX-30, 36);
                    if (sel) { ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 2; ctx.strokeRect(20, cy, detailX-30, 36); }
                    // アイコン
                    ctx.fillStyle = c.color;
                    ctx.beginPath(); ctx.arc(38, cy+18, 10, 0, Math.PI*2); ctx.fill();
                    // 出撃マーク
                    if (isActive) { ctx.fillStyle = '#c8a800'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.fillText('\u25b6', 52, cy+22); }
                    // 名前
                    ctx.fillStyle = isActive ? '#c8a800' : (sel ? '#fff' : '#aaa');
                    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
                    ctx.fillText(`Lv.${c.level} ${c.name}`, 66, cy+15);
                    // ステータス
                    ctx.fillStyle = '#888'; ctx.font = '10px monospace';
                    ctx.fillText(`HP:${c.maxHp} ATK:${c.atk}`, 66, cy+30);
                    // 状態
                    ctx.fillStyle = isActive ? '#44cc44' : '#666'; ctx.textAlign = 'right';
                    ctx.fillText(isActive ? '[ACTIVE]' : '[STANDBY]', detailX-15, cy+22);
                    ctx.textAlign = 'left';
                    cy += 40;
                }
                // 右パネル: 選択中仲間の詳細
                if (comps[this.invCursor]) {
                    const c = comps[this.invCursor];
                    const isActive = c === this.inventory.activeCompanion;
                    ctx.fillStyle = 'rgba(26,26,34,0.95)';
                    roundRect(ctx, detailX, contentY, W-detailX-15, H-contentY-40, 8); ctx.fill();
                    ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 1;
                    roundRect(ctx, detailX, contentY, W-detailX-15, H-contentY-40, 8); ctx.stroke();
                    const dcx = detailX + (W-detailX-15)/2;
                    let dy = contentY + 35;
                    // 大アイコン
                    ctx.fillStyle = c.color;
                    ctx.beginPath(); ctx.arc(dcx, dy, 25, 0, Math.PI*2); ctx.fill();
                    dy += 40;
                    ctx.fillStyle = '#c8a800'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
                    ctx.fillText(`Lv.${c.level} ${c.name}`, dcx, dy); dy += 22;
                    ctx.fillStyle = '#bbb'; ctx.font = '12px monospace';
                    ctx.fillText(`HP: ${c.maxHp}  ATK: ${c.atk}`, dcx, dy); dy += 20;
                    ctx.fillText(`EXP: ${c.exp}/${c.expToNext}`, dcx, dy); dy += 30;
                    // 出撃/待機ボタン
                    const bx = dcx-50, bw = 100, bh = 28;
                    ctx.fillStyle = '#886600'; roundRect(ctx, bx, dy, bw, bh, 4); ctx.fill();
                    ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 1; roundRect(ctx, bx, dy, bw, bh, 4); ctx.stroke();
                    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace';
                    ctx.fillText(isActive ? 'RECALL' : 'DEPLOY', dcx, dy+18);
                }
            }
        } else {
            // アイテムタブ
            ctx.fillStyle = '#555'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
            ctx.fillText('No items yet', W/3, contentY + 40);
        }

        // 操作ガイド
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
        ctx.fillText('A/D:Tab  W/S:Select  Z:Action  I:Close', W/2, H - 18);
        ctx.restore();
    }

    /** 素材アイコン描画ヘルパー */
    _drawMatIcon(ctx, id, cx, cy, r) {
        const colors = { drakeScale:'#44cc88', drakeFang:'#cccc44', drakeCore:'#cc44cc',
            iceFang:'#66ccee', iceCrystal:'#aaeeff', drakeHeadScale:'#55aa77',
            drakeTail:'#aa7744', elderScale:'#cc88ff' };
        ctx.fillStyle = colors[id] || '#888';
        if (id.includes('Scale') || id === 'elderScale') {
            // 六角形
            ctx.beginPath();
            for (let i=0;i<6;i++) { const a=Math.PI/6+i*Math.PI/3; ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); }
            ctx.closePath(); ctx.fill();
        } else if (id.includes('Fang')) {
            // 三角形（牙）
            ctx.beginPath(); ctx.moveTo(cx,cy-r); ctx.lineTo(cx-r*0.7,cy+r); ctx.lineTo(cx+r*0.7,cy+r); ctx.closePath(); ctx.fill();
        } else if (id === 'drakeCore') {
            // ひし形
            ctx.beginPath(); ctx.moveTo(cx,cy-r); ctx.lineTo(cx+r,cy); ctx.lineTo(cx,cy+r); ctx.lineTo(cx-r,cy); ctx.closePath(); ctx.fill();
        } else if (id === 'iceCrystal') {
            // 六角星
            ctx.beginPath();
            for (let i=0;i<6;i++) { const a=i*Math.PI/3-Math.PI/2; const r2=i%2===0?r:r*0.5;
                ctx.lineTo(cx+Math.cos(a)*r2, cy+Math.sin(a)*r2); }
            ctx.closePath(); ctx.fill();
        } else if (id === 'drakeTail') {
            // 曲線
            ctx.beginPath(); ctx.moveTo(cx-r,cy+r*0.5); ctx.quadraticCurveTo(cx,cy-r,cx+r,cy+r*0.5); ctx.lineWidth=3; ctx.strokeStyle=colors[id]; ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
        }
    }

    /** 右パネル詳細描画ヘルパー */
    _drawInvDetail(ctx, x, y, w, h, type, item) {
        // パネル背景
        ctx.fillStyle = 'rgba(30,30,40,0.9)';
        roundRect(ctx, x, y, w, h, 8); ctx.fill();
        ctx.strokeStyle = '#444'; ctx.lineWidth = 1;
        roundRect(ctx, x, y, w, h, 8); ctx.stroke();

        const cx = x + w/2;
        let dy = y + 30;

        if (type === 'weapon') {
            // 大きいアイコン
            const iconColors = { combo3:'#aaaaaa', charge:'#cc8844', bow:'#88cc44', frost:'#66bbee', hammer:'#aa6633', poison:'#66aa66' };
            ctx.fillStyle = iconColors[item.style] || '#888';
            ctx.fillRect(cx-20, dy-15, 40, 40);
            ctx.fillStyle = '#111'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
            ctx.fillText(item.type==='ranged'?'B':'S', cx, dy+12);
            dy += 40;
            // 名前
            ctx.fillStyle = '#c8a800'; ctx.font = 'bold 16px monospace';
            ctx.fillText(item.getDisplayName(), cx, dy);
            dy += 22;
            ctx.fillStyle = '#aaa'; ctx.font = '12px monospace';
            ctx.fillText(item.desc, cx, dy);
            dy += 25;
            // ステータス
            ctx.textAlign = 'left'; ctx.fillStyle = '#bbb'; ctx.font = '12px monospace';
            ctx.fillText(`Damage: ${item.damage}`, x+15, dy); dy+=18;
            ctx.fillText(`Range: ${item.range}`, x+15, dy); dy+=18;
            ctx.fillText(`Cooldown: ${item.cooldown}ms`, x+15, dy); dy+=18;
            ctx.fillText(`Type: ${item.type}`, x+15, dy); dy+=18;
            ctx.fillText(`Style: ${item.style}`, x+15, dy); dy+=25;
            // 必殺技名
            const ultNames = { combo3:'乱舞斬り', charge:'大地割り', bow:'矢の雨', frost:'吹雪', hammer:'天地崩壊', poison:'毒霧' };
            ctx.fillStyle = '#c8a800'; ctx.font = 'bold 12px monospace';
            ctx.fillText(`Ultimate: ${ultNames[item.style]||'-'}`, x+15, dy);
        } else if (type === 'material') {
            // 大きいアイコン
            this._drawMatIcon(ctx, item.id, cx, dy+5, 25);
            dy += 45;
            ctx.fillStyle = item.color; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
            ctx.fillText(item.name, cx, dy); dy += 20;
            ctx.fillStyle = '#999'; ctx.font = '12px monospace';
            ctx.fillText(item.description, cx, dy); dy += 25;
            ctx.fillStyle = '#bbb';
            ctx.fillText(`Owned: ${this.inventory.getMaterialCount(item.id)}`, cx, dy);
        }
    }

    drawCraftMenu(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        const W = this.W, H = this.H;

        // === 背景（インベントリと完全同一） ===
        ctx.fillStyle = '#1a1a22';
        ctx.fillRect(0, 0, W, H);
        // 格子模様
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
        for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
        // 金色外枠
        ctx.strokeStyle = '#c8a800';
        ctx.lineWidth = 3;
        ctx.strokeRect(5, 5, W-10, H-10);
        // 四隅リベット
        for (const [rx,ry] of [[10,10],[W-10,10],[10,H-10],[W-10,H-10]]) {
            ctx.fillStyle = '#c8a800';
            ctx.beginPath(); ctx.arc(rx,ry,5,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ddc840';
            ctx.beginPath(); ctx.arc(rx-1,ry-1,2.5,0,Math.PI*2); ctx.fill();
        }
        // タイトル帯
        const titleGrad = ctx.createLinearGradient(0, 18, 0, 55);
        titleGrad.addColorStop(0, '#3a3a44');
        titleGrad.addColorStop(0.5, '#4a4a55');
        titleGrad.addColorStop(1, '#2a2a33');
        ctx.fillStyle = titleGrad;
        ctx.fillRect(10, 18, W-20, 38);

        // === タブ（インベントリと同スタイル） ===
        const tabNames = ['CRAFT', 'UPGRADE', 'BOX'];
        const tabW = Math.min(120, (W-80)/3);
        for (let t = 0; t < 3; t++) {
            const tx = 20 + t * (tabW + 6);
            const sel = t === this.craftTab;
            ctx.fillStyle = sel ? '#2a2a38' : '#1a1a22';
            roundRect(ctx, tx, 22, tabW, 28, 4); ctx.fill();
            ctx.strokeStyle = sel ? '#c8a800' : '#444';
            ctx.lineWidth = sel ? 2 : 1;
            roundRect(ctx, tx, 22, tabW, 28, 4); ctx.stroke();
            ctx.fillStyle = sel ? '#c8a800' : '#666';
            ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
            ctx.fillText(tabNames[t], tx + tabW/2, 41);
            if (sel) {
                ctx.fillStyle = '#c8a800';
                ctx.fillRect(tx + 10, 48, tabW - 20, 2);
            }
        }

        // タイトルテキスト
        ctx.fillStyle = '#c8a800'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
        ctx.fillText(['CRAFT','UPGRADE','BOX'][this.craftTab], W/2, 43);

        const contentY = 65;
        const detailX = Math.floor(W * 0.62);
        const listW = detailX - 25;

        if (this.craftTab === 1) {
            // === UPGRADEタブ ===
            const items = [...this.inventory.weapons.filter(w=>w.name!=='Basic Sword'), ...this.inventory.armors];
            this.upgradeCursor = Math.min(this.upgradeCursor, Math.max(0, items.length-1));
            if (items.length === 0) {
                ctx.fillStyle = '#555'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
                ctx.fillText('No upgradeable items', listW/2+20, contentY+60);
            } else {
                let uy = contentY;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i], sel = i === this.upgradeCursor;
                    const isW = item instanceof Weapon;
                    const canUp = isW ? this.inventory.canUpgrade(item) : this.inventory.canUpgradeArmor(item);
                    const lvl = item.upgradeLevel || 0, maxed = lvl >= 3;
                    // 行背景
                    ctx.fillStyle = sel ? 'rgba(200,168,0,0.12)' : (i%2===0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0)');
                    ctx.fillRect(20, uy, listW, 50);
                    if (sel) { ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 2; ctx.strokeRect(20, uy, listW, 50); }
                    // 名前
                    ctx.fillStyle = sel ? '#c8a800' : '#aaa'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
                    ctx.fillText(item.getDisplayName ? item.getDisplayName() : item.name, 42, uy+20);
                    // 強化★
                    ctx.fillStyle = '#c8a800'; ctx.font = '10px monospace';
                    let stars = ''; for (let d=0;d<3;d++) stars += d<lvl ? '\u2605' : '\u2606';
                    ctx.fillText(stars, 42, uy+35);
                    if (isW) { ctx.fillStyle='#888'; ctx.fillText(`DMG:${item.damage}`, 200, uy+35); }
                    // コスト
                    if (!maxed) {
                        const id = this.inventory.getWeaponId ? this.inventory.getWeaponId(item) : 'drakeArmor';
                        const costDef = UPGRADE_COSTS[id||'drakeArmor'];
                        if (costDef) { const c=costDef.costs[lvl]; ctx.fillStyle='#777'; ctx.fillText(`${MATERIALS[costDef.mat].name} x${c.m}${c.c>0?' + Core x'+c.c:''}`,300,uy+20); }
                    } else { ctx.fillStyle='#c8a800'; ctx.fillText('MAX',300,uy+20); }
                    // ボタン
                    if (sel && !maxed) {
                        const bx=listW-80,by2=uy+10,bw=80,bh=24;
                        ctx.fillStyle = canUp ? '#886600' : '#333';
                        roundRect(ctx,bx,by2,bw,bh,4); ctx.fill();
                        if (canUp) { ctx.strokeStyle='#c8a800';ctx.lineWidth=1;roundRect(ctx,bx,by2,bw,bh,4);ctx.stroke(); }
                        ctx.fillStyle = canUp ? '#fff' : '#666'; ctx.font='bold 11px monospace'; ctx.textAlign='center';
                        ctx.fillText('UPGRADE',bx+bw/2,by2+16); ctx.textAlign='left';
                    }
                    uy += 54;
                }
                // 右パネル
                if (items[this.upgradeCursor]) {
                    const it = items[this.upgradeCursor];
                    if (it instanceof Weapon) this._drawInvDetail(ctx,detailX,contentY,W-detailX-15,H-contentY-40,'weapon',it);
                }
            }
        } else if (this.craftTab === 2) {
            // === BOXタブ ===
            this.craftCursor = Math.min(this.craftCursor, BOX_RECIPES.length-1);
            let by = contentY;
            for (let i = 0; i < BOX_RECIPES.length; i++) {
                const box = BOX_RECIPES[i];
                const sel = i === this.craftCursor;
                const canOpen = this.inventory.canCraftBox(box);
                ctx.fillStyle = sel ? 'rgba(200,168,0,0.12)' : (i%2===0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0)');
                ctx.fillRect(20, by, listW, 70);
                if (sel) { ctx.strokeStyle = box.frameColor; ctx.lineWidth = 2; ctx.strokeRect(20, by, listW, 70); }
                // ボックスアイコン
                ctx.fillStyle = box.frameColor; ctx.globalAlpha = 0.3;
                roundRect(ctx, 28, by+10, 50, 50, 6); ctx.fill();
                ctx.globalAlpha = 1; ctx.strokeStyle = box.frameColor; ctx.lineWidth = 2;
                roundRect(ctx, 28, by+10, 50, 50, 6); ctx.stroke();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
                ctx.fillText('?', 53, by+42);
                // 名前
                ctx.fillStyle = sel ? box.frameColor : '#bbb';
                ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
                ctx.fillText(box.name, 88, by+22);
                // 排出率
                ctx.fillStyle = '#777'; ctx.font = '9px monospace';
                const rateStr = Object.entries(box.rates).map(([k,v])=>`${COMPANION_TYPES[k].name}:${Math.round(v*100)}%`).join(' / ');
                ctx.fillText(rateStr, 88, by+38);
                // 素材
                let mx = 88; const my = by+55;
                for (const req of box.materials) {
                    const mat = MATERIALS[req.materialId];
                    const ow = this.inventory.getMaterialCount(req.materialId);
                    const en = ow >= req.count;
                    this._drawMatIcon(ctx, req.materialId, mx+6, my-4, 5);
                    mx += 14;
                    ctx.fillStyle = en ? '#fff' : '#cc4444'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
                    ctx.fillText(`x${req.count}`, mx, my); mx += 30;
                }
                // OPENボタン
                if (sel) {
                    const bx = listW-65, by2 = by+23, bw = 65, bh = 24;
                    ctx.fillStyle = canOpen ? '#886600' : '#222';
                    roundRect(ctx, bx, by2, bw, bh, 4); ctx.fill();
                    if (canOpen) { ctx.strokeStyle = box.frameColor; ctx.lineWidth = 1; roundRect(ctx, bx, by2, bw, bh, 4); ctx.stroke(); }
                    ctx.fillStyle = canOpen ? '#fff' : '#555'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
                    ctx.fillText('OPEN', bx+bw/2, by2+16); ctx.textAlign = 'left';
                }
                by += 76;
            }
            // 右パネル: 所持仲間リスト
            ctx.fillStyle = 'rgba(26,26,34,0.95)';
            roundRect(ctx, detailX, contentY, W-detailX-15, H-contentY-40, 8); ctx.fill();
            ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 1;
            roundRect(ctx, detailX, contentY, W-detailX-15, H-contentY-40, 8); ctx.stroke();
            ctx.fillStyle = '#c8a800'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
            ctx.fillText('Companions', detailX+(W-detailX-15)/2, contentY+25);
            let cy2 = contentY + 40;
            if (this.inventory.companions.length === 0) {
                ctx.fillStyle = '#555'; ctx.font = '12px monospace';
                ctx.fillText('No companions yet', detailX+(W-detailX-15)/2, cy2+20);
            } else {
                for (const c of this.inventory.companions) {
                    const isActive = c === this.inventory.activeCompanion;
                    ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(detailX+25, cy2+8, 8, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = isActive ? '#c8a800' : '#aaa'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
                    ctx.fillText(`${c.name} Lv${c.level}${isActive?' [ACTIVE]':''}`, detailX+40, cy2+12);
                    cy2 += 22;
                }
            }
        } else {
            // === CRAFTタブ ===
            const cardH = 65, gap = 6;
            this.craftCursor = Math.min(this.craftCursor, RECIPES.length-1);
            let cy = contentY;
            const iconColors = {ironSword:'#cc8844',hunterBow:'#88cc44',frostBlade:'#66bbee',warHammer:'#aa6633',poisonDagger:'#66aa66',drakeArmor:'#6688cc'};
            for (let i = 0; i < RECIPES.length; i++) {
                const r = RECIPES[i];
                const cc = this.inventory.canCraft(r);
                const own = this.inventory.alreadyOwns(r);
                const sel = i === this.craftCursor;
                // 行背景
                ctx.fillStyle = sel ? 'rgba(200,168,0,0.12)' : (i%2===0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0)');
                ctx.fillRect(20, cy, listW, cardH);
                if (sel) { ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 2; ctx.strokeRect(20, cy, listW, cardH); }
                else { ctx.strokeStyle = '#2a2a33'; ctx.lineWidth = 1; ctx.strokeRect(20, cy, listW, cardH); }
                // 武器アイコン
                ctx.fillStyle = iconColors[r.id] || '#888';
                roundRect(ctx, 28, cy+8, 42, cardH-16, 4); ctx.fill();
                ctx.fillStyle = '#111'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
                const iconLetter = r.resultType==='armor' ? 'A' : (WEAPONS[r.resultId]?.type==='ranged' ? 'B' : 'S');
                ctx.fillText(iconLetter, 49, cy+cardH/2+6);
                // 武器名
                ctx.fillStyle = own ? '#555' : (sel ? '#c8a800' : '#bbb');
                ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
                ctx.fillText(r.name, 78, cy+18);
                if (own) { ctx.fillStyle='#44aa44'; ctx.font='10px monospace'; ctx.fillText('[OWNED]',78+ctx.measureText(r.name).width+8,cy+18); }
                // 説明
                ctx.fillStyle = '#777'; ctx.font = '10px monospace';
                ctx.fillText(r.description, 78, cy+33);
                // 素材
                let mx = 78; const my = cy+50;
                for (const req of r.materials) {
                    const mat = MATERIALS[req.materialId];
                    const ow = this.inventory.getMaterialCount(req.materialId);
                    const en = ow >= req.count;
                    this._drawMatIcon(ctx, req.materialId, mx+6, my-4, 5);
                    mx += 14;
                    ctx.fillStyle = en ? '#fff' : '#cc4444'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
                    const tx = `x${req.count} `; ctx.fillText(tx, mx, my); mx += ctx.measureText(tx).width+4;
                }
                // CRAFTボタン
                if (sel && !own) {
                    const bx=listW-65, by=cy+cardH/2-12, bw=65, bh=24;
                    if (cc) {
                        ctx.fillStyle='#886600'; roundRect(ctx,bx,by,bw,bh,4); ctx.fill();
                        ctx.strokeStyle='#c8a800'; ctx.lineWidth=1; roundRect(ctx,bx,by,bw,bh,4); ctx.stroke();
                        ctx.fillStyle='#fff';
                    } else {
                        ctx.fillStyle='#222'; roundRect(ctx,bx,by,bw,bh,4); ctx.fill();
                        ctx.fillStyle='#555';
                    }
                    ctx.font='bold 11px monospace'; ctx.textAlign='center';
                    ctx.fillText('CRAFT', bx+bw/2, by+16); ctx.textAlign='left';
                }
                cy += cardH + gap;
            }
            // 右パネル: 選択レシピ詳細
            const selR = RECIPES[this.craftCursor];
            if (selR) {
                // パネル背景
                ctx.fillStyle = 'rgba(26,26,34,0.95)';
                roundRect(ctx, detailX, contentY, W-detailX-15, H-contentY-40, 8); ctx.fill();
                ctx.strokeStyle = '#c8a800'; ctx.lineWidth = 1;
                roundRect(ctx, detailX, contentY, W-detailX-15, H-contentY-40, 8); ctx.stroke();
                const dcx = detailX + (W-detailX-15)/2;
                let dy = contentY + 30;
                // 大アイコン
                ctx.fillStyle = iconColors[selR.id] || '#888';
                roundRect(ctx, dcx-35, dy-22, 70, 70, 8); ctx.fill();
                ctx.fillStyle = '#111'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
                ctx.fillText(selR.resultType==='armor'?'A':'S', dcx, dy+22);
                dy += 65;
                // 名前
                ctx.fillStyle = '#c8a800'; ctx.font = 'bold 16px monospace';
                ctx.fillText(selR.name, dcx, dy); dy += 22;
                ctx.fillStyle = '#aaa'; ctx.font = 'italic 11px monospace';
                ctx.fillText(selR.description, dcx, dy); dy += 25;
                // ステータスバー
                const w2 = WEAPONS[selR.resultId];
                if (w2) {
                    const barW = W-detailX-55, barX = detailX+20;
                    const stats = [
                        {name:'ATK', val:w2.baseDamage, max:150},
                        {name:'RNG', val:w2.range, max:400},
                        {name:'SPD', val:Math.max(0,600-w2.cooldown), max:500},
                    ];
                    for (const st of stats) {
                        ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
                        ctx.fillText(st.name, barX, dy);
                        ctx.fillStyle = '#222'; roundRect(ctx, barX+35, dy-8, barW-35, 10, 3); ctx.fill();
                        ctx.save(); roundRect(ctx, barX+35, dy-8, barW-35, 10, 3); ctx.clip();
                        ctx.fillStyle = '#c8a800'; ctx.fillRect(barX+35, dy-8, (barW-35)*Math.min(1,st.val/st.max), 10);
                        ctx.restore();
                        dy += 18;
                    }
                    dy += 10;
                    const ultNames = {combo3:'乱舞斬り',charge:'大地割り',bow:'矢の雨',frost:'吹雪',hammer:'天地崩壊',poison:'毒霧'};
                    ctx.fillStyle = '#c8a800'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
                    ctx.fillText(`Ultimate: ${ultNames[w2.style]||'-'}`, barX, dy);
                }
                // 必要素材リスト
                dy += 25;
                ctx.fillStyle = '#aaa'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
                ctx.fillText('Required Materials:', detailX+20, dy); dy += 18;
                for (const req of selR.materials) {
                    const mat = MATERIALS[req.materialId];
                    const ow = this.inventory.getMaterialCount(req.materialId);
                    const en = ow >= req.count;
                    this._drawMatIcon(ctx, req.materialId, detailX+32, dy-3, 7);
                    ctx.fillStyle = en ? '#44cc44' : '#cc4444'; ctx.font = '11px monospace';
                    ctx.fillText(`${mat.name} ${ow}/${req.count}`, detailX+45, dy);
                    dy += 18;
                }
            }
        }

        // クラフトアニメーション
        if (this.craftAnimActive && this.craftAnimTimer > 0) {
            const t = 1500 - this.craftAnimTimer;
            ctx.save();
            if (t < 300) {
                ctx.globalAlpha = t/300;
                ctx.fillStyle = 'rgba(200,168,0,0.3)';
                ctx.beginPath(); ctx.arc(W/2,H/2,80-t*0.2,0,Math.PI*2); ctx.fill();
            } else if (t < 500) {
                const p = (t-300)/200;
                ctx.globalAlpha = 1-p;
                ctx.fillStyle = 'rgba(255,220,100,0.6)';
                ctx.beginPath(); ctx.arc(W/2,H/2,p*150,0,Math.PI*2); ctx.fill();
            } else if (t < 1500) {
                const a = Math.min(1,(t-500)/200) * (1-Math.max(0,(t-1200)/300));
                ctx.globalAlpha = a;
                ctx.fillStyle = '#c8a800'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
                ctx.fillText(`${this.craftAnimName} CRAFTED!`, W/2, H/2);
            }
            ctx.restore();
        }

        // メッセージ
        if (this.craftMessageTimer > 0 && !this.craftAnimActive) {
            const alpha = Math.min(1, this.craftMessageTimer/300);
            ctx.fillStyle = `rgba(255,255,100,${alpha})`;
            ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
            ctx.fillText(this.craftMessage, W/2, H-45);
        }

        // 操作ガイド
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
        ctx.fillText('W/S:Select  Z:Execute  E:Tab  C:Close', W/2, H-18);
        ctx.restore();
    }
}

// ========================================
// ゲーム起動
// ========================================
window.addEventListener('load', () => { new Game('gameCanvas'); });
