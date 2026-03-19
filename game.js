// ========================================
// MONSTER HUNT 2D - Phase 3
// クエストロビー・複数モンスター・Giant Drake・SE
// ========================================

// ========================================
// 効果音管理クラス（Web Audio API）
// ========================================
class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        // ユーザー操作後にAudioContextを初期化
        this._initOnInteraction = () => {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        };
        window.addEventListener('keydown', this._initOnInteraction, { once: false });
        window.addEventListener('click', this._initOnInteraction, { once: false });
    }

    /**
     * ビープ音を再生
     * @param {number} freq - 周波数(Hz)
     * @param {number} duration - 長さ(秒)
     * @param {string} type - 波形タイプ
     * @param {number} volume - 音量 0〜1
     */
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

    /** 攻撃ヒット音 */
    playHit() {
        this._beep(400, 0.08, 'square', 0.12);
        setTimeout(() => this._beep(300, 0.06, 'square', 0.08), 40);
    }

    /** 素材取得音 */
    playPickup() {
        this._beep(800, 0.06, 'sine', 0.1);
        setTimeout(() => this._beep(1200, 0.08, 'sine', 0.1), 60);
    }

    /** クエスト完了音 */
    playQuestComplete() {
        const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
        notes.forEach((f, i) => {
            setTimeout(() => this._beep(f, 0.25, 'sine', 0.15), i * 150);
        });
    }

    /** クエスト失敗音 */
    playQuestFailed() {
        this._beep(300, 0.3, 'sawtooth', 0.1);
        setTimeout(() => this._beep(200, 0.4, 'sawtooth', 0.1), 200);
    }

    /** ボス突進予告音 */
    playChargeWarning() {
        this._beep(200, 0.15, 'sawtooth', 0.12);
        setTimeout(() => this._beep(250, 0.15, 'sawtooth', 0.12), 150);
    }
}

// グローバルサウンドマネージャー
const Sound = new SoundManager();

// ========================================
// 素材アイテム定義
// ========================================
const MATERIALS = {
    drakeScale: { id: 'drakeScale', name: 'Drake Scale', color: '#44cc88', description: 'ドレイクの鱗' },
    drakeFang:  { id: 'drakeFang',  name: 'Drake Fang',  color: '#cccc44', description: 'ドレイクの牙' },
    drakeCore:  { id: 'drakeCore',  name: 'Drake Core',  color: '#cc44cc', description: 'ドレイクの核' },
};

// ========================================
// ドロップテーブル定義（モンスター別）
// ========================================
const DROP_TABLES = {
    forestDrake: [
        { materialId: 'drakeScale', chance: 0.6, minCount: 1, maxCount: 3 },
        { materialId: 'drakeFang',  chance: 0.4, minCount: 1, maxCount: 2 },
        { materialId: 'drakeCore',  chance: 0.2, minCount: 1, maxCount: 1 },
    ],
    // Giant Drakeは討伐報酬のみ（ドロップテーブル空）
    giantDrake: [],
};

// ========================================
// クエスト定義
// ========================================
const QUESTS = [
    {
        id: 'forestDrake',
        name: 'Forest Drake討伐',
        description: 'Forest Drakeを1体討伐せよ',
        difficulty: 1,
        rewards: [
            { materialId: 'drakeScale', count: 3 },
        ],
        monsters: [
            {
                name: 'Forest Drake',
                x: 400 - 32, y: 220,
                config: {
                    hp: 500, width: 64, height: 64, speed: 80,
                    color: '#cc3333', attackDamage: 10, attackRange: 55,
                    attackCooldown: 1000, aggroRange: 300, dropTableId: 'forestDrake',
                },
            },
        ],
    },
    {
        id: 'doubleDrake',
        name: 'Drake 2体同時討伐',
        description: 'Forest Drake 2体を同時に討伐せよ',
        difficulty: 2,
        rewards: [
            { materialId: 'drakeFang', count: 3 },
            { materialId: 'drakeCore', count: 1 },
        ],
        monsters: [
            {
                name: 'Forest Drake',
                x: 250, y: 180,
                config: {
                    hp: 500, width: 64, height: 64, speed: 80,
                    color: '#cc3333', attackDamage: 10, attackRange: 55,
                    attackCooldown: 1000, aggroRange: 300, dropTableId: 'forestDrake',
                },
            },
            {
                name: 'Forest Drake',
                x: 500, y: 250,
                config: {
                    hp: 500, width: 64, height: 64, speed: 85,
                    color: '#dd4444', attackDamage: 10, attackRange: 55,
                    attackCooldown: 1000, aggroRange: 300, dropTableId: 'forestDrake',
                },
            },
        ],
    },
    {
        id: 'giantDrake',
        name: 'Giant Drake討伐',
        description: 'HP1500の巨大ドレイクを討伐せよ',
        difficulty: 3,
        rewards: [
            { materialId: 'drakeCore', count: 3 },
        ],
        monsters: [
            {
                name: 'Giant Drake',
                x: 400 - 48, y: 200,
                config: {
                    hp: 1500, width: 96, height: 96, speed: 70,
                    color: '#882222', attackDamage: 20, attackRange: 70,
                    attackCooldown: 1000, aggroRange: 350, dropTableId: 'giantDrake',
                    isBoss: true,
                },
            },
        ],
    },
];

// ========================================
// 武器クラス（melee/ranged 対応）
// ========================================
class Weapon {
    /**
     * @param {string} name - 武器名
     * @param {number} damage - ダメージ量
     * @param {number} range - 攻撃範囲（px）
     * @param {number} cooldown - 攻撃クールダウン（ms）
     * @param {number} knockback - ノックバック力
     * @param {string} type - 'melee' または 'ranged'
     */
    constructor(name, damage, range, cooldown, knockback = 0, type = 'melee') {
        this.name = name;
        this.damage = damage;
        this.range = range;
        this.cooldown = cooldown;
        this.knockback = knockback;
        this.type = type;
    }
}

// 武器定義（初期装備 + クラフト品）
const WEAPONS = {
    basicSword:  new Weapon('Basic Sword',  15, 40, 400, 3, 'melee'),
    ironSword:   new Weapon('Iron Sword',   30, 50, 400, 5, 'melee'),
    hunterBow:   new Weapon('Hunter Bow',   20, 300, 600, 0, 'ranged'),
};

// ========================================
// 防具クラス（ダメージ倍率方式）
// ========================================
class Armor {
    /**
     * @param {string} name - 防具名
     * @param {number} defense - 防御力（表示用）
     * @param {number} damageMultiplier - 被ダメージ倍率
     */
    constructor(name, defense, damageMultiplier = 1.0) {
        this.name = name;
        this.defense = defense;
        this.damageMultiplier = damageMultiplier;
    }
}

const ARMORS = {
    drakeArmor: new Armor('Drake Armor', 20, 0.7),
};

// ========================================
// クラフトレシピ定義
// ========================================
const RECIPES = [
    {
        id: 'ironSword',
        name: 'Iron Sword',
        description: '近距離・ダメージ30・射程50',
        resultType: 'weapon',
        resultId: 'ironSword',
        materials: [
            { materialId: 'drakeScale', count: 3 },
        ],
    },
    {
        id: 'hunterBow',
        name: 'Hunter Bow',
        description: '遠距離・ダメージ20・射程300',
        resultType: 'weapon',
        resultId: 'hunterBow',
        materials: [
            { materialId: 'drakeFang', count: 2 },
        ],
    },
    {
        id: 'drakeArmor',
        name: 'Drake Armor',
        description: '被ダメージ x0.7（防御力+20）',
        resultType: 'armor',
        resultId: 'drakeArmor',
        materials: [
            { materialId: 'drakeScale', count: 5 },
            { materialId: 'drakeCore', count: 1 },
        ],
    },
];

// ========================================
// フィールド上のドロップアイテムクラス
// ========================================
class DroppedItem {
    constructor(x, y, materialId, count) {
        this.x = x;
        this.y = y;
        this.materialId = materialId;
        this.count = count;
        this.radius = 8;
        this.collected = false;
        this.collectEffectTimer = 0;
        this.collectEffectDuration = 400;
        this.targetX = x;
        this.targetY = y;
        this.animProgress = 0;
        this.startX = x;
        this.startY = y;
        this.floatPhase = Math.random() * Math.PI * 2;
    }

    setScatter(originX, originY) {
        this.startX = originX;
        this.startY = originY;
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 50;
        this.targetX = originX + Math.cos(angle) * dist;
        this.targetY = originY + Math.sin(angle) * dist;
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
        if (this.collectEffectTimer > 0) {
            this.collectEffectTimer -= dt * 1000;
        }
    }

    draw(ctx) {
        if (this.collected && this.collectEffectTimer <= 0) return;
        const mat = MATERIALS[this.materialId];
        const floatY = Math.sin(this.floatPhase) * 3;
        if (this.collected) {
            const alpha = this.collectEffectTimer / this.collectEffectDuration;
            const riseY = (1 - alpha) * -30;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = mat.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y + riseY, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`+${this.count} ${mat.name}`, this.x, this.y + riseY - 15);
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = mat.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y + floatY, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(this.x - 2, this.y + floatY - 2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    isFullyDone() {
        return this.collected && this.collectEffectTimer <= 0;
    }
}

// ========================================
// 矢クラス（弓の飛翔体）
// ========================================
class Arrow {
    constructor(x, y, direction, damage) {
        this.x = x;
        this.y = y;
        this.width = 6;
        this.height = 6;
        this.speed = 400;
        this.damage = damage;
        this.direction = direction;
        this.alive = true;
        this.maxDistance = 350;
        this.traveled = 0;
        switch (direction) {
            case 'up':    this.vx = 0;  this.vy = -1; break;
            case 'down':  this.vx = 0;  this.vy = 1;  break;
            case 'left':  this.vx = -1; this.vy = 0;  break;
            case 'right': this.vx = 1;  this.vy = 0;  break;
        }
    }

    update(dt, canvasWidth, canvasHeight) {
        const moveX = this.vx * this.speed * dt;
        const moveY = this.vy * this.speed * dt;
        this.x += moveX;
        this.y += moveY;
        this.traveled += Math.sqrt(moveX * moveX + moveY * moveY);
        if (this.x < -10 || this.x > canvasWidth + 10 ||
            this.y < -10 || this.y > canvasHeight + 10 ||
            this.traveled > this.maxDistance) {
            this.alive = false;
        }
    }

    draw(ctx) {
        if (!this.alive) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#ffdd44';
        ctx.strokeStyle = '#aa8833';
        ctx.lineWidth = 1;
        switch (this.direction) {
            case 'up':
                ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-3, 4); ctx.lineTo(3, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = '#aa6622'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 10); ctx.stroke();
                break;
            case 'down':
                ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-3, -4); ctx.lineTo(3, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = '#aa6622'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -10); ctx.stroke();
                break;
            case 'left':
                ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, -3); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = '#aa6622'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(10, 0); ctx.stroke();
                break;
            case 'right':
                ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -3); ctx.lineTo(-4, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = '#aa6622'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-10, 0); ctx.stroke();
                break;
        }
        ctx.restore();
    }
}

// ========================================
// インベントリクラス
// ========================================
class Inventory {
    constructor() {
        this.materials = {};
        this.weapons = [WEAPONS.basicSword];
        this.armors = [];
    }

    addMaterial(materialId, count) {
        if (!this.materials[materialId]) this.materials[materialId] = 0;
        this.materials[materialId] += count;
    }

    getMaterialCount(materialId) {
        return this.materials[materialId] || 0;
    }

    consumeMaterial(materialId, count) {
        if (this.getMaterialCount(materialId) < count) return false;
        this.materials[materialId] -= count;
        return true;
    }

    canCraft(recipe) {
        return recipe.materials.every(
            req => this.getMaterialCount(req.materialId) >= req.count
        );
    }

    alreadyOwns(recipe) {
        if (recipe.resultType === 'weapon') {
            return this.weapons.some(w => w.name === WEAPONS[recipe.resultId].name);
        }
        if (recipe.resultType === 'armor') {
            return this.armors.some(a => a.name === ARMORS[recipe.resultId].name);
        }
        return false;
    }

    craft(recipe) {
        if (!this.canCraft(recipe) || this.alreadyOwns(recipe)) return false;
        for (const req of recipe.materials) {
            this.consumeMaterial(req.materialId, req.count);
        }
        if (recipe.resultType === 'weapon') {
            this.weapons.push(WEAPONS[recipe.resultId]);
        } else if (recipe.resultType === 'armor') {
            this.armors.push(ARMORS[recipe.resultId]);
        }
        return true;
    }
}

// ========================================
// プレイヤークラス
// ========================================
class Player {
    constructor(x, y, inventory) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.speed = 200;
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.maxStamina = 100;
        this.stamina = this.maxStamina;
        this.facing = 'down';
        this.inventory = inventory;
        this.weapon = this.inventory.weapons[0];
        this.weaponIndex = 0;
        this.armor = null;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackCooldown = 0;
        this.attackDuration = 200;
        this.invincibleTimer = 0;
        this.invincibleDuration = 500;
    }

    cycleWeapon() {
        const weapons = this.inventory.weapons;
        if (weapons.length <= 1) return;
        this.weaponIndex = (this.weaponIndex + 1) % weapons.length;
        this.weapon = weapons[this.weaponIndex];
    }

    equipBestArmor() {
        if (this.inventory.armors.length > 0) {
            this.armor = this.inventory.armors.reduce(
                (best, a) => a.defense > best.defense ? a : best,
                this.inventory.armors[0]
            );
        }
    }

    update(dt, keys, canvasWidth, canvasHeight) {
        let dx = 0;
        let dy = 0;
        if (keys['w'] || keys['arrowup'])    { dy = -1; this.facing = 'up'; }
        if (keys['s'] || keys['arrowdown'])  { dy = 1;  this.facing = 'down'; }
        if (keys['a'] || keys['arrowleft'])  { dx = -1; this.facing = 'left'; }
        if (keys['d'] || keys['arrowright']) { dx = 1;  this.facing = 'right'; }
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len; dy /= len;
        }
        this.x += dx * this.speed * dt;
        this.y += dy * this.speed * dt;
        this.x = Math.max(0, Math.min(canvasWidth - this.width, this.x));
        this.y = Math.max(0, Math.min(canvasHeight - this.height, this.y));
        if (this.attackCooldown > 0) this.attackCooldown -= dt * 1000;
        if (this.attackTimer > 0) {
            this.attackTimer -= dt * 1000;
            if (this.attackTimer <= 0) this.isAttacking = false;
        }
        if (this.invincibleTimer > 0) this.invincibleTimer -= dt * 1000;
        this.equipBestArmor();
    }

    attack() {
        if (this.attackCooldown > 0) return null;
        this.isAttacking = true;
        this.attackTimer = this.attackDuration;
        this.attackCooldown = this.weapon.cooldown;
        if (this.weapon.type === 'ranged') return null;
        return this.getAttackHitbox();
    }

    getAttackHitbox() {
        const range = this.weapon.range;
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        switch (this.facing) {
            case 'up':    return { x: cx - 20, y: cy - range - 10, width: 40, height: range };
            case 'down':  return { x: cx - 20, y: cy + 10, width: 40, height: range };
            case 'left':  return { x: cx - range - 10, y: cy - 20, width: range, height: 40 };
            case 'right': return { x: cx + 10, y: cy - 20, width: range, height: 40 };
        }
    }

    /**
     * ダメージを受ける（防具による倍率軽減あり）
     * @param {number} amount - 元のダメージ量
     */
    takeDamage(amount) {
        if (this.invincibleTimer > 0) return;
        // 防具による倍率軽減
        const multiplier = this.armor ? this.armor.damageMultiplier : 1.0;
        const actualDamage = Math.max(1, Math.floor(amount * multiplier));
        this.hp = Math.max(0, this.hp - actualDamage);
        this.invincibleTimer = this.invincibleDuration;
    }

    draw(ctx) {
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 80) % 2 === 0) return;
        ctx.fillStyle = this.armor ? '#aaddff' : '#ffffff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#88ccff';
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        switch (this.facing) {
            case 'up':    ctx.fillRect(cx - 4, this.y, 8, 6); break;
            case 'down':  ctx.fillRect(cx - 4, this.y + this.height - 6, 8, 6); break;
            case 'left':  ctx.fillRect(this.x, cy - 4, 6, 8); break;
            case 'right': ctx.fillRect(this.x + this.width - 6, cy - 4, 6, 8); break;
        }
        if (this.isAttacking && this.attackTimer > 0 && this.weapon.type === 'melee') {
            this.drawAttackEffect(ctx);
        }
    }

    drawAttackEffect(ctx) {
        const hitbox = this.getAttackHitbox();
        if (!hitbox) return;
        const alpha = this.attackTimer / this.attackDuration;
        ctx.fillStyle = `rgba(255, 255, 100, ${alpha * 0.6})`;
        ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
        ctx.strokeStyle = `rgba(255, 255, 200, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        switch (this.facing) {
            case 'up':    ctx.moveTo(cx - 15, cy - 5); ctx.lineTo(cx + 15, cy - this.weapon.range - 5); break;
            case 'down':  ctx.moveTo(cx - 15, cy + 5); ctx.lineTo(cx + 15, cy + this.weapon.range + 5); break;
            case 'left':  ctx.moveTo(cx - 5, cy - 15); ctx.lineTo(cx - this.weapon.range - 5, cy + 15); break;
            case 'right': ctx.moveTo(cx + 5, cy - 15); ctx.lineTo(cx + this.weapon.range + 5, cy + 15); break;
        }
        ctx.stroke();
    }
}

// ========================================
// モンスタークラス（Giant Drake 突進対応）
// ========================================
class Monster {
    constructor(name, x, y, config = {}) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.width = config.width || 64;
        this.height = config.height || 64;
        this.speed = config.speed || 80;
        this.baseSpeed = this.speed;
        this.color = config.color || '#cc3333';
        this.maxHp = config.hp || 500;
        this.hp = this.maxHp;
        this.attackDamage = config.attackDamage || 10;
        this.attackRange = config.attackRange || 50;
        this.attackCooldown = config.attackCooldown || 1000;
        this.attackTimer = 0;
        this.aggroRange = config.aggroRange || 300;
        this.state = 'idle'; // 'idle','chase','attack','dead','charge_windup','charging'
        this.dropTableId = config.dropTableId || 'forestDrake';
        this.hitFlashTimer = 0;
        this.alive = true;
        this.spawnX = x;
        this.spawnY = y;

        // ボス専用：突進攻撃
        this.isBoss = config.isBoss || false;
        this.chargeWindupTimer = 0;     // 突進予告時間
        this.chargeWindupDuration = 500; // 0.5秒の予告
        this.chargeDuration = 600;       // 突進の持続時間
        this.chargeTimer = 0;
        this.chargeSpeed = 350;          // 突進速度
        this.chargeDamage = 30;          // 突進ダメージ
        this.chargeCooldown = 5000;      // 突進クールダウン（ms）
        this.chargeCooldownTimer = 0;
        this.chargeDir = { x: 0, y: 0 }; // 突進方向
        this.hasChargedThisPhase = false; // HP50%以下フェーズに入ったか
        this.chargeHitDealt = false;      // 突進中にヒットしたか
    }

    update(dt, player) {
        if (!this.alive) return;

        const dx = (player.x + player.width / 2) - (this.x + this.width / 2);
        const dy = (player.y + player.height / 2) - (this.y + this.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (this.attackTimer > 0) this.attackTimer -= dt * 1000;
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt * 1000;
        if (this.chargeCooldownTimer > 0) this.chargeCooldownTimer -= dt * 1000;

        // ボス突進状態の処理
        if (this.state === 'charge_windup') {
            this.chargeWindupTimer -= dt * 1000;
            if (this.chargeWindupTimer <= 0) {
                // 突進開始
                this.state = 'charging';
                this.chargeTimer = this.chargeDuration;
                this.chargeHitDealt = false;
                // 突進方向をプレイヤーに向けて確定
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                this.chargeDir = { x: dx / d, y: dy / d };
            }
            return;
        }

        if (this.state === 'charging') {
            this.chargeTimer -= dt * 1000;
            // 高速移動
            this.x += this.chargeDir.x * this.chargeSpeed * dt;
            this.y += this.chargeDir.y * this.chargeSpeed * dt;
            // 画面内に制限
            this.x = Math.max(0, Math.min(800 - this.width, this.x));
            this.y = Math.max(0, Math.min(600 - this.height, this.y));

            // 突進中のプレイヤーヒット判定
            if (!this.chargeHitDealt) {
                const cdx = (player.x + player.width / 2) - (this.x + this.width / 2);
                const cdy = (player.y + player.height / 2) - (this.y + this.height / 2);
                const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
                if (cdist < (this.width / 2 + player.width / 2)) {
                    player.takeDamage(this.chargeDamage);
                    this.chargeHitDealt = true;
                }
            }

            if (this.chargeTimer <= 0) {
                this.state = 'idle';
                this.chargeCooldownTimer = this.chargeCooldown;
            }
            return;
        }

        // ボス：HP50%以下で突進を使用開始
        if (this.isBoss && this.hp <= this.maxHp * 0.5 &&
            this.chargeCooldownTimer <= 0 && dist < this.aggroRange) {
            this.state = 'charge_windup';
            this.chargeWindupTimer = this.chargeWindupDuration;
            Sound.playChargeWarning();
            this.chargeCooldownTimer = this.chargeCooldown;
            return;
        }

        // 通常AI
        if (dist <= this.attackRange) {
            this.state = 'attack';
            if (this.attackTimer <= 0) {
                player.takeDamage(this.attackDamage);
                this.attackTimer = this.attackCooldown;
            }
        } else if (dist <= this.aggroRange) {
            this.state = 'chase';
            const nx = dx / dist;
            const ny = dy / dist;
            this.x += nx * this.speed * dt;
            this.y += ny * this.speed * dt;
        } else {
            this.state = 'idle';
        }
    }

    takeDamage(amount, knockbackX = 0, knockbackY = 0) {
        if (!this.alive) return;
        this.hp = Math.max(0, this.hp - amount);
        this.hitFlashTimer = 150;
        // 突進中はノックバック無効
        if (this.state !== 'charging' && this.state !== 'charge_windup') {
            this.x += knockbackX;
            this.y += knockbackY;
        }
        if (this.hp <= 0) {
            this.alive = false;
            this.state = 'dead';
        }
    }

    respawn() {
        this.hp = this.maxHp;
        this.alive = true;
        this.state = 'idle';
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.attackTimer = 0;
        this.hitFlashTimer = 0;
        this.chargeCooldownTimer = 0;
        this.chargeTimer = 0;
        this.chargeWindupTimer = 0;
    }

    generateDrops() {
        const drops = [];
        const table = DROP_TABLES[this.dropTableId];
        if (!table) return drops;
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        for (const entry of table) {
            if (Math.random() < entry.chance) {
                const count = entry.minCount + Math.floor(
                    Math.random() * (entry.maxCount - entry.minCount + 1)
                );
                const item = new DroppedItem(cx, cy, entry.materialId, count);
                item.setScatter(cx, cy);
                drops.push(item);
            }
        }
        return drops;
    }

    draw(ctx) {
        if (!this.alive) return;

        // 突進予告エフェクト（赤い警告円）
        if (this.state === 'charge_windup') {
            const progress = 1 - (this.chargeWindupTimer / this.chargeWindupDuration);
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            const pulseAlpha = 0.3 + Math.sin(progress * Math.PI * 4) * 0.2;
            ctx.strokeStyle = `rgba(255, 50, 50, ${pulseAlpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, this.width * 0.8 + progress * 20, 0, Math.PI * 2);
            ctx.stroke();
            // 内側の赤いオーラ
            ctx.fillStyle = `rgba(255, 0, 0, ${pulseAlpha * 0.3})`;
            ctx.beginPath();
            ctx.arc(cx, cy, this.width * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }

        // 突進中の残像エフェクト
        if (this.state === 'charging') {
            ctx.fillStyle = 'rgba(255, 100, 50, 0.2)';
            ctx.fillRect(
                this.x - this.chargeDir.x * 20,
                this.y - this.chargeDir.y * 20,
                this.width, this.height
            );
        }

        // 本体描画
        if (this.hitFlashTimer > 0) {
            ctx.fillStyle = '#ffffff';
        } else if (this.state === 'charging') {
            ctx.fillStyle = '#ff6633';
        } else {
            ctx.fillStyle = this.color;
        }
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // 目の描画（サイズに応じてスケール）
        const eyeScale = this.width / 64;
        const eyeSize = 10 * eyeScale;
        const pupilSize = 4 * eyeScale;
        const eyeY = this.y + 16 * eyeScale;
        const eyeLeftX = this.x + 14 * eyeScale;
        const eyeRightX = this.x + 40 * eyeScale;

        ctx.fillStyle = this.isBoss ? '#ff4444' : '#ffcc00';
        ctx.fillRect(eyeLeftX, eyeY, eyeSize, eyeSize);
        ctx.fillRect(eyeRightX, eyeY, eyeSize, eyeSize);

        ctx.fillStyle = '#000000';
        ctx.fillRect(eyeLeftX + 4 * eyeScale, eyeY + 3 * eyeScale, pupilSize, pupilSize + 1);
        ctx.fillRect(eyeRightX + 4 * eyeScale, eyeY + 3 * eyeScale, pupilSize, pupilSize + 1);

        // ボスの角（Giant Drake装飾）
        if (this.isBoss) {
            ctx.fillStyle = this.hitFlashTimer > 0 ? '#ffffff' : '#661111';
            // 左角
            ctx.beginPath();
            ctx.moveTo(this.x + 10, this.y);
            ctx.lineTo(this.x - 5, this.y - 20);
            ctx.lineTo(this.x + 25, this.y);
            ctx.closePath();
            ctx.fill();
            // 右角
            ctx.beginPath();
            ctx.moveTo(this.x + this.width - 25, this.y);
            ctx.lineTo(this.x + this.width + 5, this.y - 20);
            ctx.lineTo(this.x + this.width - 10, this.y);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// ========================================
// ゲームメインクラス
// ========================================
class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.keys = {};

        // ゲーム状態: 'lobby','playing','inventory','craft','result','gameover'
        this.state = 'lobby';
        this.lastTime = 0;

        // フィールドオブジェクト
        this.droppedItems = [];
        this.arrows = [];

        // モンスターを配列で管理
        this.monsters = [];

        // クエスト関連
        this.currentQuest = null;
        this.questRewards = [];       // クエスト完了時の報酬
        this.resultTimer = 0;         // 結果画面タイマー
        this.resultDuration = 5;      // 5秒で自動ロビー
        this.questSuccess = false;

        // ロビーのカーソル位置
        this.lobbyCursor = 0;

        // クラフト画面のカーソル位置
        this.craftCursor = 0;
        this.craftMessage = '';
        this.craftMessageTimer = 0;

        // 武器切り替えメッセージ
        this.weaponSwitchMessage = '';
        this.weaponSwitchTimer = 0;

        // マウス位置（ロビーのクリック用）
        this.mouseX = 0;
        this.mouseY = 0;

        // 永続インベントリ
        this.inventory = new Inventory();

        // イベントリスナー設定
        this.setupInput();

        // ゲームループ開始
        requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * クエストを開始してフィールドへ遷移
     * @param {Object} quest - クエスト定義
     */
    startQuest(quest) {
        this.currentQuest = quest;

        // プレイヤー初期化
        this.player = new Player(
            this.canvas.width / 2 - 16,
            this.canvas.height - 80,
            this.inventory
        );

        // モンスター配列を生成
        this.monsters = quest.monsters.map(
            m => new Monster(m.name, m.x, m.y, m.config)
        );

        this.droppedItems = [];
        this.arrows = [];
        this.questSuccess = false;
        this.state = 'playing';
    }

    /**
     * 入力イベントの設定
     */
    setupInput() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;

            // --- ロビー画面 ---
            if (this.state === 'lobby') {
                if (key === 'arrowup' || key === 'w') {
                    this.lobbyCursor = Math.max(0, this.lobbyCursor - 1);
                } else if (key === 'arrowdown' || key === 's') {
                    this.lobbyCursor = Math.min(QUESTS.length - 1, this.lobbyCursor + 1);
                } else if (key === 'enter' || key === 'z') {
                    this.startQuest(QUESTS[this.lobbyCursor]);
                }
                // ロビーでもインベントリ・クラフトは開ける
                if (key === 'i') { this.state = 'inventory'; this._returnToLobby = true; return; }
                if (key === 'c') { this.state = 'craft'; this.craftCursor = 0; this._returnToLobby = true; return; }
                return;
            }

            // --- 結果画面 ---
            if (this.state === 'result') {
                if (key === 'r' || key === 'enter') {
                    this.state = 'lobby';
                }
                return;
            }

            // --- ゲームオーバー画面 ---
            if (this.state === 'gameover') {
                if (key === 'r') {
                    this.state = 'lobby';
                }
                return;
            }

            // --- インベントリ開閉 ---
            if (key === 'i') {
                if (this.state === 'inventory') {
                    this.state = this._returnToLobby ? 'lobby' : 'playing';
                    this._returnToLobby = false;
                } else if (this.state === 'playing') {
                    this.state = 'inventory';
                    this._returnToLobby = false;
                }
                return;
            }

            // --- クラフト画面開閉 ---
            if (key === 'c') {
                if (this.state === 'craft') {
                    this.state = this._returnToLobby ? 'lobby' : 'playing';
                    this._returnToLobby = false;
                } else if (this.state === 'playing') {
                    this.state = 'craft';
                    this.craftCursor = 0;
                    this._returnToLobby = false;
                }
                return;
            }

            // --- クラフト画面内操作 ---
            if (this.state === 'craft') {
                if (key === 'arrowup' || key === 'w') {
                    this.craftCursor = Math.max(0, this.craftCursor - 1);
                } else if (key === 'arrowdown' || key === 's') {
                    this.craftCursor = Math.min(RECIPES.length - 1, this.craftCursor + 1);
                } else if (key === 'enter' || key === 'z') {
                    this.executeCraft();
                }
                return;
            }

            // --- プレイ中 ---
            if (this.state !== 'playing') return;

            if (key === 'z') this.handleAttack();
            if (key === 'q') {
                this.player.cycleWeapon();
                this.weaponSwitchMessage = `Equipped: ${this.player.weapon.name}`;
                this.weaponSwitchTimer = 1500;
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // マウスクリック（ロビー用）
        this.canvas.addEventListener('click', (e) => {
            if (this.state !== 'lobby') return;
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            // クエストカードのクリック判定
            const cardW = 600;
            const cardH = 100;
            const cardX = (800 - cardW) / 2;
            let cardY = 140;

            for (let i = 0; i < QUESTS.length; i++) {
                if (mx >= cardX && mx <= cardX + cardW &&
                    my >= cardY && my <= cardY + cardH) {
                    this.lobbyCursor = i;
                    this.startQuest(QUESTS[i]);
                    return;
                }
                cardY += cardH + 20;
            }
        });

        // マウス移動（ホバー検出用）
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });
    }

    executeCraft() {
        const recipe = RECIPES[this.craftCursor];
        if (!recipe) return;
        if (this.inventory.alreadyOwns(recipe)) {
            this.craftMessage = 'Already owned!';
            this.craftMessageTimer = 1500;
            return;
        }
        if (this.inventory.craft(recipe)) {
            this.craftMessage = `Crafted: ${recipe.name}!`;
            this.craftMessageTimer = 2000;
        } else {
            this.craftMessage = 'Not enough materials!';
            this.craftMessageTimer = 1500;
        }
    }

    handleAttack() {
        if (this.player.attackCooldown > 0) return;

        if (this.player.weapon.type === 'ranged') {
            this.player.attack();
            const cx = this.player.x + this.player.width / 2;
            const cy = this.player.y + this.player.height / 2;
            this.arrows.push(new Arrow(cx, cy, this.player.facing, this.player.weapon.damage));
            return;
        }

        const hitbox = this.player.attack();
        if (!hitbox) return;

        // 全モンスターとの衝突判定
        for (const monster of this.monsters) {
            if (monster.alive && this.checkCollision(hitbox, monster)) {
                this.applyMeleeDamageToMonster(monster);
            }
        }
    }

    applyMeleeDamageToMonster(monster) {
        const dx = (monster.x + monster.width / 2) - (this.player.x + this.player.width / 2);
        const dy = (monster.y + monster.height / 2) - (this.player.y + this.player.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const kb = this.player.weapon.knockback;
        monster.takeDamage(
            this.player.weapon.damage,
            (dx / dist) * kb,
            (dy / dist) * kb
        );
        Sound.playHit();
        if (!monster.alive) {
            this.onMonsterDefeated(monster);
        }
    }

    onMonsterDefeated(monster) {
        // ドロップアイテム生成
        const drops = monster.generateDrops();
        this.droppedItems.push(...drops);

        // 全モンスター討伐チェック
        if (this.monsters.every(m => !m.alive)) {
            this.questSuccess = true;
            // クエスト報酬を付与
            this.questRewards = this.currentQuest.rewards.map(r => ({ ...r }));
            for (const reward of this.questRewards) {
                this.inventory.addMaterial(reward.materialId, reward.count);
            }
            Sound.playQuestComplete();
            this.resultTimer = this.resultDuration;
            this.state = 'result';
        }
    }

    checkCollision(a, b) {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    loop(timestamp) {
        const dt = this.lastTime ? (timestamp - this.lastTime) / 1000 : 0;
        this.lastTime = timestamp;
        const clampedDt = Math.min(dt, 0.1);
        this.update(clampedDt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // タイマー系は常に更新
        if (this.craftMessageTimer > 0) this.craftMessageTimer -= dt * 1000;
        if (this.weaponSwitchTimer > 0) this.weaponSwitchTimer -= dt * 1000;

        // 結果画面の自動遷移タイマー
        if (this.state === 'result') {
            this.resultTimer -= dt;
            if (this.resultTimer <= 0) {
                this.state = 'lobby';
            }
            return;
        }

        // ゲームオーバーの自動遷移タイマー
        if (this.state === 'gameover') {
            this.resultTimer -= dt;
            if (this.resultTimer <= 0) {
                this.state = 'lobby';
            }
            return;
        }

        if (this.state !== 'playing') return;

        // プレイヤー更新
        this.player.update(dt, this.keys, this.canvas.width, this.canvas.height);

        // 全モンスター更新
        for (const monster of this.monsters) {
            if (monster.alive) {
                monster.update(dt, this.player);
            }
        }

        // 矢の更新と衝突判定
        for (const arrow of this.arrows) {
            arrow.update(dt, this.canvas.width, this.canvas.height);
            if (arrow.alive) {
                for (const monster of this.monsters) {
                    if (monster.alive) {
                        const arrowBox = {
                            x: arrow.x - arrow.width / 2,
                            y: arrow.y - arrow.height / 2,
                            width: arrow.width,
                            height: arrow.height,
                        };
                        if (this.checkCollision(arrowBox, monster)) {
                            monster.takeDamage(arrow.damage, 0, 0);
                            arrow.alive = false;
                            Sound.playHit();
                            if (!monster.alive) {
                                this.onMonsterDefeated(monster);
                            }
                            break;
                        }
                    }
                }
            }
        }
        this.arrows = this.arrows.filter(a => a.alive);

        // ドロップアイテム更新と取得判定
        for (const item of this.droppedItems) {
            item.update(dt);
            if (!item.collected && item.animProgress >= 1) {
                const dx = (this.player.x + this.player.width / 2) - item.x;
                const dy = (this.player.y + this.player.height / 2) - item.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 32) {
                    item.collected = true;
                    item.collectEffectTimer = item.collectEffectDuration;
                    this.inventory.addMaterial(item.materialId, item.count);
                    Sound.playPickup();
                }
            }
        }
        this.droppedItems = this.droppedItems.filter(item => !item.isFullyDone());

        // ゲームオーバー判定
        if (this.player.hp <= 0) {
            this.questSuccess = false;
            Sound.playQuestFailed();
            this.resultTimer = this.resultDuration;
            this.state = 'gameover';
        }
    }

    // ========================================
    // 描画処理
    // ========================================

    draw() {
        const ctx = this.ctx;

        if (this.state === 'lobby') {
            this.drawLobby(ctx);
            return;
        }

        // フィールド描画
        this.drawBackground(ctx);
        for (const item of this.droppedItems) item.draw(ctx);
        for (const arrow of this.arrows) arrow.draw(ctx);
        for (const monster of this.monsters) monster.draw(ctx);
        if (this.player) this.player.draw(ctx);
        this.drawUI(ctx);

        // オーバーレイ
        if (this.state === 'gameover') {
            this.drawResultScreen(ctx, false);
        } else if (this.state === 'result') {
            this.drawResultScreen(ctx, true);
        } else if (this.state === 'inventory') {
            this.drawInventory(ctx);
        } else if (this.state === 'craft') {
            this.drawCraftMenu(ctx);
        }
    }

    drawBackground(ctx) {
        ctx.fillStyle = '#3a7d44';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const tileSize = 32;
        for (let y = 0; y < this.canvas.height; y += tileSize) {
            for (let x = 0; x < this.canvas.width; x += tileSize) {
                if ((x / tileSize + y / tileSize) % 2 === 0) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
                    ctx.fillRect(x, y, tileSize, tileSize);
                }
            }
        }
    }

    // ========================================
    // ロビー画面描画
    // ========================================
    drawLobby(ctx) {
        // 背景
        ctx.fillStyle = '#0e0e1a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // タイトル
        ctx.fillStyle = '#cc8844';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MONSTER HUNT 2D', 400, 55);

        ctx.fillStyle = '#888888';
        ctx.font = '14px monospace';
        ctx.fillText('Select a Quest', 400, 85);

        // 素材所持数（右上に小さく表示）
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        let matY = 25;
        for (const [id, mat] of Object.entries(MATERIALS)) {
            const count = this.inventory.getMaterialCount(id);
            ctx.fillStyle = mat.color;
            ctx.beginPath();
            ctx.arc(740, matY - 3, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#aaaaaa';
            ctx.fillText(`${mat.name}: ${count}`, 780, matY);
            matY += 18;
        }

        // クエストカード描画
        const cardW = 600;
        const cardH = 100;
        const cardX = (800 - cardW) / 2;
        let cardY = 120;

        for (let i = 0; i < QUESTS.length; i++) {
            const quest = QUESTS[i];
            const isSelected = i === this.lobbyCursor;

            // ホバー検出
            const isHovered = this.mouseX >= cardX && this.mouseX <= cardX + cardW &&
                              this.mouseY >= cardY && this.mouseY <= cardY + cardH;

            // カード背景
            if (isSelected) {
                ctx.fillStyle = '#1a2a3a';
                ctx.strokeStyle = '#cc8844';
                ctx.lineWidth = 2;
            } else if (isHovered) {
                ctx.fillStyle = '#151525';
                ctx.strokeStyle = '#555555';
                ctx.lineWidth = 1;
            } else {
                ctx.fillStyle = '#111122';
                ctx.strokeStyle = '#333344';
                ctx.lineWidth = 1;
            }
            ctx.fillRect(cardX, cardY, cardW, cardH);
            ctx.strokeRect(cardX, cardY, cardW, cardH);

            // 難易度の星
            const stars = this.getDifficultyStars(quest.difficulty);
            ctx.fillStyle = '#ffcc44';
            ctx.font = '14px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(stars, cardX + 15, cardY + 25);

            // クエスト名
            ctx.fillStyle = isSelected ? '#ffffff' : '#cccccc';
            ctx.font = 'bold 18px monospace';
            ctx.fillText(quest.name, cardX + 15, cardY + 50);

            // 説明
            ctx.fillStyle = '#888888';
            ctx.font = '12px monospace';
            ctx.fillText(quest.description, cardX + 15, cardY + 70);

            // 報酬表示
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '11px monospace';
            let rewardText = 'Reward: ';
            for (const r of quest.rewards) {
                rewardText += `${MATERIALS[r.materialId].name} x${r.count}  `;
            }
            ctx.fillText(rewardText, cardX + 15, cardY + 90);

            // 選択カーソル
            if (isSelected) {
                ctx.fillStyle = '#cc8844';
                ctx.font = 'bold 20px monospace';
                ctx.textAlign = 'right';
                ctx.fillText('>', cardX - 5, cardY + 52);
            }

            cardY += cardH + 20;
        }

        // 操作案内
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('W/S:Select  Z/Enter/Click:Start  I:Inventory  C:Craft', 400, 580);
    }

    /**
     * 難易度を星文字列に変換
     * @param {number} level - 難易度 1〜3
     * @returns {string}
     */
    getDifficultyStars(level) {
        let s = '';
        for (let i = 0; i < 3; i++) {
            s += i < level ? '\u2605' : '\u2606';
        }
        return s;
    }

    // ========================================
    // フィールドUI描画
    // ========================================
    drawUI(ctx) {
        // === プレイヤーHPバー（左上） ===
        const pBarX = 20;
        const pBarY = 20;
        const pBarW = 200;
        const pBarH = 20;

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('PLAYER HP', pBarX, pBarY - 5);

        ctx.fillStyle = '#333333';
        ctx.fillRect(pBarX, pBarY, pBarW, pBarH);
        const pHpRatio = this.player.hp / this.player.maxHp;
        ctx.fillStyle = pHpRatio > 0.3 ? '#44cc44' : '#cc4444';
        ctx.fillRect(pBarX, pBarY, pBarW * pHpRatio, pBarH);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(pBarX, pBarY, pBarW, pBarH);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.player.hp} / ${this.player.maxHp}`, pBarX + pBarW / 2, pBarY + 15);

        // === モンスターHPバー（上部中央）===
        // 生存中のモンスターのHPバーを順番に表示
        const aliveMonsters = this.monsters.filter(m => m.alive);
        if (aliveMonsters.length > 0) {
            const mBarW = 300;
            const mBarH = 18;
            let mBarY = 25;

            for (const monster of aliveMonsters) {
                const mBarX = (this.canvas.width - mBarW) / 2;

                // モンスター名
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 13px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(monster.name, this.canvas.width / 2, mBarY - 4);

                ctx.fillStyle = '#333333';
                ctx.fillRect(mBarX, mBarY, mBarW, mBarH);
                const mHpRatio = monster.hp / monster.maxHp;
                // ボスはオレンジ、通常は赤
                ctx.fillStyle = monster.isBoss ? '#cc6622' : '#cc3333';
                ctx.fillRect(mBarX, mBarY, mBarW * mHpRatio, mBarH);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(mBarX, mBarY, mBarW, mBarH);

                ctx.fillStyle = '#ffffff';
                ctx.font = '11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`${monster.hp} / ${monster.maxHp}`, this.canvas.width / 2, mBarY + 14);

                mBarY += mBarH + 22;
            }
        }

        // === 現在装備中の武器・防具（右下） ===
        const equipBoxX = this.canvas.width - 210;
        let equipBoxY = this.canvas.height - 55;

        // 防具表示
        if (this.player.armor) {
            equipBoxY -= 22;
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        const equipH = this.player.armor ? 57 : 35;
        ctx.fillRect(equipBoxX, equipBoxY, 195, equipH);
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        ctx.strokeRect(equipBoxX, equipBoxY, 195, equipH);

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Weapon: ${this.player.weapon.name}`, equipBoxX + 8, equipBoxY + 15);

        const typeLabel = this.player.weapon.type === 'ranged' ? 'Ranged' : 'Melee';
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '10px monospace';
        ctx.fillText(`[${typeLabel}] DMG:${this.player.weapon.damage}  Q:Switch`, equipBoxX + 8, equipBoxY + 28);

        if (this.player.armor) {
            ctx.fillStyle = '#aaddff';
            ctx.font = '12px monospace';
            ctx.fillText(
                `Armor: ${this.player.armor.name} (x${this.player.armor.damageMultiplier})`,
                equipBoxX + 8,
                equipBoxY + 45
            );
        }

        // === 武器切り替えメッセージ ===
        if (this.weaponSwitchTimer > 0) {
            const alpha = Math.min(1, this.weaponSwitchTimer / 300);
            ctx.fillStyle = `rgba(255, 255, 100, ${alpha})`;
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.weaponSwitchMessage, this.canvas.width / 2, this.canvas.height / 2 + 100);
        }

        // === 操作説明 ===
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WASD:Move  Z:Attack  Q:Switch  I:Inventory  C:Craft', this.canvas.width / 2, this.canvas.height - 10);
    }

    // ========================================
    // クエスト結果画面描画
    // ========================================
    drawResultScreen(ctx, success) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        if (success) {
            // === クエスト完了 ===
            ctx.fillStyle = '#44ff44';
            ctx.font = 'bold 42px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('QUEST COMPLETE!', centerX, centerY - 80);

            // 報酬一覧
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px monospace';
            ctx.fillText('Rewards', centerX, centerY - 35);

            let rewardY = centerY - 5;
            ctx.font = '16px monospace';
            for (const reward of this.questRewards) {
                const mat = MATERIALS[reward.materialId];
                // アイコン
                ctx.fillStyle = mat.color;
                ctx.beginPath();
                ctx.arc(centerX - 80, rewardY - 4, 6, 0, Math.PI * 2);
                ctx.fill();
                // テキスト
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'left';
                ctx.fillText(`${mat.name}  x${reward.count}`, centerX - 65, rewardY);
                rewardY += 30;
            }
        } else {
            // === クエスト失敗 ===
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 42px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('QUEST FAILED...', centerX, centerY - 40);
        }

        // 自動遷移カウントダウン
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        const remaining = Math.max(0, Math.ceil(this.resultTimer));
        ctx.fillText(`Returning to lobby in ${remaining}s  (R: now)`, centerX, centerY + 80);
    }

    // ========================================
    // インベントリ画面描画
    // ========================================
    drawInventory(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const panelX = 100;
        const panelY = 60;
        const panelW = 600;
        const panelH = 480;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#4488cc';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.fillStyle = '#4488cc';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('INVENTORY', this.canvas.width / 2, panelY + 35);

        // 素材セクション
        let y = panelY + 70;
        ctx.fillStyle = '#88ccff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Materials', panelX + 30, y);
        y += 10;
        ctx.strokeStyle = '#333355'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(panelX + 30, y); ctx.lineTo(panelX + panelW - 30, y); ctx.stroke();
        y += 25;
        ctx.font = '14px monospace';
        let hasMaterials = false;
        for (const [id, mat] of Object.entries(MATERIALS)) {
            const count = this.inventory.getMaterialCount(id);
            if (count > 0) {
                hasMaterials = true;
                ctx.fillStyle = mat.color;
                ctx.beginPath(); ctx.arc(panelX + 45, y - 4, 6, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`${mat.name} (${mat.description})`, panelX + 60, y);
                ctx.fillStyle = '#ffcc44';
                ctx.textAlign = 'right';
                ctx.fillText(`x${count}`, panelX + panelW - 40, y);
                ctx.textAlign = 'left';
                y += 28;
            }
        }
        if (!hasMaterials) {
            ctx.fillStyle = '#666666';
            ctx.fillText('No materials', panelX + 60, y);
            y += 28;
        }

        // 武器セクション
        y += 15;
        ctx.fillStyle = '#ffcc44';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('Weapons', panelX + 30, y);
        y += 10;
        ctx.strokeStyle = '#333355';
        ctx.beginPath(); ctx.moveTo(panelX + 30, y); ctx.lineTo(panelX + panelW - 30, y); ctx.stroke();
        y += 25;
        ctx.font = '14px monospace';
        for (const weapon of this.inventory.weapons) {
            const isEquipped = this.player && weapon === this.player.weapon;
            const typeLabel = weapon.type === 'ranged' ? 'Ranged' : 'Melee';
            if (isEquipped) { ctx.fillStyle = '#44ff44'; ctx.fillText('E', panelX + 35, y); }
            ctx.fillStyle = isEquipped ? '#ffffff' : '#aaaaaa';
            ctx.fillText(`${weapon.name}`, panelX + 60, y);
            ctx.fillStyle = '#888888';
            ctx.textAlign = 'right';
            ctx.fillText(`[${typeLabel}] DMG:${weapon.damage} RNG:${weapon.range}`, panelX + panelW - 40, y);
            ctx.textAlign = 'left';
            y += 28;
        }

        // 防具セクション
        y += 15;
        ctx.fillStyle = '#aaddff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('Armor', panelX + 30, y);
        y += 10;
        ctx.strokeStyle = '#333355';
        ctx.beginPath(); ctx.moveTo(panelX + 30, y); ctx.lineTo(panelX + panelW - 30, y); ctx.stroke();
        y += 25;
        ctx.font = '14px monospace';
        if (this.inventory.armors.length === 0) {
            ctx.fillStyle = '#666666';
            ctx.fillText('No armor', panelX + 60, y);
        } else {
            for (const armor of this.inventory.armors) {
                const isEquipped = this.player && armor === this.player.armor;
                if (isEquipped) { ctx.fillStyle = '#44ff44'; ctx.fillText('E', panelX + 35, y); }
                ctx.fillStyle = isEquipped ? '#ffffff' : '#aaaaaa';
                ctx.fillText(`${armor.name}`, panelX + 60, y);
                ctx.fillStyle = '#888888';
                ctx.textAlign = 'right';
                ctx.fillText(`DEF+${armor.defense} (x${armor.damageMultiplier})`, panelX + panelW - 40, y);
                ctx.textAlign = 'left';
                y += 28;
            }
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Press I to close', this.canvas.width / 2, panelY + panelH - 20);
    }

    // ========================================
    // クラフト画面描画
    // ========================================
    drawCraftMenu(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const panelX = 100;
        const panelY = 60;
        const panelW = 600;
        const panelH = 480;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#cc8844';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.fillStyle = '#cc8844';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CRAFT', this.canvas.width / 2, panelY + 35);

        let y = panelY + 70;
        for (let i = 0; i < RECIPES.length; i++) {
            const recipe = RECIPES[i];
            const canCraft = this.inventory.canCraft(recipe);
            const alreadyOwns = this.inventory.alreadyOwns(recipe);
            const isSelected = i === this.craftCursor;
            const rowH = 100;
            const rowY = y;

            if (isSelected) {
                ctx.fillStyle = 'rgba(204, 136, 68, 0.15)';
                ctx.fillRect(panelX + 15, rowY - 5, panelW - 30, rowH);
                ctx.strokeStyle = '#cc8844'; ctx.lineWidth = 1;
                ctx.strokeRect(panelX + 15, rowY - 5, panelW - 30, rowH);
                ctx.fillStyle = '#cc8844'; ctx.font = '16px monospace'; ctx.textAlign = 'left';
                ctx.fillText('>', panelX + 22, rowY + 18);
            }

            ctx.fillStyle = alreadyOwns ? '#666666' : (canCraft ? '#ffffff' : '#888888');
            ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left';
            ctx.fillText(recipe.name, panelX + 40, rowY + 18);

            if (alreadyOwns) {
                ctx.fillStyle = '#44cc44'; ctx.font = '12px monospace';
                ctx.fillText('[OWNED]', panelX + 40 + ctx.measureText(recipe.name).width + 10, rowY + 18);
            }

            ctx.fillStyle = '#aaaaaa'; ctx.font = '12px monospace';
            ctx.fillText(recipe.description, panelX + 40, rowY + 38);

            let matX = panelX + 40;
            const matY = rowY + 60;
            ctx.font = '12px monospace';
            ctx.fillText('Required: ', matX, matY);
            matX += ctx.measureText('Required: ').width;
            for (const req of recipe.materials) {
                const mat = MATERIALS[req.materialId];
                const owned = this.inventory.getMaterialCount(req.materialId);
                const enough = owned >= req.count;
                ctx.fillStyle = mat.color;
                ctx.beginPath(); ctx.arc(matX + 5, matY - 4, 5, 0, Math.PI * 2); ctx.fill();
                matX += 15;
                ctx.fillStyle = enough ? '#44cc44' : '#cc4444';
                const text = `${mat.name} ${owned}/${req.count}  `;
                ctx.fillText(text, matX, matY);
                matX += ctx.measureText(text).width;
            }

            if (isSelected && !alreadyOwns) {
                const btnX = panelX + panelW - 160;
                const btnY = rowY + 5;
                const btnW = 120; const btnH = 28;
                ctx.fillStyle = canCraft ? '#44aa44' : '#444444';
                ctx.fillRect(btnX, btnY, btnW, btnH);
                ctx.fillStyle = canCraft ? '#ffffff' : '#888888';
                ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
                ctx.fillText('CRAFT [Z]', btnX + btnW / 2, btnY + 19);
                ctx.textAlign = 'left';
            }
            y += rowH + 10;
        }

        if (this.craftMessageTimer > 0) {
            const alpha = Math.min(1, this.craftMessageTimer / 300);
            ctx.fillStyle = `rgba(255, 255, 100, ${alpha})`;
            ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
            ctx.fillText(this.craftMessage, this.canvas.width / 2, panelY + panelH - 55);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px monospace'; ctx.textAlign = 'center';
        ctx.fillText('W/S:Select  Z:Craft  C:Close', this.canvas.width / 2, panelY + panelH - 20);
    }
}

// ========================================
// ゲーム起動
// ========================================
window.addEventListener('load', () => {
    new Game('gameCanvas');
});
