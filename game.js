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
};

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

// 木の配置データ（フィールド端に8本）
const TREES = [
    { x: 50,  y: 80 },
    { x: 730, y: 60 },
    { x: 40,  y: 350 },
    { x: 750, y: 320 },
    { x: 180, y: 50 },
    { x: 600, y: 40 },
    { x: 100, y: 520 },
    { x: 680, y: 510 },
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
            name: 'Forest Drake', x: 400 - 32, y: 220,
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
            { name: 'Forest Drake', x: 250, y: 180,
              config: { hp: 500, width: 64, height: 64, speed: 80, color: '#cc3333',
                        attackDamage: 6, attackRange: 55, attackCooldown: 1500,
                        aggroRange: 400, dropTableId: 'forestDrake' } },
            { name: 'Forest Drake', x: 500, y: 250,
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
            name: 'Ice Wolf', x: 400 - 24, y: 230,
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
            name: 'Giant Drake', x: 400 - 48, y: 200,
            config: { hp: 1500, width: 96, height: 96, speed: 70, color: '#882222',
                      attackDamage: 13, attackRange: 70, attackCooldown: 1000,
                      aggroRange: 350, dropTableId: 'giantDrake', isBoss: true },
        }],
    },
];

class Weapon {
    constructor(name, damage, range, cooldown, knockback = 0, type = 'melee', special = null) {
        this.name = name; this.damage = damage; this.range = range;
        this.cooldown = cooldown; this.knockback = knockback; this.type = type;
        this.special = special; // 'slow' | 'pierce' | null
    }
}
const WEAPONS = {
    basicSword: new Weapon('Basic Sword', 15, 40, 350, 3, 'melee'),
    ironSword:  new Weapon('Iron Sword',  30, 50, 400, 5, 'melee'),
    hunterBow:  new Weapon('Hunter Bow',  20, 300, 600, 0, 'ranged'),
    frostBlade: new Weapon('Frost Blade', 35, 50, 400, 5, 'melee', 'slow'),
    iceBow:     new Weapon('Ice Bow',     25, 350, 550, 0, 'ranged', 'pierce'),
};

class Armor {
    constructor(name, defense, damageMultiplier = 1.0) {
        this.name = name; this.defense = defense; this.damageMultiplier = damageMultiplier;
    }
}
const ARMORS = { drakeArmor: new Armor('Drake Armor', 20, 0.7) };

const RECIPES = [
    { id: 'ironSword', name: 'Iron Sword', description: '近距離・ダメージ30・射程50',
      resultType: 'weapon', resultId: 'ironSword',
      materials: [{ materialId: 'drakeScale', count: 3 }] },
    { id: 'hunterBow', name: 'Hunter Bow', description: '遠距離・ダメージ20・射程300',
      resultType: 'weapon', resultId: 'hunterBow',
      materials: [{ materialId: 'drakeFang', count: 2 }] },
    { id: 'drakeArmor', name: 'Drake Armor', description: '被ダメージ x0.7（防御力+20）',
      resultType: 'armor', resultId: 'drakeArmor',
      materials: [{ materialId: 'drakeScale', count: 5 }, { materialId: 'drakeCore', count: 1 }] },
    { id: 'frostBlade', name: 'Frost Blade', description: '近距離・DMG35・攻撃時に敵減速',
      resultType: 'weapon', resultId: 'frostBlade',
      materials: [{ materialId: 'iceFang', count: 2 }, { materialId: 'drakeScale', count: 1 }] },
    { id: 'iceBow', name: 'Ice Bow', description: '遠距離・DMG25・射程350・貫通',
      resultType: 'weapon', resultId: 'iceBow',
      materials: [{ materialId: 'iceCrystal', count: 2 }, { materialId: 'drakeFang', count: 1 }] },
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
        if (this.x<-10||this.x>cw+10||this.y<-10||this.y>ch+10||this.traveled>this.maxDistance) this.alive=false;
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
    constructor() { this.materials = {}; this.weapons = [WEAPONS.basicSword]; this.armors = []; }
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
        if (r.resultType==='weapon') this.weapons.push(WEAPONS[r.resultId]);
        else if (r.resultType==='armor') this.armors.push(ARMORS[r.resultId]);
        return true;
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
        // コンボシステム
        this.comboCount = 0;       // 現在のコンボ段数（0〜2）
        this.comboTimer = 0;       // コンボ受付時間（ms）
        this.comboWindow = 800;    // 次の攻撃までの受付時間（ms）
        this.comboMultipliers = [1.0, 1.2, 1.5];
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

        this.x = Math.max(0, Math.min(cw-this.width, this.x));
        this.y = Math.max(0, Math.min(ch-this.height, this.y));
        if (this.attackCooldown>0) this.attackCooldown -= dt*1000;
        if (this.attackTimer>0) { this.attackTimer -= dt*1000; if (this.attackTimer<=0) this.isAttacking=false; }
        if (this.invincibleTimer>0) this.invincibleTimer -= dt*1000;
        // コンボタイマー
        if (this.comboTimer>0) { this.comboTimer -= dt*1000; if (this.comboTimer<=0) this.comboCount=0; }
        // スロー効果
        if (this.slowTimer > 0) { this.slowTimer -= dt * 1000; this.speed = Math.floor(this.baseSpeed * 0.5); }
        else { this.speed = this.baseSpeed; }
        this.equipBestArmor();
    }
    attack() {
        if (this.attackCooldown>0) return null;
        this.isAttacking = true;
        this.attackTimer = this.attackDuration;
        // コンボ進行
        if (this.comboTimer > 0 && this.comboCount < 2) {
            this.comboCount++;
        } else if (this.comboTimer <= 0) {
            this.comboCount = 0;
        }
        this.comboTimer = this.comboWindow;
        let cdMult = this.comboCount === 2 ? 1.3 : 1.0;
        cdMult *= this.skillAtkSpdMult;
        if (this.weapon.type === 'ranged') cdMult *= this.skillBowCdMult;
        this.attackCooldown = this.weapon.cooldown * cdMult;
        if (this.weapon.type==='ranged') { this.comboCount=0; return null; }
        return this.getAttackHitbox();
    }
    getComboMultiplier() { return this.comboMultipliers[this.comboCount] || 1.0; }
    getAttackHitbox() {
        const range=this.weapon.range, cx=this.x+this.width/2, cy=this.y+this.height/2;
        switch(this.facing) {
            case 'up': return {x:cx-20,y:cy-range-10,width:40,height:range};
            case 'down': return {x:cx-20,y:cy+10,width:40,height:range};
            case 'left': return {x:cx-range-10,y:cy-20,width:range,height:40};
            case 'right': return {x:cx+10,y:cy-20,width:range,height:40};
        }
    }
    takeDamage(amount) {
        if (this.invincibleTimer>0) return;
        const armorMult = this.armor ? this.armor.damageMultiplier : 1.0;
        const finalDmg = Math.max(1, Math.floor(amount * armorMult * this.skillDefMult));
        this.hp = Math.max(0, this.hp - finalDmg);
        this.invincibleTimer = this.invincibleDuration;
        Sound.playDamage();
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
    }
    drawAttackEffect(ctx) {
        const hb = this.getAttackHitbox(); if (!hb) return;
        const alpha = this.attackTimer / this.attackDuration;
        // コンボ段数で色変化
        const colors = ['rgba(255,255,100,', 'rgba(255,200,50,', 'rgba(255,120,30,'];
        const c = colors[this.comboCount] || colors[0];
        ctx.fillStyle = c + (alpha*0.6) + ')';
        ctx.fillRect(hb.x, hb.y, hb.width, hb.height);
        // 3段目は大きいエフェクト
        if (this.comboCount === 2) {
            ctx.fillStyle = `rgba(255,180,50,${alpha*0.3})`;
            const cx=this.x+this.width/2, cy=this.y+this.height/2;
            ctx.beginPath(); ctx.arc(cx, cy, this.weapon.range + 10, 0, Math.PI*2); ctx.fill();
        }
        ctx.strokeStyle = `rgba(255,255,200,${alpha})`; ctx.lineWidth = 3 + this.comboCount;
        ctx.beginPath();
        const cx=this.x+this.width/2, cy=this.y+this.height/2;
        switch(this.facing) {
            case 'up': ctx.moveTo(cx-15,cy-5);ctx.lineTo(cx+15,cy-this.weapon.range-5);break;
            case 'down': ctx.moveTo(cx-15,cy+5);ctx.lineTo(cx+15,cy+this.weapon.range+5);break;
            case 'left': ctx.moveTo(cx-5,cy-15);ctx.lineTo(cx-this.weapon.range-5,cy+15);break;
            case 'right': ctx.moveTo(cx+5,cy-15);ctx.lineTo(cx+this.weapon.range+5,cy+15);break;
        }
        ctx.stroke();
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
    }
    update(dt, player, game) {
        if (!this.alive) return;
        // 遅延HPバー更新
        if (this.displayHp > this.hp) {
            this.displayHp = Math.max(this.hp, this.displayHp - this.maxHp * dt * 0.8);
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
            this.x=Math.max(0,Math.min(800-this.width,this.x));
            this.y=Math.max(0,Math.min(600-this.height,this.y));
            if (!this.chargeHitDealt) {
                const cd=Math.sqrt(((player.x+player.width/2)-(this.x+this.width/2))**2+((player.y+player.height/2)-(this.y+this.height/2))**2);
                if (cd<this.width/2+player.width/2) { player.takeDamage(this.chargeDamage); this.chargeHitDealt=true; }
            }
            if (this.chargeTimer<=0) { this.state='idle'; this.chargeCooldownTimer=this.chargeCooldown; }
            return;
        }
        if (this.isBoss&&this.hp<=this.maxHp*0.5&&this.chargeCooldownTimer<=0&&dist<this.aggroRange) {
            this.state='charge_windup'; this.chargeWindupTimer=this.chargeWindupDuration;
            Sound.playChargeWarning(); this.chargeCooldownTimer=this.chargeCooldown; return;
        }
        if (dist<=this.attackRange) {
            this.state='attack';
            if (this.attackTimer<=0) { player.takeDamage(this.attackDamage); this.attackTimer=this.attackCooldown; }
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
        this.damageNumbers = []; // ダメージ数値ポップアップ
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
        this.images = {}; this.imagesLoaded = false;

        // カメラシェイク
        this.shakeTimer = 0; this.shakeIntensity = 0;

        // 結果画面演出用
        this.resultAnimTimer = 0; // 経過時間（秒）

        // 草テクスチャのプリレンダリング
        this.grassCanvas = null;
        this.generateGrassTexture();

        this.setupInput();
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
        gc.width = 800; gc.height = 600;
        const gctx = gc.getContext('2d');
        // ベース色
        gctx.fillStyle = '#2d5a27';
        gctx.fillRect(0, 0, 800, 600);
        // 微妙な色変化タイル
        for (let y=0; y<600; y+=32) {
            for (let x=0; x<800; x+=32) {
                if ((x/32+y/32)%2===0) { gctx.fillStyle='rgba(0,0,0,0.04)'; gctx.fillRect(x,y,32,32); }
                else { gctx.fillStyle='rgba(50,100,30,0.06)'; gctx.fillRect(x,y,32,32); }
            }
        }
        // ランダムな草の線（シード固定）
        const rng = new SeededRandom(42);
        gctx.strokeStyle = '#3a7830';
        gctx.lineWidth = 1;
        for (let i=0; i<300; i++) {
            const x = rng.next()*800, y = rng.next()*600;
            const h = 4 + rng.next()*6;
            const lean = (rng.next()-0.5)*4;
            const green = Math.floor(80+rng.next()*60);
            gctx.strokeStyle = `rgb(${30+Math.floor(rng.next()*30)},${green},${20+Math.floor(rng.next()*20)})`;
            gctx.beginPath(); gctx.moveTo(x, y); gctx.lineTo(x+lean, y-h); gctx.stroke();
        }
        // 木を描画
        for (const tree of TREES) {
            // 影
            gctx.fillStyle = 'rgba(0,0,0,0.15)';
            gctx.beginPath(); gctx.ellipse(tree.x+3, tree.y+TREE_CANOPY_R-2, TREE_CANOPY_R, TREE_CANOPY_R*0.4, 0, 0, Math.PI*2); gctx.fill();
            // 幹
            gctx.fillStyle = '#5a3a1a';
            gctx.beginPath(); gctx.arc(tree.x, tree.y+10, TREE_TRUNK_R, 0, Math.PI*2); gctx.fill();
            gctx.fillStyle = '#4a2a10';
            gctx.beginPath(); gctx.arc(tree.x-3, tree.y+8, TREE_TRUNK_R*0.4, 0, Math.PI*2); gctx.fill();
            // 葉
            gctx.fillStyle = '#1a6a20';
            gctx.beginPath(); gctx.arc(tree.x, tree.y-12, TREE_CANOPY_R, 0, Math.PI*2); gctx.fill();
            gctx.fillStyle = '#2a8a30';
            gctx.beginPath(); gctx.arc(tree.x-8, tree.y-16, TREE_CANOPY_R*0.7, 0, Math.PI*2); gctx.fill();
            gctx.fillStyle = '#1d7a25';
            gctx.beginPath(); gctx.arc(tree.x+10, tree.y-8, TREE_CANOPY_R*0.6, 0, Math.PI*2); gctx.fill();
        }
        this.grassCanvas = gc;
    }

    loadImages() {
        const files = { player:'assets/player.png', forestDrake:'assets/forest_drake.png', giantDrake:'assets/giant_drake.png' };
        return Promise.all(Object.entries(files).map(([k,s])=>new Promise(r=>{
            const img=new Image(); img.onload=()=>{this.images[k]=img;r();}; img.onerror=()=>{console.warn(`Load fail: ${s}`);r();}; img.src=s;
        })));
    }

    startQuest(quest) {
        this.currentQuest = quest;
        this.player = new Player(this.canvas.width/2-16, this.canvas.height-80, this.inventory);
        this.monsters = quest.monsters.map(m=>new Monster(m.name,m.x,m.y,m.config));
        this.droppedItems=[]; this.arrows=[]; this.particles=[]; this.iceBreaths=[]; this.damageNumbers=[];
        this.questSuccess=false; this.shakeTimer=0; this.resultAnimTimer=0;
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
            if (this.state==='lobby') {
                if (key==='arrowup'||key==='w') this.lobbyCursor=Math.max(0,this.lobbyCursor-1);
                else if (key==='arrowdown'||key==='s') this.lobbyCursor=Math.min(QUESTS.length-1,this.lobbyCursor+1);
                else if (key==='enter'||key==='z') this.startQuest(QUESTS[this.lobbyCursor]);
                if (key==='i') {this.state='inventory';this._returnToLobby=true;return;}
                if (key==='c') {this.state='craft';this.craftCursor=0;this._returnToLobby=true;return;}
                return;
            }
            if (this.state==='result') { if (key==='r'||key==='enter') this.state='lobby'; return; }
            if (this.state==='gameover') { if (key==='r') this.state='lobby'; return; }
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
                if (key==='arrowup'||key==='w') this.craftCursor=Math.max(0,this.craftCursor-1);
                else if (key==='arrowdown'||key==='s') this.craftCursor=Math.min(RECIPES.length-1,this.craftCursor+1);
                else if (key==='enter'||key==='z') this.executeCraft();
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
            if (key==='z') this.handleAttack();
            if (key==='q') { this.player.cycleWeapon(); this.weaponSwitchMessage=`Equipped: ${this.player.weapon.name}`; this.weaponSwitchTimer=1500; }
        });
        window.addEventListener('keyup',(e)=>{this.keys[e.key.toLowerCase()]=false;});
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

    executeCraft() {
        const r=RECIPES[this.craftCursor]; if (!r) return;
        if (this.inventory.alreadyOwns(r)) {this.craftMessage='Already owned!';this.craftMessageTimer=1500;return;}
        if (this.inventory.craft(r)) {this.craftMessage=`Crafted: ${r.name}!`;this.craftMessageTimer=2000;}
        else {this.craftMessage='Not enough materials!';this.craftMessageTimer=1500;}
    }

    handleAttack() {
        if (this.player.attackCooldown>0) return;
        if (this.player.weapon.type==='ranged') {
            this.player.attack();
            const cx=this.player.x+this.player.width/2, cy=this.player.y+this.player.height/2;
            const isPierce = this.player.weapon.special === 'pierce';
            this.arrows.push(new Arrow(cx,cy,this.player.facing,this.player.weapon.damage, isPierce));
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
        // カメラシェイク
        if (hitAny) {
            this.shakeTimer = 60;
            this.shakeIntensity = this.player.comboCount === 2 ? 6 : 4;
        }
    }

    /**
     * ダメージ計算（弱点・スキル・コンボ・レベル補正を統合）
     */
    calcDamage(baseDmg, weapon, comboMult, monster) {
        let dmg = (baseDmg + this.player.bonusDamage) * comboMult;
        if (weapon.type === 'melee') dmg *= this.player.skillMeleeMult;
        // 弱点判定
        let isWeak = false;
        if (monster.weakness === 'ice' && (weapon.special === 'slow' || weapon.special === 'pierce')) {
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
        const { dmg, isWeak } = this.calcDamage(this.player.weapon.damage, this.player.weapon, comboMult, monster);
        const hx = monster.x+monster.width/2, hy = monster.y+monster.height/2;
        const { partBroken } = monster.takeDamage(dmg, (dx/dist)*kb*comboMult, (dy/dist)*kb*comboMult, hx, hy);
        // Frost Bladeのスロー効果
        if (this.player.weapon.special === 'slow') monster.slowTimer = 1000;
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
            for (const r of this.questRewards) this.inventory.addMaterial(r.materialId, r.count);
            Sound.playQuestComplete();
            this.resultTimer=this.resultDuration; this.resultAnimTimer=0;
            this.spawnVictoryParticles();
            this.state='result';
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

        // ダメージ数値更新
        for (const dn of this.damageNumbers) dn.update(dt);
        this.damageNumbers = this.damageNumbers.filter(d => d.alive);

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
            if (this.resultTimer<=0) this.state='lobby';
            return;
        }
        if (this.state==='gameover') {
            this.resultAnimTimer += dt;
            this.resultTimer-=dt;
            if (this.resultTimer<=0) this.state='lobby';
            return;
        }
        // ボス登場演出
        if (this.state === 'bossIntro') {
            this.bossIntroTimer -= dt;
            if (this.bossIntroTimer <= 0) { this.state = 'playing'; this.bossIntroActive = false; }
            return;
        }

        if (this.state!=='playing') return;

        this.player.update(dt, this.keys, this.canvas.width, this.canvas.height, TREES);
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
        ctx.restore();
    }

    drawField(ctx) {
        ctx.save(); ctx.globalAlpha=1;
        // プリレンダリングされた草原を描画
        if (this.grassCanvas) ctx.drawImage(this.grassCanvas, 0, 0);
        else this.drawBackground(ctx);

        for (const item of this.droppedItems) { ctx.save(); item.draw(ctx); ctx.restore(); }
        for (const arrow of this.arrows) { ctx.save(); arrow.draw(ctx); ctx.restore(); }
        for (const m of this.monsters) {
            ctx.save();
            const mImg = m.isIceWolf ? null : (m.isBoss ? this.images.giantDrake : this.images.forestDrake);
            m.draw(ctx, mImg);
            ctx.restore();
        }
        if (this.player) { ctx.save(); this.player.draw(ctx,this.images.player); ctx.restore(); }
        // 氷の息描画
        for (const ib of this.iceBreaths) {
            if (!ib.alive) continue;
            ctx.save();
            ctx.fillStyle = '#88ddff';
            ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.arc(ib.x, ib.y, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#aaeeff';
            ctx.globalAlpha = 0.4;
            ctx.beginPath(); ctx.arc(ib.x, ib.y, 12, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
        // パーティクル
        for (const p of this.particles) { ctx.save(); p.draw(ctx); ctx.restore(); }
        // ダメージ数値
        for (const dn of this.damageNumbers) { ctx.save(); dn.draw(ctx); ctx.restore(); }
        // レベルアップテキスト
        if (this.levelUpTimer > 0) {
            ctx.save();
            const a = Math.min(1, this.levelUpTimer / 500);
            ctx.globalAlpha = a;
            ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center';
            ctx.fillText(`LEVEL UP! Lv${this.player.level}`, 400, 200);
            ctx.restore();
        }
        // Giant Drake第2形態: 画面端赤エフェクト
        const bossPhase2 = this.monsters.find(m => m.isBoss && m.alive && m.phase2);
        if (bossPhase2) {
            ctx.save();
            const pa = 0.08 + Math.sin(Date.now() * 0.005) * 0.05;
            const g = ctx.createRadialGradient(400, 300, 200, 400, 300, 450);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, `rgba(150,0,0,${pa})`);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 800, 600);
            ctx.restore();
        }
        // プレイヤースロー表示
        if (this.player && this.player.slowTimer > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(100,200,255,0.4)'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.player.x+this.player.width/2, this.player.y+this.player.height/2, 24, 0, Math.PI*2);
            ctx.stroke();
            ctx.restore();
        }
        if (this.player) { ctx.save(); this.drawUI(ctx); ctx.restore(); }
        ctx.restore();
    }

    drawBackground(ctx) {
        ctx.fillStyle='#2d5a27'; ctx.fillRect(0,0,800,600);
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

        // コンボ表示
        if (this.player.comboTimer > 0 && this.player.weapon.type === 'melee') {
            ctx.fillStyle = '#ffcc44'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
            ctx.fillText(`COMBO x${this.player.comboCount+1}`, pBarX, pBarY+60);
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
        ctx.fillText(`[${this.player.weapon.type==='ranged'?'Ranged':'Melee'}] DMG:${this.player.weapon.damage}  Q:Switch`,eqX+8,eqY+28);
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
        ctx.fillText('WASD:Move  Z:Attack  Q:Switch  I:Inventory  C:Craft',400,590);
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
        // カウントダウン
        ctx.fillStyle='#aaa'; ctx.font='16px monospace'; ctx.textAlign='center';
        ctx.fillText(`Returning to lobby in ${Math.max(0,Math.ceil(this.resultTimer))}s  (R: now)`, 400, 480);
        // 金パーティクルは drawField で描画済み
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
        const mmW = 150, mmH = 100;
        const mmX = this.canvas.width - mmW - 10, mmY = 10;
        const scaleX = mmW / 800, scaleY = mmH / 600;
        ctx.save();
        // 背景
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, mmX, mmY, mmW, mmH, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
        roundRect(ctx, mmX, mmY, mmW, mmH, 4); ctx.stroke();
        // 木（緑の小四角）
        ctx.fillStyle = '#2a6a2a';
        for (const tree of TREES) {
            ctx.fillRect(mmX + tree.x * scaleX - 2, mmY + tree.y * scaleY - 2, 4, 4);
        }
        // モンスター（赤い点）
        for (const m of this.monsters) {
            if (!m.alive) continue;
            ctx.fillStyle = m.isBoss ? '#ff6622' : '#ff3333';
            const mx = mmX + (m.x + m.width/2) * scaleX;
            const my = mmY + (m.y + m.height/2) * scaleY;
            ctx.beginPath(); ctx.arc(mx, my, m.isBoss ? 4 : 3, 0, Math.PI*2); ctx.fill();
        }
        // プレイヤー（白い点）
        if (this.player) {
            ctx.fillStyle = '#ffffff';
            const px = mmX + (this.player.x + this.player.width/2) * scaleX;
            const py = mmY + (this.player.y + this.player.height/2) * scaleY;
            ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }

    drawLobby(ctx) {
        ctx.save(); ctx.globalAlpha=1;
        ctx.fillStyle='#0e0e1a'; ctx.fillRect(0,0,800,600);
        ctx.fillStyle='#cc8844';ctx.font='bold 36px monospace';ctx.textAlign='center';
        ctx.fillText('MONSTER HUNT 2D',400,55);
        ctx.fillStyle='#888';ctx.font='14px monospace';ctx.fillText('Select a Quest',400,85);
        ctx.font='11px monospace';ctx.textAlign='right';let my=25;
        for (const [id,mat] of Object.entries(MATERIALS)) {
            const c=this.inventory.getMaterialCount(id);
            ctx.fillStyle=mat.color;ctx.beginPath();ctx.arc(740,my-3,4,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#aaa';ctx.fillText(`${mat.name}: ${c}`,780,my);my+=18;
        }
        const cw=600,ch=100,cx=(800-cw)/2;let cy=120;
        for (let i=0;i<QUESTS.length;i++) {
            const q=QUESTS[i],sel=i===this.lobbyCursor;
            const hov=this.mouseX>=cx&&this.mouseX<=cx+cw&&this.mouseY>=cy&&this.mouseY<=cy+ch;
            if(sel){ctx.fillStyle='#1a2a3a';ctx.strokeStyle='#cc8844';ctx.lineWidth=2;}
            else if(hov){ctx.fillStyle='#151525';ctx.strokeStyle='#555';ctx.lineWidth=1;}
            else{ctx.fillStyle='#111122';ctx.strokeStyle='#333344';ctx.lineWidth=1;}
            roundRect(ctx,cx,cy,cw,ch,8);ctx.fill();ctx.stroke();
            const stars=this.getDifficultyStars(q.difficulty);
            ctx.fillStyle='#ffcc44';ctx.font='14px monospace';ctx.textAlign='left';ctx.fillText(stars,cx+15,cy+25);
            ctx.fillStyle=sel?'#fff':'#ccc';ctx.font='bold 18px monospace';ctx.fillText(q.name,cx+15,cy+50);
            ctx.fillStyle='#888';ctx.font='12px monospace';ctx.fillText(q.description,cx+15,cy+70);
            ctx.fillStyle='#aaa';ctx.font='11px monospace';
            let rt='Reward: ';for(const r of q.rewards)rt+=`${MATERIALS[r.materialId].name} x${r.count}  `;
            ctx.fillText(rt,cx+15,cy+90);
            if(sel){ctx.fillStyle='#cc8844';ctx.font='bold 20px monospace';ctx.textAlign='right';ctx.fillText('>',cx-5,cy+52);}
            cy+=ch+20;
        }
        ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='13px monospace';ctx.textAlign='center';
        ctx.fillText('W/S:Select  Z/Enter/Click:Start  I:Inventory  C:Craft',400,580);
        ctx.restore();
    }
    getDifficultyStars(l) { let s='';for(let i=0;i<3;i++)s+=i<l?'\u2605':'\u2606';return s; }

    drawInventory(ctx) {
        ctx.save();ctx.globalAlpha=1;
        ctx.fillStyle='rgba(0,0,0,0.85)';ctx.fillRect(0,0,800,600);
        const px=100,py=60,pw=600,ph=480;
        roundRect(ctx,px,py,pw,ph,10);ctx.fillStyle='#1a1a2e';ctx.fill();
        roundRect(ctx,px,py,pw,ph,10);ctx.strokeStyle='#4488cc';ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle='#4488cc';ctx.font='bold 24px monospace';ctx.textAlign='center';
        ctx.fillText('INVENTORY',400,py+35);
        let y=py+70;
        ctx.fillStyle='#88ccff';ctx.font='bold 16px monospace';ctx.textAlign='left';ctx.fillText('Materials',px+30,y);
        y+=10;ctx.strokeStyle='#333355';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+30,y);ctx.lineTo(px+pw-30,y);ctx.stroke();
        y+=25;ctx.font='14px monospace';let has=false;
        for(const[id,mat]of Object.entries(MATERIALS)){const c=this.inventory.getMaterialCount(id);if(c>0){has=true;ctx.fillStyle=mat.color;ctx.beginPath();ctx.arc(px+45,y-4,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillText(`${mat.name} (${mat.description})`,px+60,y);ctx.fillStyle='#ffcc44';ctx.textAlign='right';ctx.fillText(`x${c}`,px+pw-40,y);ctx.textAlign='left';y+=28;}}
        if(!has){ctx.fillStyle='#666';ctx.fillText('No materials',px+60,y);y+=28;}
        y+=15;ctx.fillStyle='#ffcc44';ctx.font='bold 16px monospace';ctx.fillText('Weapons',px+30,y);
        y+=10;ctx.strokeStyle='#333355';ctx.beginPath();ctx.moveTo(px+30,y);ctx.lineTo(px+pw-30,y);ctx.stroke();
        y+=25;ctx.font='14px monospace';
        for(const w of this.inventory.weapons){const eq=this.player&&w===this.player.weapon;const tl=w.type==='ranged'?'Ranged':'Melee';if(eq){ctx.fillStyle='#44ff44';ctx.fillText('E',px+35,y);}ctx.fillStyle=eq?'#fff':'#aaa';ctx.fillText(w.name,px+60,y);ctx.fillStyle='#888';ctx.textAlign='right';ctx.fillText(`[${tl}] DMG:${w.damage} RNG:${w.range}`,px+pw-40,y);ctx.textAlign='left';y+=28;}
        y+=15;ctx.fillStyle='#aaddff';ctx.font='bold 16px monospace';ctx.fillText('Armor',px+30,y);
        y+=10;ctx.strokeStyle='#333355';ctx.beginPath();ctx.moveTo(px+30,y);ctx.lineTo(px+pw-30,y);ctx.stroke();
        y+=25;ctx.font='14px monospace';
        if(this.inventory.armors.length===0){ctx.fillStyle='#666';ctx.fillText('No armor',px+60,y);}
        else{for(const a of this.inventory.armors){const eq=this.player&&a===this.player.armor;if(eq){ctx.fillStyle='#44ff44';ctx.fillText('E',px+35,y);}ctx.fillStyle=eq?'#fff':'#aaa';ctx.fillText(a.name,px+60,y);ctx.fillStyle='#888';ctx.textAlign='right';ctx.fillText(`DEF+${a.defense} (x${a.damageMultiplier})`,px+pw-40,y);ctx.textAlign='left';y+=28;}}
        ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='14px monospace';ctx.textAlign='center';
        ctx.fillText('Press I to close',400,py+ph-20);ctx.restore();
    }

    drawCraftMenu(ctx) {
        ctx.save();ctx.globalAlpha=1;
        ctx.fillStyle='rgba(0,0,0,0.85)';ctx.fillRect(0,0,800,600);
        const px=100,py=60,pw=600,ph=480;
        roundRect(ctx,px,py,pw,ph,10);ctx.fillStyle='#1a1a2e';ctx.fill();
        roundRect(ctx,px,py,pw,ph,10);ctx.strokeStyle='#cc8844';ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle='#cc8844';ctx.font='bold 24px monospace';ctx.textAlign='center';ctx.fillText('CRAFT',400,py+35);
        let y=py+70;
        for(let i=0;i<RECIPES.length;i++){
            const r=RECIPES[i],cc=this.inventory.canCraft(r),own=this.inventory.alreadyOwns(r),sel=i===this.craftCursor;
            const rh=100,ry=y;
            if(sel){ctx.fillStyle='rgba(204,136,68,0.15)';roundRect(ctx,px+15,ry-5,pw-30,rh,6);ctx.fill();roundRect(ctx,px+15,ry-5,pw-30,rh,6);ctx.strokeStyle='#cc8844';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#cc8844';ctx.font='16px monospace';ctx.textAlign='left';ctx.fillText('>',px+22,ry+18);}
            ctx.fillStyle=own?'#666':(cc?'#fff':'#888');ctx.font='bold 16px monospace';ctx.textAlign='left';ctx.fillText(r.name,px+40,ry+18);
            if(own){ctx.fillStyle='#44cc44';ctx.font='12px monospace';ctx.fillText('[OWNED]',px+40+ctx.measureText(r.name).width+10,ry+18);}
            ctx.fillStyle='#aaa';ctx.font='12px monospace';ctx.fillText(r.description,px+40,ry+38);
            let mx2=px+40;const my2=ry+60;ctx.fillText('Required: ',mx2,my2);mx2+=ctx.measureText('Required: ').width;
            for(const req of r.materials){const mat=MATERIALS[req.materialId];const ow=this.inventory.getMaterialCount(req.materialId);const en=ow>=req.count;ctx.fillStyle=mat.color;ctx.beginPath();ctx.arc(mx2+5,my2-4,5,0,Math.PI*2);ctx.fill();mx2+=15;ctx.fillStyle=en?'#44cc44':'#cc4444';const tx=`${mat.name} ${ow}/${req.count}  `;ctx.fillText(tx,mx2,my2);mx2+=ctx.measureText(tx).width;}
            if(sel&&!own){const bx=px+pw-160,by2=ry+5,bw=120,bh=28;ctx.fillStyle=cc?'#44aa44':'#444';roundRect(ctx,bx,by2,bw,bh,4);ctx.fill();ctx.fillStyle=cc?'#fff':'#888';ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillText('CRAFT [Z]',bx+bw/2,by2+19);ctx.textAlign='left';}
            y+=rh+10;
        }
        if(this.craftMessageTimer>0){ctx.fillStyle=`rgba(255,255,100,${Math.min(1,this.craftMessageTimer/300)})`;ctx.font='bold 18px monospace';ctx.textAlign='center';ctx.fillText(this.craftMessage,400,py+ph-55);}
        ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='14px monospace';ctx.textAlign='center';ctx.fillText('W/S:Select  Z:Craft  C:Close',400,py+ph-20);
        ctx.restore();
    }
}

// ========================================
// ゲーム起動
// ========================================
window.addEventListener('load', () => { new Game('gameCanvas'); });
