import { COMPANION_TYPES } from './data.js';

// 仲間スキル定義
const COMPANION_SKILLS = {
    forest_drake: [
        { level: 3, id: 'flame_claw',  name: '炎の爪',   desc: '攻撃に炎属性・DMG+15%' },
        { level: 5, id: 'rush',        name: '突進',     desc: '5秒ごとに自動突進・DMG×2' },
        { level: 8, id: 'pack_king',   name: '群れの王', desc: '周囲の敵に範囲攻撃' },
    ],
    ice_wolf: [
        { level: 3, id: 'ice_breath',  name: '氷の息',   desc: '前方に氷ブレス・凍結' },
        { level: 5, id: 'gale',        name: '疾風',     desc: '移動速度+40%' },
        { level: 8, id: 'blizzard',    name: '吹雪',     desc: '全敵に氷DMG+凍結' },
    ],
    giant_drake_mini: [
        { level: 3, id: 'stomp',       name: '踏みつけ', desc: '周囲円形攻撃' },
        { level: 5, id: 'iron_wall',   name: '鉄壁',     desc: 'プレイヤー被ダメ30%肩代わり' },
        { level: 8, id: 'roar',        name: '覇王の咆哮', desc: '全敵ATK-30%・5秒' },
    ],
};

// パーティボーナス定義
export const PARTY_BONUSES = [
    { types: ['forest_drake','ice_wolf'],        name: '属性共鳴',   desc: '全DMG+15%',    dmgMult: 1.15, defMult: 1 },
    { types: ['forest_drake','forest_drake'],    name: '群れ戦術',   desc: '移動速度+20%', dmgMult: 1, defMult: 1, speedMult: 1.2 },
    { types: ['ice_wolf','ice_wolf'],            name: '氷嵐',       desc: '攻撃に氷属性', dmgMult: 1, defMult: 1, iceAtk: true },
    { types: ['giant_drake_mini'],               name: '重装パーティ', desc: '被DMG-20%',   dmgMult: 1, defMult: 0.8 },
];

export class Companion {
    constructor(type, level = 1) {
        this.type = type;
        const def = COMPANION_TYPES[type];
        this.name = def ? def.name : type;
        this.color = def ? def.color : '#888';
        this.level = level;
        this._recalcStats();
        this.hp = this.maxHp;
        this.atkCooldownBase = def ? def.atkCD : 1200;
        this.attackCooldown = 0;
        this.x = 0; this.y = 0;
        this.targetMonster = null;
        this.alive = true;
        this.width = 28; this.height = 28;
        this.state = 'follow';
        this.hitFlashTimer = 0;
        this.exp = 0;
        this.expToNext = 80 + level * 40;
        this.totalKills = 0;
        // 装備
        this.equippedWeapon = null;  // Weapon instance or null
        this.equippedArmor = null;   // Armor instance or null
        // スキル
        this.unlockedSkills = [];
        this._checkSkillUnlocks();
        // 特殊タイマー
        this.rushTimer = 0;
        this.roarTimer = 0;
        // 追従オフセット（パーティ位置）
        this.followOffsetX = 0;
        this.followOffsetY = 0;
    }

    _recalcStats() {
        const def = COMPANION_TYPES[this.type];
        this.maxHp = Math.floor((100 + this.level * 30) * (def ? def.hpMult : 1));
        this.baseAtk = Math.floor((10 + this.level * 5) * (def ? def.atkMult : 1));
        this.atk = this.baseAtk + (this.equippedWeapon ? this.equippedWeapon.damage : 0);
        // 炎の爪スキル
        if (this.hasSkill('flame_claw')) this.atk = Math.floor(this.atk * 1.15);
    }

    hasSkill(id) { return this.unlockedSkills.includes(id); }

    _checkSkillUnlocks() {
        const skills = COMPANION_SKILLS[this.type] || [];
        for (const s of skills) {
            if (this.level >= s.level && !this.unlockedSkills.includes(s.id)) {
                this.unlockedSkills.push(s.id);
            }
        }
    }

    addExp(amount) {
        if (!this.alive) return false;
        this.exp += amount;
        if (this.exp >= this.expToNext) {
            this.exp -= this.expToNext;
            this.level++;
            this._recalcStats();
            this.hp = this.maxHp;
            this.expToNext = 80 + this.level * 40;
            this._checkSkillUnlocks();
            return true;
        }
        return false;
    }

    takeDamage(amount) {
        if (!this.alive) return;
        // 装備防具による軽減
        const armorMult = this.equippedArmor ? this.equippedArmor.damageMultiplier : 1.0;
        this.hp = Math.max(0, this.hp - Math.max(1, Math.floor(amount * armorMult)));
        this.hitFlashTimer = 200;
        if (this.hp <= 0) { this.alive = false; this.state = 'follow'; }
    }

    update(dt, player, monsters) {
        if (!this.alive) return null;
        if (this.attackCooldown > 0) this.attackCooldown -= dt * 1000;
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt * 1000;
        if (this.rushTimer > 0) this.rushTimer -= dt * 1000;
        if (this.roarTimer > 0) this.roarTimer -= dt * 1000;

        const pcx = player.x + player.width/2 + this.followOffsetX;
        const pcy = player.y + player.height/2 + this.followOffsetY;

        // 敵探索
        let closest = null, closestDist = Infinity;
        for (const m of monsters) {
            if (!m.alive) continue;
            const dx = (m.x+m.width/2) - this.x, dy = (m.y+m.height/2) - this.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            if (d < closestDist) { closest = m; closestDist = d; }
        }
        this.targetMonster = closest;

        const moveSpeed = (player.baseSpeed * 0.9 + (this.hasSkill('gale') ? player.baseSpeed*0.36 : 0)) * dt;

        if (this.targetMonster && closestDist < 150) {
            this.state = 'chase';
            const tx = this.targetMonster.x+this.targetMonster.width/2;
            const ty = this.targetMonster.y+this.targetMonster.height/2;
            const dx = tx-this.x, dy = ty-this.y;
            const d = Math.sqrt(dx*dx+dy*dy)||1;
            if (d > 40) { this.x += (dx/d)*moveSpeed; this.y += (dy/d)*moveSpeed; }

            // 突進スキル（Lv5 Forest Drake）
            if (this.hasSkill('rush') && this.rushTimer <= 0 && d < 120) {
                this.targetMonster.takeDamage(this.atk*2, 0, 0, this.x, this.y);
                this.rushTimer = 5000;
                return { hit:true, target:this.targetMonster, dmg:this.atk*2, isRush:true };
            }

            // 通常攻撃
            if (d <= 40 && this.attackCooldown <= 0) {
                this.targetMonster.takeDamage(this.atk, 0, 0, this.x, this.y);
                this.attackCooldown = this.atkCooldownBase;
                this.totalKills += (!this.targetMonster.alive ? 1 : 0);
                return { hit:true, target:this.targetMonster, dmg:this.atk };
            }
        } else {
            this.state = 'follow';
            const fdx = pcx-this.x, fdy = pcy-this.y;
            const fd = Math.sqrt(fdx*fdx+fdy*fdy);
            if (fd > 80) {
                const spd = fd > 150 ? moveSpeed*1.2 : moveSpeed*0.6;
                this.x += (fdx/fd)*spd; this.y += (fdy/fd)*spd;
            }
        }
        return null;
    }

    draw(ctx) {
        if (!this.alive) return;
        const cx = this.x+this.width/2, cy = this.y+this.height/2;
        ctx.fillStyle = this.hitFlashTimer > 0 ? '#ff4444' : this.color;
        ctx.beginPath(); ctx.arc(cx, cy, this.width/2, 0, Math.PI*2); ctx.fill();
        // 装備表示（武器があれば小さい印）
        if (this.equippedWeapon) {
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(cx+8, cy-12, 4, 8);
        }
        ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
        ctx.fillText(`Lv${this.level}`, cx, this.y-3);
        if (this.attackCooldown > this.atkCooldownBase*0.8) {
            ctx.strokeStyle = 'rgba(255,255,100,0.5)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, this.width/2+5, 0, Math.PI*2); ctx.stroke();
        }
        if (this.state === 'chase' && this.targetMonster) {
            ctx.strokeStyle = 'rgba(255,100,100,0.2)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.lineTo(this.targetMonster.x+this.targetMonster.width/2, this.targetMonster.y+this.targetMonster.height/2);
            ctx.stroke();
        }
    }

    serialize() {
        return {
            type: this.type, level: this.level, exp: this.exp,
            totalKills: this.totalKills,
            unlockedSkills: [...this.unlockedSkills],
            equippedWeaponName: this.equippedWeapon ? this.equippedWeapon.name : null,
            equippedArmorName: this.equippedArmor ? this.equippedArmor.name : null,
        };
    }

    static deserialize(data) {
        const c = new Companion(data.type, data.level);
        c.exp = data.exp || 0;
        c.totalKills = data.totalKills || 0;
        c.unlockedSkills = data.unlockedSkills || [];
        return c;
    }

    static getSkills(type) { return COMPANION_SKILLS[type] || []; }
}
