// ========================================
// 定数・データ定義
// ========================================
export const MATERIALS = {
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
export const UPGRADE_COSTS = {
    // +1: 同素材x2, +2: 同素材x4+Core x1, +3: 同素材x6+Core x2
    ironSword:    { mat: 'drakeScale', costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
    hunterBow:    { mat: 'drakeFang',  costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
    frostBlade:   { mat: 'iceFang',    costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
    warHammer:    { mat: 'drakeScale', costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
    poisonDagger: { mat: 'drakeFang',  costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
    drakeArmor:   { mat: 'drakeScale', costs: [{m:2,c:0},{m:4,c:1},{m:6,c:2}] },
};
export const UPGRADE_DMG_MULT = [1.0, 1.1, 1.25, 1.5];
export const ARMOR_UPGRADE_MULT = [0.7, 0.6, 0.5, 0.4];

// サブクエスト条件
export const SUB_QUESTS = [
    { id: 'noDamage',   name: 'スタイリッシュ', desc: '被ダメージ0で討伐', rewardType: 'expMult', rewardVal: 2 },
    { id: 'speedRun',   name: 'スピードラン',   desc: '60秒以内に討伐',    rewardType: 'matMult', rewardVal: 2 },
    { id: 'partBreak',  name: '部位破壊',       desc: '頭と尻尾を両方破壊', rewardType: 'specialDrop', rewardVal: 1 },
    { id: 'parryMaster',name: 'パリィマスター', desc: '3回以上パリィ成功', rewardType: 'coreDrop', rewardVal: 1 },
];

// EXP・レベルアップ定数
export const EXP_TABLE = [0, 200, 500, 1000, 2000]; // Lv1→2, 2→3, ...
export const MONSTER_EXP = { 'Forest Drake': 100, 'Ice Wolf': 80, 'Giant Drake': 500 };
export const MAX_LEVEL = 5;

// スキル定義
export const SKILLS = [
    { id: 'powerSword', name: '剛剣',   desc: '近距離武器ダメージ+20%',  apply: (p) => { p.skillMeleeMult *= 1.2; } },
    { id: 'rapidFire',  name: '速射',   desc: '弓のクールダウン-30%',    apply: (p) => { p.skillBowCdMult *= 0.7; } },
    { id: 'ironWall',   name: '鉄壁',   desc: '被ダメージ-15%',         apply: (p) => { p.skillDefMult *= 0.85; } },
    { id: 'swiftWind',  name: '疾風',   desc: '移動速度+20%',           apply: (p) => { p.baseSpeed = Math.floor(p.baseSpeed * 1.2); p.speed = p.baseSpeed; } },
    { id: 'heal',       name: '回復',   desc: 'HP最大値+30・即時回復30', apply: (p) => { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); } },
    { id: 'flurry',     name: '連撃',   desc: '攻撃速度+25%',           apply: (p) => { p.skillAtkSpdMult *= 0.75; } },
    { id: 'mining',     name: '採掘',   desc: '素材ドロップ数+1',        apply: (p) => { p.skillExtraDrop++; } },
    { id: 'insight',    name: '看破',   desc: 'モンスターHP数値表示',     apply: (p) => { p.skillShowHpNum = true; } },
];

export const DROP_TABLES = {
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
export const WORLD_W = 2400, WORLD_H = 1800;

// エリア定義（座標とタイプ）
export const AREAS = [
    { name: 'grassland', color: '#2d5a27', x: 0, y: 600, w: 2400, h: 600 },        // 中央草原
    { name: 'forest',    color: '#1a3a18', x: 0, y: 0,   w: 2400, h: 600 },        // 北の森
    { name: 'rocks',     color: '#4a4a50', x: 1600, y: 600, w: 800, h: 600 },      // 東の岩場
    { name: 'swamp',     color: '#1a3a30', x: 0, y: 1200, w: 2400, h: 600 },       // 南の沼
];

// 木の配置データ（ワールド全体に配置）
export const TREES = [
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
export const TREE_TRUNK_R = 12;
export const TREE_CANOPY_R = 28;
export const TREE_COLLISION_R = 18;

export const QUESTS = [
    {
        id: 'forestDrake', name: 'Forest Drake討伐',
        description: 'Forest Drakeを1体討伐せよ', difficulty: 1,
        rewards: [{ materialId: 'drakeScale', count: 3 }],
        monsters: [{
            name: 'Forest Drake', x: 1150, y: 750,
            config: { hp: 500, width: 96, height: 96, speed: 80, color: '#cc3333',
                      attackDamage: 6, attackRange: 70, attackCooldown: 1500,
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
              config: { hp: 500, width: 96, height: 96, speed: 85, color: '#dd4444',
                        attackDamage: 6, attackRange: 70, attackCooldown: 1500,
                        aggroRange: 400, dropTableId: 'forestDrake' } },
        ],
    },
    {
        id: 'iceWolf', name: 'Ice Wolf討伐',
        description: '素早い氷の狼を討伐せよ', difficulty: 2,
        rewards: [{ materialId: 'iceFang', count: 2 }],
        monsters: [{
            name: 'Ice Wolf', x: 1150, y: 700,
            config: { hp: 300, width: 78, height: 78, speed: 120, color: '#88ccee',
                      attackDamage: 8, attackRange: 60, attackCooldown: 1200,
                      aggroRange: 400, dropTableId: 'iceWolf', isIceWolf: true },
        }],
    },
    {
        id: 'giantDrake', name: 'Giant Drake討伐',
        description: 'HP1500の巨大ドレイクを討伐せよ', difficulty: 3,
        rewards: [{ materialId: 'drakeCore', count: 3 }],
        monsters: [{
            name: 'Giant Drake', x: 1100, y: 700,
            config: { hp: 1500, width: 132, height: 132, speed: 70, color: '#882222',
                      attackDamage: 13, attackRange: 90, attackCooldown: 1000,
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
            config: { hp: 3000, width: 180, height: 180, speed: 100, color: '#220022',
                      attackDamage: 25, attackRange: 100, attackCooldown: 800,
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

export class Weapon {
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
export const WEAPONS = {
    basicSword:  new Weapon('Basic Sword',  15, 45, 350, 3, 'melee', 'combo3', '3段コンボ'),
    ironSword:   new Weapon('Iron Sword',   30, 55, 500, 5, 'melee', 'charge', 'チャージ攻撃'),
    hunterBow:   new Weapon('Hunter Bow',   20, 300, 500, 0, 'ranged','bow',   '長押しで3連矢'),
    frostBlade:  new Weapon('Frost Blade',  35, 50, 300, 4, 'melee', 'frost',  '2連撃・凍結'),
    warHammer:   new Weapon('War Hammer',  120, 55,2000, 8, 'melee', 'hammer', '超重撃・部位+50%'),
    poisonDagger:new Weapon('Poison Dagger',18, 35, 180, 1, 'melee', 'poison', '4段コンボ・毒'),
};

export class Armor {
    constructor(name, defense, damageMultiplier = 1.0) {
        this.name = name; this.defense = defense; this.damageMultiplier = damageMultiplier;
        this.upgradeLevel = 0;
    }
    getDisplayName() { return this.upgradeLevel > 0 ? `${this.name}+${this.upgradeLevel}` : this.name; }
}
export const ARMORS = { drakeArmor: new Armor('Drake Armor', 20, 0.7) };

export const RECIPES = [
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
