// ========================================
// MONSTER HUNT 2D - Phase 5
// フィールド改善・エフェクト・コンボ・UI仕上げ
// ========================================

// ========================================
// シード付き乱数生成（フィールド配置の再現性用）
// ========================================
class SeededRandom {
    constructor(seed) { this.seed = seed; }
    next() {
        this.seed = (this.seed * 16807 + 0) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
}

// ========================================
// パーティクルクラス
// ========================================
class Particle {
    constructor(x, y, vx, vy, color, life, size = 3) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
        this.alive = true;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += 80 * dt; // 重力
        this.life -= dt * 1000;
        if (this.life <= 0) this.alive = false;
    }
    draw(ctx) {
        if (!this.alive) return;
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

// ========================================
// ダメージ数値ポップアップ
// ========================================
class DamageNumber {
    constructor(x, y, value, color = '#fff', label = '') {
        this.x = x + (Math.random()-0.5)*20;
        this.y = y;
        this.value = value;
        this.color = color;
        this.label = label; // 'WEAK!' or 'BREAK!' or ''
        this.life = 1000;
        this.maxLife = 1000;
        this.alive = true;
    }
    update(dt) {
        this.y -= 40 * dt;
        this.life -= dt * 1000;
        if (this.life <= 0) this.alive = false;
    }
    draw(ctx) {
        if (!this.alive) return;
        const alpha = Math.max(0, this.life / this.maxLife);
        const scale = this.life > 800 ? 1.2 : 1.0;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.floor(16*scale)}px monospace`;
        ctx.textAlign = 'center';
        // 影
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText(this.value, this.x+1, this.y+1);
        // 本体
        ctx.fillStyle = this.color;
        ctx.fillText(this.value, this.x, this.y);
        // ラベル
        if (this.label) {
            ctx.font = 'bold 12px monospace';
            ctx.fillText(this.label, this.x, this.y - 16);
        }
        ctx.restore();
    }
}

// ========================================
// 効果音管理クラス（Web Audio API）
// ========================================
class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this._initOnInteraction = () => {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        };
        window.addEventListener('keydown', this._initOnInteraction, { once: false });
        window.addEventListener('click', this._initOnInteraction, { once: false });
    }
    _beep(freq, duration, type = 'square', volume = 0.15) {
        if (!this.ctx || !this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    /** 剣ヒット音（下降スイープ） */
    playSwordHit() {
        if (!this.ctx||!this.enabled) return;
        const t=this.ctx.currentTime;
        const osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
        osc.type='square'; osc.connect(gain); gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(100, t+0.1);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t+0.1);
        osc.start(t); osc.stop(t+0.1);
    }
    playHit() { this.playSwordHit(); }
    playComboHit() {
        if (!this.ctx||!this.enabled) return;
        const t=this.ctx.currentTime;
        const osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
        osc.type='square'; osc.connect(gain); gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(150, t+0.15);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t+0.15);
        osc.start(t); osc.stop(t+0.15);
        // 追加の高音レイヤー
        setTimeout(() => this._beep(600, 0.08, 'sine', 0.12), 30);
    }
    /** アイテム取得音（ピロン↑） */
    playItemGet() {
        this._beep(880, 0.06, 'sine', 0.12);
        setTimeout(() => this._beep(1320, 0.08, 'sine', 0.12), 50);
        setTimeout(() => this._beep(1760, 0.06, 'sine', 0.1), 100);
    }
    playPickup() { this.playItemGet(); }
    /** クエストクリア音（明るい3音上昇） */
    playQuestClear() {
        [523, 659, 784, 1047].forEach((f, i) => {
            setTimeout(() => this._beep(f, 0.3, 'sine', 0.18), i * 150);
        });
    }
    playQuestComplete() { this.playQuestClear(); }
    /** 被ダメージ音（低いドン） */
    playDamage() {
        if (!this.ctx||!this.enabled) return;
        const t=this.ctx.currentTime;
        const osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
        osc.type='sawtooth'; osc.connect(gain); gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(60, t+0.15);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t+0.15);
        osc.start(t); osc.stop(t+0.15);
    }
    /** モンスター撃破音（下降する爆発音） */
    playMonsterDie() {
        if (!this.ctx||!this.enabled) return;
        const t=this.ctx.currentTime;
        const osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
        osc.type='sawtooth'; osc.connect(gain); gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(40, t+0.4);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t+0.4);
        osc.start(t); osc.stop(t+0.4);
        setTimeout(() => this._beep(80, 0.2, 'square', 0.1), 100);
    }
    playQuestFailed() {
        this._beep(300, 0.3, 'sawtooth', 0.1);
        setTimeout(() => this._beep(200, 0.4, 'sawtooth', 0.1), 200);
    }
    playChargeWarning() {
        this._beep(200, 0.15, 'sawtooth', 0.12);
        setTimeout(() => this._beep(250, 0.15, 'sawtooth', 0.12), 150);
    }
    playLevelUp() {
        [523,659,784,1047,1319].forEach((f,i) => {
            setTimeout(() => this._beep(f, 0.2, 'sine', 0.18), i * 100);
        });
    }
    playPartBreak() {
        this._beep(250, 0.15, 'square', 0.2);
        setTimeout(() => this._beep(400, 0.1, 'sine', 0.15), 80);
    }
}
const Sound = new SoundManager();

// ========================================
// 定数・データ定義
// ========================================
const MATERIALS = {
    drakeScale: { id: 'drakeScale', name: 'Drake Scale', color: '#44cc88', description: 'ドレイクの鱗' },
    drakeFang:  { id: 'drakeFang',  name: 'Drake Fang',  color: '#cccc44', description: 'ドレイクの牙' },
    drakeCore:  { id: 'drakeCore',  name: 'Drake Core',  color: '#cc44cc', description: 'ドレイクの核' },
    iceFang:    { id: 'iceFang',    name: 'Ice Fang',    color: '#66ccee', description: '氷の牙' },
    iceCrystal:     { id: 'iceCrystal',     name: 'Ice Crystal',     color: '#aaeeff', description: '氷の結晶' },
    drakeHeadScale: { id: 'drakeHeadScale', name: 'Drake Head Scale', color: '#55aa77', description: '頭部の鱗' },
    drakeTail:      { id: 'drakeTail',      name: 'Drake Tail',      color: '#aa7744', description: 'ドレイクの尻尾' },
    elderScale:     { id: 'elderScale',     name: 'Elder Scale',     color: '#aa44ff', description: '古龍の鱗' },
};

// アップグレード定義（武器ID→レベル別コスト）
const UPGRADE_COSTS = {
    // +1: 同素材x2, +2: 同素材x4+Core x1, +3: 同素材x6+Core x2
    ironSword:    { mat: 'drakeScale', costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
    hunterBow:    { mat: 'drakeFang',  costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
    frostBlade:   { mat: 'iceFang',    costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
    warHammer:    { mat: 'drakeScale', costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
    poisonDagger: { mat: 'drakeFang',  costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
    drakeArmor:   { mat: 'drakeScale', costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
};
const UPGRADE_DMG_MULT = [1.0, 1.1, 1.25, 1.5];
const ARMOR_UPGRADE_MULT = [0.7, 0.6, 0.5, 0.4];

// サブクエスト条件
const SUB_QUESTS = [
    { id: 'noDamage',   name: 'スタイリッシュ', desc: '被ダメージ0で討伐', rewardType: 'expMult', rewardVal: 2 },
    { id: 'speedRun',   name: 'スピードラン',   desc: '60秒以内に討伐',    rewardType: 'matMult', rewardVal: 2 },
    { id: 'partBreak',  name: '部位破壊',       desc: '頭と尻尾を両方破壊', rewardType: 'specialDrop', rewardVal: 1 },
    { id: 'parryMaster',name: 'パリィマスター', desc: '3回以上パリィ成功', rewardType: 'coreDrop', rewardVal: 1 },
];

// EXP・レベルアップ定数
const EXP_TABLE = [0, 200, 500, 1000, 2000]; // Lv1→2, 2→3, ...
const MONSTER_EXP = { 'Forest Drake': 100, 'Ice Wolf': 80, 'Giant Drake': 500 };
const MAX_LEVEL = 5;

// スキル定義
const SKILLS = [
    { id: 'powerSword', name: '剛剣',   desc: '近距離武器ダメージ+20%',  apply: (p) => { p.skillMeleeMult *= 1.2; } },
    { id: 'rapidFire',  name: '速射',   desc: '弓のクールダウン-30%',    apply: (p) => { p.skillBowCdMult *= 0.7; } },
    { id: 'ironWall',   name: '鉄壁',   desc: '被ダメージ-15%',         apply: (p) => { p.skillDefMult *= 0.85; } },
    { id: 'swiftWind',  name: '疾風',   desc: '移動速度+20%',           apply: (p) => { p.baseSpeed = Math.floor(p.baseSpeed * 1.2); p.speed = p.baseSpeed; } },
    { id: 'heal',       name: '回復',   desc: 'HP最大値+30・即時回復30', apply: (p) => { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); } },
    { id: 'flurry',     name: '連撃',   desc: '攻撃速度+25%',           apply: (p) => { p.skillAtkSpdMult *= 0.75; } },
    { id: 'mining',     name: '採掘',   desc: '素材ドロップ数+1',        apply: (p) => { p.skillExtraDrop++; } },
    { id: 'insight',    name: '看破',   desc: 'モンスターHP数値表示',     apply: (p) => { p.skillShowHpNum = true; } },
];

const DROP_TABLES = {
    forestDrake: [
        { materialId: 'drakeScale', chance: 1.0, minCount: 2, maxCount: 4 },
        { materialId: 'drakeFang',  chance: 0.5, minCount: 1, maxCount: 2 },
        { materialId: 'drakeCore',  chance: 0.2, minCount: 1, maxCount: 1 },
    ],
    giantDrake: [],
    iceWolf: [
        { materialId: 'iceFang',    chance: 0.6, minCount: 1, maxCount: 2 },
        { materialId: 'iceCrystal', chance: 0.3, minCount: 1, maxCount: 1 },
    ],
};

// ワールドサイズ
const WORLD_W = 2400, WORLD_H = 1800;

// エリア定義（座標とタイプ）
const AREAS = [
    { name: 'grassland', color: '#2d5a27', x: 0, y: 600, w: 2400, h: 600 },        // 中央草原
    { name: 'forest',    color: '#1a3a18', x: 0, y: 0,   w: 2400, h: 600 },        // 北の森
    { name: 'rocks',     color: '#4a4a50', x: 1600, y: 600, w: 800, h: 600 },      // 東の岩場
    { name: 'swamp',     color: '#1a3a30', x: 0, y: 1200, w: 2400, h: 600 },       // 南の沼
];

// 木の配置データ（ワールド全体に配置）
const TREES = [
    // 草原周辺
    { x: 150, y: 700 }, { x: 400, y: 650 }, { x: 900, y: 750 }, { x: 1200, y: 680 },
    { x: 1500, y: 800 }, { x: 300, y: 1100 }, { x: 800, y: 1050 }, { x: 1100, y: 1150 },
    // 北の森（密）
    { x: 100, y: 100 }, { x: 250, y: 200 }, { x: 400, y: 80 }, { x: 550, y: 250 },
    { x: 700, y: 150 }, { x: 850, y: 300 }, { x: 1000, y: 120 }, { x: 1150, y: 280 },
    { x: 1300, y: 180 }, { x: 1500, y: 350 }, { x: 1700, y: 200 }, { x: 1900, y: 300 },
    { x: 200, y: 400 }, { x: 500, y: 450 }, { x: 800, y: 500 }, { x: 1100, y: 420 },
    { x: 1400, y: 500 }, { x: 1700, y: 450 }, { x: 2000, y: 380 }, { x: 2200, y: 250 },
    // 東岩場に少し
    { x: 1800, y: 700 }, { x: 2100, y: 850 },
    // 南沼周辺
    { x: 200, y: 1350 }, { x: 600, y: 1400 }, { x: 1000, y: 1300 }, { x: 1400, y: 1450 },
];
const TREE_TRUNK_R = 12;
const TREE_CANOPY_R = 28;
const TREE_COLLISION_R = 18;

const QUESTS = [
    {
        id: 'forestDrake', name: 'Forest Drake討伐',
        description: 'Forest Drakeを1体討伐せよ', difficulty: 1,
        rewards: [{ materialId: 'drakeScale', count: 3 }],
        monsters: [{
            name: 'Forest Drake', x: 1150, y: 750,
            config: { hp: 500, width: 64, height: 64, speed: 80, color: '#cc3333',
                      attackDamage: 6, attackRange: 55, attackCooldown: 1500,
                      aggroRange: 400, dropTableId: 'forestDrake' },
        }],
    },
    {
        id: 'doubleDrake', name: 'Drake 2体同時討伐',
        description: 'Forest Drake 2体を同時に討伐せよ', difficulty: 2,
        rewards: [{ materialId: 'drakeFang', count: 3 }, { materialId: 'drakeCore', count: 1 }],
        monsters: [
            { name: 'Forest Drake', x: 900, y: 700,
              config: { hp: 500, width: 64, height: 64, speed: 80, color: '#cc3333',
                        attackDamage: 6, attackRange: 55, attackCooldown: 1500,
                        aggroRange: 400, dropTableId: 'forestDrake' } },
            { name: 'Forest Drake', x: 1400, y: 800,
              config: { hp: 500, width: 64, height: 64, speed: 85, color: '#dd4444',
                        attackDamage: 6, attackRange: 55, attackCooldown: 1500,
                        aggroRange: 400, dropTableId: 'forestDrake' } },
        ],
    },
    {
        id: 'iceWolf', name: 'Ice Wolf討伐',
        description: '素早い氷の狼を討伐せよ', difficulty: 2,
        rewards: [{ materialId: 'iceFang', count: 2 }],
        monsters: [{
            name: 'Ice Wolf', x: 1150, y: 700,
            config: { hp: 300, width: 48, height: 48, speed: 120, color: '#88ccee',
                      attackDamage: 8, attackRange: 45, attackCooldown: 1200,
                      aggroRange: 400, dropTableId: 'iceWolf', isIceWolf: true },
        }],
    },
    {
        id: 'giantDrake', name: 'Giant Drake討伐',
        description: 'HP1500の巨大ドレイクを討伐せよ', difficulty: 3,
        rewards: [{ materialId: 'drakeCore', count: 3 }],
        monsters: [{
            name: 'Giant Drake', x: 1100, y: 700,
            config: { hp: 1500, width: 96, height: 96, speed: 70, color: '#882222',
                      attackDamage: 13, attackRange: 70, attackCooldown: 1000,
                      aggroRange: 350, dropTableId: 'giantDrake', isBoss: true },
        }],
    },
    {
        id: 'elderDrake', name: '古龍討伐', special: true,
        description: '最強の古龍を討伐せよ', difficulty: 4,
        rewards: [{ materialId: 'elderScale', count: 5 }],
        unlockCondition: 'allClear+lv5',
        monsters: [{
            name: 'Elder Drake', x: 1100, y: 650,
            config: { hp: 3000, width: 96, height: 96, speed: 100, color: '#220022',
                      attackDamage: 25, attackRange: 75, attackCooldown: 800,
                      aggroRange: 450, dropTableId: 'giantDrake', isBoss: true, isElder: true },
        }],
    },
    {
        id: 'abyss', name: '奈落の試練', special: true,
        description: 'Elder Drake + Giant Drake同時', difficulty: 4,
        unlockCondition: 'elderClear',
        rewards: [{ materialId: 'elderScale', count: 8 }],
        timeLimit: 600,
        monsters: [
            { name: 'Elder Drake', x: 900, y: 650,
              config: { hp: 3000, width: 96, height: 96, speed: 100, color: '#220022',
                        attackDamage: 25, attackRange: 75, attackCooldown: 800,
                        aggroRange: 450, dropTableId: 'giantDrake', isBoss: true, isElder: true } },
            { name: 'Giant Drake', x: 1400, y: 800,
              config: { hp: 1500, width: 96, height: 96, speed: 70, color: '#882222',
                        attackDamage: 13, attackRange: 70, attackCooldown: 1000,
                        aggroRange: 350, dropTableId: 'giantDrake', isBoss: true } },
        ],
    },
];

class Weapon {
    /**
     * @param {string} name
     * @param {number} damage - 基本ダメージ
     * @param {number} range - 射程(px)
     * @param {number} cooldown - クールダウン(ms)
     * @param {number} knockback
     * @param {string} type - 'melee'|'ranged'
     * @param {string} style - 武器スタイル
     * @param {string} desc - 1行説明
     */
    constructor(name, damage, range, cooldown, knockback, type, style, desc='') {
        this.name = name; this.damage = damage; this.range = range;
        this.cooldown = cooldown; this.knockback = knockback;
        this.type = type; this.style = style; this.desc = desc;
        this.upgradeLevel = 0; // 0〜3
        this.baseDamage = damage;
    }
    getEffectiveDamage() { return Math.floor(this.baseDamage * UPGRADE_DMG_MULT[this.upgradeLevel]); }
    getDisplayName() { return this.upgradeLevel > 0 ? `${this.name}+${this.upgradeLevel}` : this.name; }
}
const WEAPONS = {
    basicSword:  new Weapon('Basic Sword',  15, 45, 350, 3, 'melee', 'combo3', '3段コンボ'),
    ironSword:   new Weapon('Iron Sword',   30, 55, 500, 5, 'melee', 'charge', 'チャージ攻撃'),
    hunterBow:   new Weapon('Hunter Bow',   20, 300, 500, 0, 'ranged','bow',   '長押しで3連矢'),
    frostBlade:  new Weapon('Frost Blade',  35, 50, 300, 4, 'melee', 'frost',  '2連撃・凍結'),
    warHammer:   new Weapon('War Hammer',  120, 55,2000, 8, 'melee', 'hammer', '超重撃・部位+50%'),
    poisonDagger:new Weapon('Poison Dagger',18, 35, 180, 1, 'melee', 'poison', '4段コンボ・毒'),
};

class Armor {
    constructor(name, defense, damageMultiplier = 1.0) {
        this.name = name; this.defense = defense; this.damageMultiplier = damageMultiplier;
        this.upgradeLevel = 0;
    }
    getDisplayName() { return this.upgradeLevel > 0 ? `${this.name}+${this.upgradeLevel}` : this.name; }
}
const ARMORS = { drakeArmor: new Armor('Drake Armor', 20, 0.7) };

const RECIPES = [
    { id: 'ironSword', name: 'Iron Sword', description: 'チャージ攻撃・DMG80扇形範囲',
      resultType: 'weapon', resultId: 'ironSword',
      materials: [{ materialId: 'drakeScale', count: 3 }] },
    { id: 'hunterBow', name: 'Hunter Bow', description: '長押しで3連矢・扇状射撃',
      resultType: 'weapon', resultId: 'hunterBow',
      materials: [{ materialId: 'drakeFang', count: 2 }] },
    { id: 'frostBlade', name: 'Frost Blade', description: '2連撃・3ヒットで凍結',
      resultType: 'weapon', resultId: 'frostBlade',
      materials: [{ materialId: 'iceFang', count: 2 }, { materialId: 'drakeScale', count: 1 }] },
    { id: 'warHammer', name: 'War Hammer', description: '超重撃DMG120・部位破壊+50%',
      resultType: 'weapon', resultId: 'warHammer',
      materials: [{ materialId: 'drakeCore', count: 2 }, { materialId: 'drakeScale', count: 3 }] },
    { id: 'poisonDagger', name: 'Poison Dagger', description: '4段コンボ・毒付与',
      resultType: 'weapon', resultId: 'poisonDagger',
      materials: [{ materialId: 'drakeFang', count: 3 }, { materialId: 'iceCrystal', count: 1 }] },
    { id: 'drakeArmor', name: 'Drake Armor', description: '被ダメージ x0.7（防御力+20）',
      resultType: 'armor', resultId: 'drakeArmor',
      materials: [{ materialId: 'drakeScale', count: 5 }, { materialId: 'drakeCore', count: 1 }] },
];

// ========================================
// DroppedItem / Arrow / Inventory（変更なし）
// ========================================
class DroppedItem {
    constructor(x, y, materialId, count) {
        this.x = x; this.y = y; this.materialId = materialId; this.count = count;
        this.radius = 8; this.collected = false;
        this.collectEffectTimer = 0; this.collectEffectDuration = 400;
        this.targetX = x; this.targetY = y; this.animProgress = 0;
        this.startX = x; this.startY = y;
        this.floatPhase = Math.random() * Math.PI * 2;
    }
    setScatter(ox, oy) {
        this.startX = ox; this.startY = oy;
        const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 50;
        this.targetX = ox + Math.cos(a) * d; this.targetY = oy + Math.sin(a) * d;
        this.animProgress = 0;
    }
    update(dt) {
        if (this.animProgress < 1) {
            this.animProgress = Math.min(1, this.animProgress + dt * 3);
            const t = 1 - Math.pow(1 - this.animProgress, 3);
            this.x = this.startX + (this.targetX - this.startX) * t;
            this.y = this.startY + (this.targetY - this.startY) * t;
        }
        this.floatPhase += dt * 3;
        if (this.collectEffectTimer > 0) this.collectEffectTimer -= dt * 1000;
    }
    draw(ctx) {
        if (this.collected && this.collectEffectTimer <= 0) return;
        const mat = MATERIALS[this.materialId];
        const floatY = Math.sin(this.floatPhase) * 5;
        if (this.collected) {
            const alpha = this.collectEffectTimer / this.collectEffectDuration;
            const riseY = (1 - alpha) * -30;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = mat.color;
            ctx.beginPath(); ctx.arc(this.x, this.y + riseY, this.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
            ctx.fillText(`+${this.count} ${mat.name}`, this.x, this.y + riseY - 15);
            ctx.globalAlpha = 1;
        } else {
            // 光る浮遊エフェクト
            ctx.fillStyle = mat.color;
            ctx.beginPath(); ctx.arc(this.x, this.y + floatY, this.radius, 0, Math.PI * 2); ctx.fill();
            // 外側の光
            ctx.globalAlpha = 0.2 + Math.sin(this.floatPhase * 2) * 0.15;
            ctx.beginPath(); ctx.arc(this.x, this.y + floatY, this.radius + 4, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.arc(this.x - 2, this.y + floatY - 2, 3, 0, Math.PI * 2); ctx.fill();
        }
    }
    isFullyDone() { return this.collected && this.collectEffectTimer <= 0; }
}

class Arrow {
    constructor(x, y, direction, damage, pierce = false) {
        this.x = x; this.y = y; this.width = 6; this.height = 6;
        this.speed = 480; this.damage = damage; this.direction = direction;
        this.alive = true; this.maxDistance = 400; this.traveled = 0;
        this.pierce = pierce;      // 貫通するか
        this.hitIds = new Set();   // 貫通時にヒット済みモンスター追跡
        switch (direction) {
            case 'up': this.vx=0;this.vy=-1;break; case 'down': this.vx=0;this.vy=1;break;
            case 'left': this.vx=-1;this.vy=0;break; case 'right': this.vx=1;this.vy=0;break;
        }
    }
    update(dt, cw, ch) {
        const mx = this.vx*this.speed*dt, my = this.vy*this.speed*dt;
        this.x += mx; this.y += my;
        this.traveled += Math.sqrt(mx*mx+my*my);
        if (this.x<-10||this.x>WORLD_W+10||this.y<-10||this.y>WORLD_H+10||this.traveled>this.maxDistance) this.alive=false;
    }
    draw(ctx) {
        if (!this.alive) return;
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.fillStyle='#ffdd44'; ctx.strokeStyle='#aa8833'; ctx.lineWidth=1;
        switch(this.direction) {
            case 'up': ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(-3,4);ctx.lineTo(3,4);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#aa6622';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(0,10);ctx.stroke();break;
            case 'down': ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(-3,-4);ctx.lineTo(3,-4);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#aa6622';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(0,-10);ctx.stroke();break;
            case 'left': ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(4,-3);ctx.lineTo(4,3);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#aa6622';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(10,0);ctx.stroke();break;
            case 'right': ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-4,-3);ctx.lineTo(-4,3);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#aa6622';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(-10,0);ctx.stroke();break;
        }
        ctx.restore();
    }
}

class Inventory {
    constructor() {
        this.materials = {}; this.weapons = [WEAPONS.basicSword]; this.armors = [];
        this.clearedQuests = new Set(); // クリア済みクエストID
        this.bestTimes = {};            // クエストID→ベストタイム(秒)
        this.title = '';                // 称号
    }
    addMaterial(id, n) { if (!this.materials[id]) this.materials[id]=0; this.materials[id]+=n; }
    getMaterialCount(id) { return this.materials[id]||0; }
    consumeMaterial(id, n) { if (this.getMaterialCount(id)<n) return false; this.materials[id]-=n; return true; }
    canCraft(r) { return r.materials.every(m=>this.getMaterialCount(m.materialId)>=m.count); }
    alreadyOwns(r) {
        if (r.resultType==='weapon') return this.weapons.some(w=>w.name===WEAPONS[r.resultId].name);
        if (r.resultType==='armor') return this.armors.some(a=>a.name===ARMORS[r.resultId].name);
        return false;
    }
    craft(r) {
        if (!this.canCraft(r)||this.alreadyOwns(r)) return false;
        for (const m of r.materials) this.consumeMaterial(m.materialId, m.count);
        if (r.resultType==='weapon') {
            const w = new Weapon(WEAPONS[r.resultId].name, WEAPONS[r.resultId].baseDamage,
                WEAPONS[r.resultId].range, WEAPONS[r.resultId].cooldown, WEAPONS[r.resultId].knockback,
                WEAPONS[r.resultId].type, WEAPONS[r.resultId].style, WEAPONS[r.resultId].desc);
            this.weapons.push(w);
        }
        else if (r.resultType==='armor') this.armors.push(new Armor(ARMORS[r.resultId].name, ARMORS[r.resultId].defense, ARMORS[r.resultId].damageMultiplier));
        return true;
    }
    /** 武器アップグレード */
    canUpgrade(weapon) {
        const id = this.getWeaponId(weapon);
        if (!id || !UPGRADE_COSTS[id]) return false;
        if (weapon.upgradeLevel >= 3) return false;
        const cost = UPGRADE_COSTS[id].costs[weapon.upgradeLevel];
        const mat = UPGRADE_COSTS[id].mat;
        return this.getMaterialCount(mat) >= cost.m && this.getMaterialCount('drakeCore') >= cost.c;
    }
    upgradeWeapon(weapon) {
        const id = this.getWeaponId(weapon);
        if (!this.canUpgrade(weapon)) return false;
        const cost = UPGRADE_COSTS[id].costs[weapon.upgradeLevel];
        const mat = UPGRADE_COSTS[id].mat;
        this.consumeMaterial(mat, cost.m);
        if (cost.c > 0) this.consumeMaterial('drakeCore', cost.c);
        weapon.upgradeLevel++;
        weapon.damage = weapon.getEffectiveDamage();
        return true;
    }
    canUpgradeArmor(armor) {
        if (!armor || armor.upgradeLevel >= 3) return false;
        const cost = UPGRADE_COSTS['drakeArmor'];
        if (!cost) return false;
        const c = cost.costs[armor.upgradeLevel];
        return this.getMaterialCount(cost.mat) >= c.m && this.getMaterialCount('drakeCore') >= c.c;
    }
    upgradeArmor(armor) {
        if (!this.canUpgradeArmor(armor)) return false;
        const cost = UPGRADE_COSTS['drakeArmor'];
        const c = cost.costs[armor.upgradeLevel];
        this.consumeMaterial(cost.mat, c.m);
        if (c.c > 0) this.consumeMaterial('drakeCore', c.c);
        armor.upgradeLevel = (armor.upgradeLevel || 0) + 1;
        armor.damageMultiplier = ARMOR_UPGRADE_MULT[armor.upgradeLevel];
        return true;
    }
    getWeaponId(weapon) {
        for (const [id, w] of Object.entries(WEAPONS)) {
            if (w.name === weapon.name) return id;
        }
        return null;
    }
    /** セーブ用にシリアライズ */
    serialize() {
        return {
            materials: { ...this.materials },
            weapons: this.weapons.map(w => ({
                id: this.getWeaponId(w) || 'basicSword',
                upgradeLevel: w.upgradeLevel || 0,
            })),
            armors: this.armors.map(a => ({
                id: 'drakeArmor',
                upgradeLevel: a.upgradeLevel || 0,
            })),
            clearedQuests: [...this.clearedQuests],
            bestTimes: { ...this.bestTimes },
            title: this.title,
        };
    }
    /** セーブデータから復元 */
    deserialize(data) {
        if (!data) return;
        this.materials = data.materials || {};
        this.weapons = (data.weapons || []).map(w => {
            const base = WEAPONS[w.id];
            if (!base) return null;
            const weapon = new Weapon(base.name, base.baseDamage, base.range, base.cooldown,
                base.knockback, base.type, base.style, base.desc);
            weapon.upgradeLevel = w.upgradeLevel || 0;
            weapon.damage = weapon.getEffectiveDamage();
            return weapon;
        }).filter(w => w !== null);
        if (this.weapons.length === 0) this.weapons = [WEAPONS.basicSword];
        this.armors = (data.armors || []).map(a => {
            const armor = new Armor(ARMORS.drakeArmor.name, ARMORS.drakeArmor.defense, ARMORS.drakeArmor.damageMultiplier);
            armor.upgradeLevel = a.upgradeLevel || 0;
            if (armor.upgradeLevel > 0) armor.damageMultiplier = ARMOR_UPGRADE_MULT[armor.upgradeLevel];
            return armor;
        });
        this.clearedQuests = new Set(data.clearedQuests || []);
        this.bestTimes = data.bestTimes || {};
        this.title = data.title || '';
    }
}

// ========================================
// プレイヤークラス（コンボ攻撃対応）
// ========================================
class Player {
    constructor(x, y, inventory) {
        this.x = x; this.y = y; this.width = 32; this.height = 32;
        this.speed = 260; this.maxHp = 100; this.hp = this.maxHp;
        this.maxStamina = 100; this.stamina = this.maxStamina;
        this.facing = 'down'; this.inventory = inventory;
        this.weapon = this.inventory.weapons[0]; this.weaponIndex = 0;
        this.armor = null;
        this.isAttacking = false; this.attackTimer = 0;
        this.attackCooldown = 0; this.attackDuration = 200;
        this.invincibleTimer = 0; this.invincibleDuration = 500;
        // 汎用コンボ
        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboWindow = 600;
        // チャージ攻撃（Iron Sword / Hunter Bow）
        this.charging = false;
        this.chargeTime = 0;
        this.chargeReady = false;
        // パリィシステム
        this.blocking = false;
        this.parryWindow = 0;      // パリィ判定残り(ms)
        this.parryBonus = 0;       // カウンターボーナス残り(ms)
        this.parryCooldown = 0;    // パリィのCD
        // Frost Blade 2連撃
        this.frostSecondHit = 0;
        this._frostSecondHitReady = false;
        // スロー効果（Ice Wolfの氷の息）
        this.slowTimer = 0;
        this.baseSpeed = this.speed;
        // レベル・EXPシステム
        this.level = 1;
        this.exp = 0;
        this.bonusDamage = 0; // レベルアップで加算
        // スキルパラメータ
        this.skillMeleeMult = 1.0;   // 近距離倍率
        this.skillBowCdMult = 1.0;   // 弓CD倍率
        this.skillDefMult = 1.0;     // 被ダメ倍率
        this.skillAtkSpdMult = 1.0;  // 攻撃速度倍率
        this.skillExtraDrop = 0;     // 追加ドロップ数
        this.skillShowHpNum = false; // モンスターHP数値表示
        this.acquiredSkills = [];    // 取得済みスキルID
    }
    getExpToNext() {
        if (this.level >= MAX_LEVEL) return Infinity;
        return EXP_TABLE[this.level - 1] || Infinity;
    }
    addExp(amount) {
        if (this.level >= MAX_LEVEL) return false;
        this.exp += amount;
        if (this.exp >= this.getExpToNext()) {
            this.exp -= this.getExpToNext();
            this.level++;
            this.maxHp += 20;
            this.hp = Math.min(this.maxHp, this.hp + 20);
            this.bonusDamage += 5;
            this.baseSpeed += 5;
            this.speed = this.baseSpeed;
            return true; // レベルアップした
        }
        return false;
    }
    cycleWeapon() {
        const w = this.inventory.weapons;
        if (w.length<=1) return;
        this.weaponIndex = (this.weaponIndex+1) % w.length;
        this.weapon = w[this.weaponIndex];
        this.comboCount = 0; this.comboTimer = 0;
    }
    equipBestArmor() {
        if (this.inventory.armors.length>0)
            this.armor = this.inventory.armors.reduce((b,a)=>a.defense>b.defense?a:b, this.inventory.armors[0]);
    }
    update(dt, keys, cw, ch, trees) {
        let dx=0, dy=0;
        if (keys['w']||keys['arrowup'])    {dy=-1;this.facing='up';}
        if (keys['s']||keys['arrowdown'])  {dy=1;this.facing='down';}
        if (keys['a']||keys['arrowleft'])  {dx=-1;this.facing='left';}
        if (keys['d']||keys['arrowright']) {dx=1;this.facing='right';}
        if (dx!==0&&dy!==0) { const l=Math.sqrt(dx*dx+dy*dy); dx/=l; dy/=l; }

        const newX = this.x + dx * this.speed * dt;
        const newY = this.y + dy * this.speed * dt;

        // 木との衝突判定
        let canMoveX = true, canMoveY = true;
        const pcx = newX + this.width/2, pcy = this.y + this.height/2;
        const pcx2 = this.x + this.width/2, pcy2 = newY + this.height/2;
        for (const tree of trees) {
            const tdx = pcx - tree.x, tdy = pcy - tree.y;
            if (Math.sqrt(tdx*tdx + tdy*tdy) < TREE_COLLISION_R + this.width/2) canMoveX = false;
            const tdx2 = pcx2 - tree.x, tdy2 = pcy2 - tree.y;
            if (Math.sqrt(tdx2*tdx2 + tdy2*tdy2) < TREE_COLLISION_R + this.height/2) canMoveY = false;
        }
        if (canMoveX) this.x = newX;
        if (canMoveY) this.y = newY;

        // ワールド端でクランプ（壁8px分）
        this.x = Math.max(10, Math.min(WORLD_W-this.width-10, this.x));
        this.y = Math.max(10, Math.min(WORLD_H-this.height-10, this.y));
        // エリア別移動速度修正
        const pcY = this.y + this.height/2, pcX = this.x + this.width/2;
        if (pcX > 1600 && pcY > 600 && pcY < 1200) this.speed = Math.floor(this.speed * 0.8); // 岩場-20%
        if (pcY > 1200) this.speed = Math.floor(this.speed * 0.7); // 沼-30%
        if (this.attackCooldown>0) this.attackCooldown -= dt*1000;
        if (this.attackTimer>0) { this.attackTimer -= dt*1000; if (this.attackTimer<=0) this.isAttacking=false; }
        if (this.invincibleTimer>0) this.invincibleTimer -= dt*1000;
        // コンボタイマー
        if (this.comboTimer>0) { this.comboTimer -= dt*1000; if (this.comboTimer<=0) this.comboCount=0; }
        // スロー効果
        if (this.slowTimer > 0) { this.slowTimer -= dt * 1000; this.speed = Math.floor(this.baseSpeed * 0.5); }
        else { this.speed = this.baseSpeed; }
        // ブロック中は移動速度半減
        if (this.blocking) this.speed = Math.floor(this.speed * 0.5);
        // パリィ・カウンタータイマー
        if (this.parryWindow > 0) this.parryWindow -= dt * 1000;
        if (this.parryBonus > 0) this.parryBonus -= dt * 1000;
        if (this.parryCooldown > 0) this.parryCooldown -= dt * 1000;
        // チャージタイマー・完了判定
        if (this.charging) {
            this.chargeTime += dt * 1000;
            const threshold = this.weapon.style === 'bow' ? 1000 : 800;
            if (this.chargeTime >= threshold) this.chargeReady = true;
        }
        // Frost Blade 2連撃目タイマー
        if (this.frostSecondHit > 0) {
            this.frostSecondHit -= dt * 1000;
            if (this.frostSecondHit <= 0) {
                this.isAttacking = true; this.attackTimer = this.attackDuration;
                this._frostSecondHitReady = true;
            }
        }
        this.equipBestArmor();
    }
    attack() {
        if (this.attackCooldown > 0) return null;
        this.isAttacking = true;
        this.attackTimer = this.attackDuration;
        const style = this.weapon.style;
        // コンボ進行（combo3/poison用）
        const maxCombo = style === 'poison' ? 3 : (style === 'combo3' ? 2 : 0);
        if (style === 'combo3' || style === 'poison') {
            if (this.comboTimer > 0 && this.comboCount < maxCombo) this.comboCount++;
            else if (this.comboTimer <= 0) this.comboCount = 0;
            this.comboTimer = this.comboWindow;
        } else {
            this.comboCount = 0;
        }
        let cdMult = this.skillAtkSpdMult;
        if (style === 'combo3' && this.comboCount === 2) cdMult *= 1.3;
        if (this.weapon.type === 'ranged') cdMult *= this.skillBowCdMult;
        this.attackCooldown = this.weapon.cooldown * cdMult;
        // Frost Blade: 自動2連撃（0.2秒後に2撃目フラグ）
        if (style === 'frost') this.frostSecondHit = 200;
        if (this.weapon.type === 'ranged') return null;
        return this.getAttackHitbox();
    }
    /** 現在のコンボ倍率を計算 */
    getComboMultiplier() {
        const s = this.weapon.style;
        if (s === 'combo3') return [1.0, 1.2, 1.8][this.comboCount] || 1.0;
        if (s === 'poison') return 1.0; // 各段固定
        if (s === 'charge' && this.chargeReady) return 80 / Math.max(1, this.weapon.damage); // チャージ時は80dmg相当
        return 1.0;
    }
    /** チャージ開始 */
    startCharge() {
        if (this.attackCooldown > 0) return;
        this.charging = true; this.chargeTime = 0; this.chargeReady = false;
    }
    /** チャージ解放 */
    releaseCharge() {
        this.charging = false;
        const wasReady = this.chargeReady;
        this.chargeReady = false;
        return wasReady;
    }
    /** ブロック開始 */
    startBlock() {
        if (this.parryCooldown > 0) return;
        this.blocking = true;
        this.parryWindow = 300; // パリィ受付0.3秒
    }
    /** ブロック解除 */
    stopBlock() { this.blocking = false; }
    getAttackHitbox() {
        const range=this.weapon.range, cx=this.x+this.width/2, cy=this.y+this.height/2;
        switch(this.facing) {
            case 'up': return {x:cx-20,y:cy-range-10,width:40,height:range};
            case 'down': return {x:cx-20,y:cy+10,width:40,height:range};
            case 'left': return {x:cx-range-10,y:cy-20,width:range,height:40};
            case 'right': return {x:cx+10,y:cy-20,width:range,height:40};
        }
    }
    /**
     * @returns {string} 'parry' | 'block' | 'hit'
     */
    takeDamage(amount) {
        if (this.invincibleTimer > 0) return 'hit';
        // パリィ判定
        if (this.blocking && this.parryWindow > 0) {
            this.parryBonus = 1000; // 1秒間カウンターボーナス
            this.parryCooldown = 500;
            this.invincibleTimer = 300;
            Sound.playHit();
            return 'parry';
        }
        // ブロック: 被ダメ-60%
        let blockMult = 1.0;
        if (this.blocking) blockMult = 0.4;
        const armorMult = this.armor ? this.armor.damageMultiplier : 1.0;
        const finalDmg = Math.max(1, Math.floor(amount * armorMult * this.skillDefMult * blockMult));
        this.hp = Math.max(0, this.hp - finalDmg);
        this.invincibleTimer = this.invincibleDuration;
        Sound.playDamage();
        return this.blocking ? 'block' : 'hit';
    }
    draw(ctx, img) {
        if (this.invincibleTimer>0 && Math.floor(this.invincibleTimer/80)%2===0) return;
        const sw=64, sh=64;
        const dx = this.x+this.width/2-sw/2, dy = this.y+this.height/2-sh/2;
        if (img) {
            ctx.save();
            if (this.facing==='left') { ctx.translate(dx+sw, dy); ctx.scale(-1,1); ctx.drawImage(img,0,0,sw,sh); }
            else ctx.drawImage(img, dx, dy, sw, sh);
            ctx.restore();
        } else {
            ctx.fillStyle = this.armor ? '#aaddff' : '#ffffff';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        if (this.isAttacking && this.attackTimer>0 && this.weapon.type==='melee') this.drawAttackEffect(ctx);
        this.drawChargeEffect(ctx);
        // ブロック表示
        if (this.blocking) {
            const cx = this.x+this.width/2, cy = this.y+this.height/2;
            ctx.strokeStyle = this.parryWindow > 0 ? 'rgba(255,220,50,0.6)' : 'rgba(150,150,255,0.4)';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI*2); ctx.stroke();
        }
        // パリィカウンターボーナス表示
        if (this.parryBonus > 0) {
            ctx.fillStyle = `rgba(255,200,50,${Math.min(1,this.parryBonus/300)*0.3})`;
            ctx.beginPath(); ctx.arc(this.x+this.width/2, this.y+this.height/2, 26, 0, Math.PI*2); ctx.fill();
        }
    }
    drawAttackEffect(ctx) {
        const hb = this.getAttackHitbox(); if (!hb) return;
        const alpha = this.attackTimer / this.attackDuration;
        const s = this.weapon.style;
        const cx = this.x+this.width/2, cy = this.y+this.height/2;
        // スタイル別カラー
        let col = 'rgba(255,255,100,';
        if (s === 'frost')  col = 'rgba(100,200,255,';
        if (s === 'hammer') col = 'rgba(255,150,50,';
        if (s === 'poison') col = 'rgba(100,255,100,';
        if (s === 'combo3' && this.comboCount >= 2) col = 'rgba(255,120,30,';
        ctx.fillStyle = col + (alpha*0.6) + ')';
        ctx.fillRect(hb.x, hb.y, hb.width, hb.height);
        // ハンマー: 衝撃波
        if (s === 'hammer') {
            ctx.strokeStyle = `rgba(255,200,50,${alpha*0.5})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(cx, cy, this.weapon.range + 15, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, this.weapon.range + 30, 0, Math.PI*2); ctx.stroke();
        }
        // combo3段目: 大きい範囲
        if (s === 'combo3' && this.comboCount === 2) {
            ctx.fillStyle = `rgba(255,180,50,${alpha*0.3})`;
            ctx.beginPath(); ctx.arc(cx, cy, this.weapon.range + 10, 0, Math.PI*2); ctx.fill();
        }
        // スラッシュライン
        ctx.strokeStyle = `rgba(255,255,200,${alpha})`;
        ctx.lineWidth = 3 + (s === 'hammer' ? 3 : this.comboCount);
        ctx.beginPath();
        switch(this.facing) {
            case 'up': ctx.moveTo(cx-15,cy-5);ctx.lineTo(cx+15,cy-this.weapon.range-5);break;
            case 'down': ctx.moveTo(cx-15,cy+5);ctx.lineTo(cx+15,cy+this.weapon.range+5);break;
            case 'left': ctx.moveTo(cx-5,cy-15);ctx.lineTo(cx-this.weapon.range-5,cy+15);break;
            case 'right': ctx.moveTo(cx+5,cy-15);ctx.lineTo(cx+this.weapon.range+5,cy+15);break;
        }
        ctx.stroke();
    }
    drawChargeEffect(ctx) {
        if (!this.charging) return;
        const cx = this.x+this.width/2, cy = this.y+this.height/2;
        const threshold = this.weapon.style === 'bow' ? 1000 : 800;
        const progress = Math.min(1, this.chargeTime / threshold);
        const col = this.chargeReady ? 'rgba(255,200,50,' : 'rgba(200,200,255,';
        ctx.strokeStyle = col + (0.3+progress*0.4) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 20+progress*10, 0, Math.PI*2*progress); ctx.stroke();
        if (this.chargeReady) {
            ctx.fillStyle = 'rgba(255,220,50,0.15)';
            ctx.beginPath(); ctx.arc(cx, cy, 28, 0, Math.PI*2); ctx.fill();
        }
    }
}

// ========================================
// モンスタークラス（遅延HPバー対応）
// ========================================
class Monster {
    constructor(name, x, y, config={}) {
        this.name=name; this.x=x; this.y=y;
        this.width=config.width||64; this.height=config.height||64;
        this.speed=config.speed||80; this.baseSpeed=this.speed;
        this.color=config.color||'#cc3333';
        this.maxHp=config.hp||500; this.hp=this.maxHp;
        this.displayHp = this.maxHp; // 遅延表示用HP
        this.attackDamage=config.attackDamage||10; this.attackRange=config.attackRange||50;
        this.attackCooldown=config.attackCooldown||1000; this.attackTimer=0;
        this.aggroRange=config.aggroRange||300;
        this.state='idle'; this.dropTableId=config.dropTableId||'forestDrake';
        this.hitFlashTimer=0; this.alive=true; this.spawnX=x; this.spawnY=y;
        this.isBoss=config.isBoss||false;
        this.chargeWindupTimer=0; this.chargeWindupDuration=500;
        this.chargeDuration=600; this.chargeTimer=0;
        this.chargeSpeed=350; this.chargeDamage=20;
        this.chargeCooldown=5000; this.chargeCooldownTimer=0;
        this.chargeDir={x:0,y:0}; this.chargeHitDealt=false;
        // スロー効果（Frost Blade等で付与）
        this.slowTimer = 0;
        // Ice Wolf: 氷の息
        this.isIceWolf = config.isIceWolf || false;
        this.iceBreathCooldown = 3000; // 3秒ごと
        this.iceBreathTimer = this.iceBreathCooldown;
        // Giant Drake 第2形態
        this.phase2 = false;
        // Elder Drake AI
        this.isElder = config.isElder || false;
        this.elderSkillTimer = 3000;  // 特殊行動間隔
        this.elderRage = false;       // 激昂状態
        // 部位破壊（Drake系のみ）
        this.hasParts = !this.isIceWolf;
        const partHp = Math.floor(this.maxHp * 0.3);
        this.headHp = this.hasParts ? partHp : 0;
        this.headMaxHp = this.headHp;
        this.headBroken = false;
        this.tailHp = this.hasParts ? partHp : 0;
        this.tailMaxHp = this.tailHp;
        this.tailBroken = false;
        this.baseAttackDamage = this.attackDamage;
        // 弱点属性: 'ice' | null
        this.weakness = (this.name === 'Forest Drake' || this.name === 'Giant Drake') ? 'ice' : null;
        this.weaknessMult = this.isBoss ? 1.3 : 1.5;
        // 凍結システム（Frost Blade用）
        this.frostCount = 0;      // 凍結カウンター（3でフリーズ）
        this.frozenTimer = 0;     // 凍結中タイマー(ms)
        this.frozenDmgMult = 1.2; // 凍結中の被ダメ倍率
        // 毒システム（Poison Dagger用）
        this.poisonTimer = 0;     // 毒の残り時間(ms)
        this.poisonTickTimer = 0; // 毒ダメージ間隔タイマー
    }
    update(dt, player, game) {
        if (!this.alive) return;
        // 遅延HPバー更新
        if (this.displayHp > this.hp) {
            this.displayHp = Math.max(this.hp, this.displayHp - this.maxHp * dt * 0.8);
        }
        // 凍結中は動けない
        if (this.frozenTimer > 0) {
            this.frozenTimer -= dt * 1000;
            if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt * 1000;
            return;
        }
        // 毒ダメージ処理
        if (this.poisonTimer > 0) {
            this.poisonTimer -= dt * 1000;
            this.poisonTickTimer -= dt * 1000;
            if (this.poisonTickTimer <= 0) {
                this.poisonTickTimer = 1000;
                this.hp = Math.max(0, this.hp - 10);
                this.hitFlashTimer = 80;
                if (game) game.damageNumbers.push(new DamageNumber(
                    this.x+this.width/2, this.y-10, 10, '#44cc44', 'POISON'));
                if (this.hp <= 0) { this.alive = false; this.state = 'dead'; return; }
            }
        }
        // スロータイマー
        if (this.slowTimer > 0) this.slowTimer -= dt * 1000;
        const speedMult = this.slowTimer > 0 ? 0.5 : 1.0;
        // Giant Drake 第2形態チェック
        if (this.isBoss && !this.phase2 && this.hp <= this.maxHp * 0.5) {
            this.phase2 = true;
            this.speed = Math.floor(this.baseSpeed * 1.3);
            this.chargeCooldown = 2500; // 突進頻度2倍
            this.color = '#331111';     // 黒赤色に変化
        }
        const dx=(player.x+player.width/2)-(this.x+this.width/2);
        const dy=(player.y+player.height/2)-(this.y+this.height/2);
        const dist=Math.sqrt(dx*dx+dy*dy);
        if (this.attackTimer>0) this.attackTimer-=dt*1000;
        if (this.hitFlashTimer>0) this.hitFlashTimer-=dt*1000;
        if (this.chargeCooldownTimer>0) this.chargeCooldownTimer-=dt*1000;
        // Ice Wolf: 氷の息発射
        if (this.isIceWolf && this.state === 'chase' && game) {
            this.iceBreathTimer -= dt * 1000;
            if (this.iceBreathTimer <= 0) {
                this.iceBreathTimer = this.iceBreathCooldown;
                const d = dist || 1;
                game.spawnIceBreath(
                    this.x + this.width/2, this.y + this.height/2,
                    dx / d, dy / d
                );
            }
        }
        if (this.state==='charge_windup') {
            this.chargeWindupTimer-=dt*1000;
            if (this.chargeWindupTimer<=0) {
                this.state='charging'; this.chargeTimer=this.chargeDuration; this.chargeHitDealt=false;
                const d=Math.sqrt(dx*dx+dy*dy)||1;
                this.chargeDir={x:dx/d,y:dy/d};
            }
            return;
        }
        if (this.state==='charging') {
            this.chargeTimer-=dt*1000;
            this.x+=this.chargeDir.x*this.chargeSpeed*dt;
            this.y+=this.chargeDir.y*this.chargeSpeed*dt;
            this.x=Math.max(10,Math.min(WORLD_W-this.width-10,this.x));
            this.y=Math.max(10,Math.min(WORLD_H-this.height-10,this.y));
            if (!this.chargeHitDealt) {
                const cd=Math.sqrt(((player.x+player.width/2)-(this.x+this.width/2))**2+((player.y+player.height/2)-(this.y+this.height/2))**2);
                if (cd<this.width/2+player.width/2) { player.takeDamage(this.chargeDamage); this.chargeHitDealt=true; }
            }
            if (this.chargeTimer<=0) { this.state='idle'; this.chargeCooldownTimer=this.chargeCooldown; }
            return;
        }
        // Elder Drake: 激昂チェック
        if (this.isElder && !this.elderRage && this.hp <= this.maxHp * 0.3) {
            this.elderRage = true;
            this.speed = Math.floor(this.baseSpeed * 1.5);
            this.attackDamage = Math.floor(this.baseAttackDamage * 1.3);
            this.color = '#440044';
        }
        // Elder Drake: 特殊行動
        if (this.isElder && dist < this.aggroRange && game) {
            this.elderSkillTimer -= dt * 1000 * (this.elderRage ? 1.5 : 1.0);
            if (this.elderSkillTimer <= 0) {
                this.elderSkillTimer = this.elderRage ? 2000 : 3000;
                const skill = Math.floor(Math.random() * 3);
                const cx = this.x+this.width/2, cy = this.y+this.height/2;
                if (skill === 0) {
                    // 炎ブレス: 前方に範囲ダメージ
                    const d = dist||1;
                    const ndx = (player.x+player.width/2-cx)/d, ndy = (player.y+player.height/2-cy)/d;
                    if (dist < 200) { player.takeDamage(this.elderRage ? 52 : 40); }
                    for (let i=0;i<10;i++) { const a=Math.atan2(ndy,ndx)+(Math.random()-0.5)*1;
                        game.particles.push(new Particle(cx,cy,Math.cos(a)*200,Math.sin(a)*200,'#ff6622',400,4)); }
                } else if (skill === 1) {
                    // 尻尾薙ぎ: 後方
                    if (dist < 120) { player.takeDamage(this.elderRage ? 45 : 35); }
                    for (let i=0;i<8;i++) { const a=Math.random()*Math.PI*2;
                        game.particles.push(new Particle(cx,cy,Math.cos(a)*100,Math.sin(a)*100,'#aa4422',300,3)); }
                } else {
                    // 咆哮: スタン（2秒移動不能）
                    player.slowTimer = 2000;
                    game.damageNumbers.push(new DamageNumber(cx,cy-40,0,'#ff8844','ROAR!'));
                    for (let i=0;i<12;i++) { const a=Math.random()*Math.PI*2;
                        game.particles.push(new Particle(cx,cy,Math.cos(a)*150,Math.sin(a)*150,'#ffaa44',500,2)); }
                    Sound.playChargeWarning();
                }
            }
        }
        if (this.isBoss&&this.hp<=this.maxHp*0.5&&this.chargeCooldownTimer<=0&&dist<this.aggroRange) {
            this.state='charge_windup'; this.chargeWindupTimer=this.chargeWindupDuration;
            Sound.playChargeWarning(); this.chargeCooldownTimer=this.chargeCooldown; return;
        }
        if (dist<=this.attackRange) {
            this.state='attack';
            if (this.attackTimer<=0) {
                const result = player.takeDamage(this.attackDamage);
                this.attackTimer=this.attackCooldown;
                if (result === 'hit' || result === 'block') {
                    if (game) game.subQuestState.damageTaken++;
                }
                if (result === 'parry') {
                    this.frozenTimer = 1000;
                    if (game) { game.subQuestState.parryCount++;
                        game.damageNumbers.push(new DamageNumber(this.x+this.width/2,this.y-30,0,'#ffcc00','PARRY!'));
                        for (let i=0;i<6;i++) { const a=Math.random()*Math.PI*2; game.particles.push(new Particle(player.x+player.width/2,player.y+player.height/2,Math.cos(a)*80,Math.sin(a)*80-30,'#ffcc00',300,3)); }
                    }
                }
            }
        } else if (dist<=this.aggroRange) {
            this.state='chase';
            this.x+=dx/dist*this.speed*speedMult*dt; this.y+=dy/dist*this.speed*speedMult*dt;
        } else this.state='idle';
    }
    /**
     * @param {number} amount - ダメージ量
     * @param {number} kbx - ノックバックX
     * @param {number} kby - ノックバックY
     * @param {number} hitX - ヒットX座標（部位判定用）
     * @param {number} hitY - ヒットY座標（部位判定用）
     * @returns {Object} { partBroken: string|null }
     */
    takeDamage(amount, kbx=0, kby=0, hitX=0, hitY=0) {
        if (!this.alive) return { partBroken: null };
        // 凍結中は被ダメ増加
        const frozenMult = this.frozenTimer > 0 ? this.frozenDmgMult : 1.0;
        amount = Math.floor(amount * frozenMult);
        this.hp=Math.max(0,this.hp-amount); this.hitFlashTimer=150;
        if (this.state!=='charging'&&this.state!=='charge_windup') { this.x+=kbx; this.y+=kby; }
        // 部位ダメージ
        let partBroken = null;
        if (this.hasParts && hitX && hitY) {
            const relX = hitX - this.x;
            const relY = hitY - this.y;
            // 頭エリア: 上1/3
            if (relY < this.height / 3 && !this.headBroken) {
                this.headHp = Math.max(0, this.headHp - amount);
                if (this.headHp <= 0) {
                    this.headBroken = true;
                    this.attackDamage = Math.floor(this.baseAttackDamage * 0.7);
                    partBroken = 'head';
                }
            }
            // 尻尾エリア: 右1/3
            if (relX > this.width * 2 / 3 && !this.tailBroken) {
                this.tailHp = Math.max(0, this.tailHp - amount);
                if (this.tailHp <= 0) {
                    this.tailBroken = true;
                    this.speed = Math.floor(this.speed * 0.7);
                    partBroken = 'tail';
                }
            }
        }
        if (this.hp<=0) { this.alive=false; this.state='dead'; }
        return { partBroken };
    }
    respawn() {
        this.hp=this.maxHp; this.displayHp=this.maxHp; this.alive=true; this.state='idle';
        this.x=this.spawnX; this.y=this.spawnY;
        this.attackTimer=0; this.hitFlashTimer=0; this.slowTimer=0;
        this.chargeCooldownTimer=0; this.chargeTimer=0; this.chargeWindupTimer=0;
        this.phase2=false; this.speed=this.baseSpeed;
        this.frostCount=0; this.frozenTimer=0; this.poisonTimer=0; this.poisonTickTimer=0;
    }
    generateDrops() {
        const drops=[], table=DROP_TABLES[this.dropTableId]; if (!table) return drops;
        const cx=this.x+this.width/2, cy=this.y+this.height/2;
        for (const e of table) {
            if (Math.random()<e.chance) {
                const c=e.minCount+Math.floor(Math.random()*(e.maxCount-e.minCount+1));
                const item=new DroppedItem(cx,cy,e.materialId,c); item.setScatter(cx,cy); drops.push(item);
            }
        }
        return drops;
    }
    draw(ctx, img) {
        if (!this.alive) return;
        // Ice Wolf は画像なしで水色四角描画
        if (this.isIceWolf) {
            const col = this.hitFlashTimer > 0 ? '#ffffff' : (this.slowTimer > 0 ? '#6699aa' : '#88ccee');
            ctx.fillStyle = col;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            // 目
            ctx.fillStyle = '#225588';
            ctx.fillRect(this.x + 8, this.y + 12, 8, 6);
            ctx.fillRect(this.x + this.width - 16, this.y + 12, 8, 6);
            ctx.fillStyle = '#112244';
            ctx.fillRect(this.x + 11, this.y + 14, 3, 3);
            ctx.fillRect(this.x + this.width - 13, this.y + 14, 3, 3);
            // 耳
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.moveTo(this.x + 4, this.y); ctx.lineTo(this.x - 4, this.y - 12);
            ctx.lineTo(this.x + 14, this.y); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(this.x + this.width - 14, this.y);
            ctx.lineTo(this.x + this.width + 4, this.y - 12);
            ctx.lineTo(this.x + this.width - 4, this.y); ctx.closePath(); ctx.fill();
            // スロー時の氷エフェクト
            if (this.slowTimer > 0) {
                ctx.strokeStyle = 'rgba(100,200,255,0.5)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(this.x+this.width/2, this.y+this.height/2, this.width*0.6, 0, Math.PI*2); ctx.stroke();
            }
            return;
        }
        const sw=this.isBoss?144:96, sh=sw;
        const dx=this.x+this.width/2-sw/2, dy=this.y+this.height/2-sh/2;
        if (this.state==='charge_windup') {
            const p=1-(this.chargeWindupTimer/this.chargeWindupDuration);
            const cx=this.x+this.width/2, cy=this.y+this.height/2;
            const pa=0.3+Math.sin(p*Math.PI*4)*0.2;
            ctx.strokeStyle=`rgba(255,50,50,${pa})`; ctx.lineWidth=3;
            ctx.beginPath(); ctx.arc(cx,cy,sw*0.5+p*20,0,Math.PI*2); ctx.stroke();
            ctx.fillStyle=`rgba(255,0,0,${pa*0.3})`;
            ctx.beginPath(); ctx.arc(cx,cy,sw*0.4,0,Math.PI*2); ctx.fill();
        }
        if (this.state==='charging'&&img) {
            ctx.save(); ctx.globalAlpha=0.2;
            ctx.drawImage(img,dx-this.chargeDir.x*25,dy-this.chargeDir.y*25,sw,sh);
            ctx.restore();
        }
        if (img) {
            ctx.save();
            if (this.hitFlashTimer>0) {
                ctx.globalAlpha=0.6;
                ctx.drawImage(img,dx,dy,sw,sh);
                ctx.globalCompositeOperation='source-atop';
                ctx.fillStyle='rgba(255,80,80,0.5)'; ctx.fillRect(dx,dy,sw,sh);
                ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
            } else if (this.state==='charging') {
                ctx.drawImage(img,dx,dy,sw,sh);
                ctx.globalCompositeOperation='source-atop';
                ctx.fillStyle='rgba(255,100,30,0.3)'; ctx.fillRect(dx,dy,sw,sh);
                ctx.globalCompositeOperation='source-over';
            } else ctx.drawImage(img,dx,dy,sw,sh);
            ctx.restore();
        } else {
            ctx.fillStyle=this.hitFlashTimer>0?'#fff':(this.state==='charging'?'#ff6633':this.color);
            ctx.fillRect(this.x,this.y,this.width,this.height);
        }
        // 凍結エフェクト
        if (this.frozenTimer > 0) {
            ctx.save(); ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#88ddff';
            ctx.fillRect(this.x-2, this.y-2, this.width+4, this.height+4);
            ctx.restore();
            ctx.strokeStyle = '#aaeeff'; ctx.lineWidth = 2;
            ctx.strokeRect(this.x-2, this.y-2, this.width+4, this.height+4);
        }
        // 毒エフェクト
        if (this.poisonTimer > 0) {
            ctx.save();
            ctx.globalAlpha = 0.15 + Math.sin(Date.now()*0.008)*0.1;
            ctx.fillStyle = '#33cc33';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.restore();
        }
        // 凍結カウンター表示（●）
        if (this.frostCount > 0 && this.frozenTimer <= 0) {
            ctx.fillStyle = '#88ddff'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
            let dots = '';
            for (let i=0;i<3;i++) dots += i < this.frostCount ? '\u25cf' : '\u25cb';
            ctx.fillText(dots, this.x+this.width/2, this.y+this.height+12);
        }
        // 部位破壊マーカー
        if (this.hasParts) {
            if (this.headBroken) {
                ctx.strokeStyle='rgba(255,100,100,0.6)'; ctx.lineWidth=2;
                ctx.strokeRect(this.x, this.y, this.width, this.height/3);
            }
            if (this.tailBroken) {
                ctx.strokeStyle='rgba(255,100,100,0.6)'; ctx.lineWidth=2;
                ctx.strokeRect(this.x+this.width*2/3, this.y, this.width/3, this.height);
            }
        }
    }
}

// ========================================
// 角丸矩形ヘルパー
// ========================================
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
}

// ========================================
// ゲームメインクラス
// ========================================
class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
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

    /** ロビー背景（星・山・森・月）のプリレンダリング */
    generateLobbyBg() {
        const c = document.createElement('canvas'); c.width = 800; c.height = 600;
        const g = c.getContext('2d');
        // グラデーション背景
        const grad = g.createLinearGradient(0, 0, 0, 600);
        grad.addColorStop(0, '#0a0a1a');
        grad.addColorStop(1, '#1a0a0a');
        g.fillStyle = grad; g.fillRect(0, 0, 800, 600);
        // 星（100個・シード固定）
        const rng = new SeededRandom(77);
        for (let i = 0; i < 100; i++) {
            const sx = rng.next() * 800, sy = rng.next() * 400;
            const sr = 0.5 + rng.next() * 1.5;
            g.fillStyle = `rgba(255,255,255,${0.3 + rng.next() * 0.5})`;
            g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
        }
        // 満月（右上）
        g.fillStyle = 'rgba(255,255,220,0.06)';
        g.beginPath(); g.arc(680, 80, 60, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,220,0.1)';
        g.beginPath(); g.arc(680, 80, 35, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,230,0.7)';
        g.beginPath(); g.arc(680, 80, 22, 0, Math.PI * 2); g.fill();
        // 遠景の山シルエット
        g.fillStyle = '#0c0c18';
        g.beginPath(); g.moveTo(0, 500);
        g.lineTo(80, 380); g.lineTo(180, 440); g.lineTo(280, 360); g.lineTo(400, 420);
        g.lineTo(500, 340); g.lineTo(600, 400); g.lineTo(720, 350); g.lineTo(800, 410);
        g.lineTo(800, 600); g.lineTo(0, 600); g.closePath(); g.fill();
        // 中景の森シルエット
        g.fillStyle = '#080812';
        g.beginPath(); g.moveTo(0, 520);
        for (let x = 0; x <= 800; x += 20) {
            const h = 480 + Math.sin(x * 0.02) * 30 + Math.sin(x * 0.05) * 15;
            g.lineTo(x, h - (x % 40 < 20 ? 15 : 0));
        }
        g.lineTo(800, 600); g.lineTo(0, 600); g.closePath(); g.fill();
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
        const files = { player:'assets/player.png', forestDrake:'assets/forest_drake.png', giantDrake:'assets/giant_drake.png' };
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
            const cw=600,ch=100,cx=(800-cw)/2; let cy=120;
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
        this.camera.x = this.player.x + this.player.width/2 - this.canvas.width/2;
        this.camera.y = this.player.y + this.player.height/2 - this.canvas.height/2;
        this.camera.x = Math.max(0, Math.min(WORLD_W - this.canvas.width, this.camera.x));
        this.camera.y = Math.max(0, Math.min(WORLD_H - this.canvas.height, this.camera.y));
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
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, 800, 600);
        const pw = 300, ph = 220, px = (800-pw)/2, py = (600-ph)/2;
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
                this.camera.x, this.camera.y, 800, 600,
                this.camera.x, this.camera.y, 800, 600);
        } else {
            ctx.fillStyle = '#2d5a27'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
        }

        for (const item of this.droppedItems) { ctx.save(); item.draw(ctx); ctx.restore(); }
        for (const arrow of this.arrows) { ctx.save(); arrow.draw(ctx); ctx.restore(); }
        for (const m of this.monsters) {
            ctx.save();
            const mImg = m.isIceWolf ? null : (m.isBoss ? this.images.giantDrake : this.images.forestDrake);
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
            const g = ctx.createRadialGradient(400, 300, 200, 400, 300, 450);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, `rgba(150,0,0,${pa})`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 600);
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
                const mBarX=(800-mBarW)/2;
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
                ctx.fillStyle = m.isBoss ? '#cc6622' : '#cc3333';
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
        const eqX=this.canvas.width-210; let eqY=this.canvas.height-55;
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
        ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(0,0,800,600);
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
        ctx.fillRect(0,0,800,600);
        // 黒オーバーレイ
        ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, t*0.4)})`;
        ctx.fillRect(0,0,800,600);
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
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,800,600);
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
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 800, 600);
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
            ctx.fillRect(0, 0, 800, 600);
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
        ctx.fillRect(0, 0, 800, 600);
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
        const mmX = this.canvas.width - mmW - 10, mmY = 10;
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
            800 * scaleX,
            600 * scaleY
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

        // === プリレンダリング背景 ===
        if (this.lobbyBgCanvas) ctx.drawImage(this.lobbyBgCanvas, 0, 0);
        else { ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, 800, 600); }

        // === 星の明滅（動的レイヤー） ===
        const rng2 = new SeededRandom(77);
        for (let i = 0; i < 100; i++) {
            const sx = rng2.next() * 800, sy = rng2.next() * 400;
            const sr = 0.5 + rng2.next() * 1.5;
            const flicker = 0.3 + Math.sin(t * (1.5 + rng2.next() * 2) + i) * 0.3;
            ctx.fillStyle = `rgba(255,255,255,${flicker})`;
            ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
        }

        // === 龍のシルエット ===
        ctx.save();
        const dragonY = 180 + Math.sin(t * Math.PI / 2) * 15;
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#000';
        // 胴体
        ctx.beginPath(); ctx.ellipse(680, dragonY, 80, 50, 0, 0, Math.PI * 2); ctx.fill();
        // 頭
        ctx.beginPath(); ctx.ellipse(610, dragonY - 30, 30, 25, -0.3, 0, Math.PI * 2); ctx.fill();
        // 尾
        ctx.beginPath(); ctx.moveTo(760, dragonY); ctx.quadraticCurveTo(810, dragonY + 20, 790, dragonY + 60); ctx.lineTo(770, dragonY + 40); ctx.closePath(); ctx.fill();
        // 翼（開閉アニメーション）
        const wingSpread = 0.8 + Math.sin(t * 1.5) * 0.2;
        ctx.beginPath();
        ctx.moveTo(660, dragonY - 20);
        ctx.lineTo(660 - 80 * wingSpread, dragonY - 80 * wingSpread);
        ctx.lineTo(660 - 30, dragonY - 10);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(700, dragonY - 20);
        ctx.lineTo(700 + 70 * wingSpread, dragonY - 70 * wingSpread);
        ctx.lineTo(700 + 25, dragonY - 10);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        // === 火の粉パーティクル ===
        for (let i = 0; i < 20; i++) {
            const fx = (i * 43 + t * 20) % 800;
            const fy = 580 - ((t * 25 + i * 30) % 600);
            const fa = 0.15 + Math.sin(t * 3 + i * 2) * 0.1;
            ctx.fillStyle = `rgba(255,${130 + i * 5},30,${fa})`;
            ctx.beginPath(); ctx.arc(fx, fy, 1.5, 0, Math.PI * 2); ctx.fill();
        }

        // === タイトルロゴ ===
        ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center';
        // 影
        ctx.fillStyle = '#331a00'; ctx.fillText('MONSTER HUNT 2D', 402, 42);
        // 本体（ゴールド）
        ctx.fillStyle = '#ffcc44'; ctx.fillText('MONSTER HUNT 2D', 400, 40);
        // アンダーライン（流れる光）
        const lineProgress = (t * 0.4) % 1;
        const lineGrad = ctx.createLinearGradient(100, 0, 700, 0);
        lineGrad.addColorStop(Math.max(0, lineProgress - 0.15), 'rgba(255,80,30,0)');
        lineGrad.addColorStop(lineProgress, 'rgba(255,80,30,0.8)');
        lineGrad.addColorStop(Math.min(1, lineProgress + 0.15), 'rgba(255,80,30,0)');
        ctx.strokeStyle = lineGrad; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(150, 48); ctx.lineTo(650, 48); ctx.stroke();
        // サブタイトル
        ctx.fillStyle = '#887755'; ctx.font = 'italic 13px monospace';
        ctx.fillText('Hunt. Craft. Survive.', 400, 65);

        // === クエストカード（2列グリッド） ===
        const cardW = 355, cardH = 120, gap = 8;
        const colX = [15, 415 - 15 + 15]; // 左=15, 右=415
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
            ctx.fillStyle = sel ? 'rgba(30,20,50,0.9)' : 'rgba(20,10,30,0.85)';
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
        ctx.fillStyle = 'rgba(10,10,20,0.75)';
        roundRect(ctx, 10, 475, 210, 110, 8); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        roundRect(ctx, 10, 475, 210, 110, 8); ctx.stroke();
        // プレイヤーアイコン（簡易シルエット）
        ctx.fillStyle = '#2a6a2a';
        ctx.beginPath(); ctx.arc(35, 500, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(29, 510, 12, 15);
        // レベル・称号
        const pLvl = this.player ? this.player.level : (this.inventory._lastLevel || 1);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
        ctx.fillText(`Lv ${pLvl}`, 55, 502);
        ctx.fillStyle = '#cc9944'; ctx.font = '11px monospace';
        ctx.fillText(this.inventory.title || 'Novice', 55, 518);
        // 討伐数
        ctx.fillStyle = '#888'; ctx.font = '10px monospace';
        ctx.fillText(`Total Hunts: ${this.totalHunts}`, 18, 545);
        // EXPバー
        if (this.player) {
            const expR = this.player.level >= MAX_LEVEL ? 1 : this.player.exp / this.player.getExpToNext();
            ctx.fillStyle = '#222'; roundRect(ctx, 18, 555, 190, 8, 3); ctx.fill();
            ctx.save(); roundRect(ctx, 18, 555, 190, 8, 3); ctx.clip();
            ctx.fillStyle = '#4488cc'; ctx.fillRect(18, 555, 190 * expR, 8);
            ctx.restore();
            ctx.strokeStyle = '#444'; ctx.lineWidth = 1; roundRect(ctx, 18, 555, 190, 8, 3); ctx.stroke();
            ctx.fillStyle = '#666'; ctx.font = '8px monospace';
            ctx.fillText(this.player.level >= MAX_LEVEL ? 'MAX' : `${this.player.exp}/${this.player.getExpToNext()} EXP`, 18, 575);
        }

        // === 操作ガイド（最下部固定） ===
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
        const taLabel = this.timeAttackMode ? ' [TA:ON]' : '';
        ctx.fillText(`W/S:Select  Z:Start  T:TimeAtk${taLabel}  I:Inv  C:Craft`, 500, 592);
        ctx.restore();
    }
    getDifficultyStars(l) { let s='';for(let i=0;i<3;i++)s+=i<l?'\u2605':'\u2606';return s; }

    drawInventory(ctx) {
        ctx.save(); ctx.globalAlpha = 1;
        // 全画面オーバーレイ
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, 800, 600);
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
        ctx.fillRect(0, 0, 800, 600);
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
