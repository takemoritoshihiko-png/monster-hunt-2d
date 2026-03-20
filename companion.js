import { COMPANION_TYPES } from './data.js';

// ========================================
// 仲間モンスタークラス
// ========================================
export class Companion {
    constructor(type, level = 1) {
        this.type = type;
        const def = COMPANION_TYPES[type];
        this.name = def ? def.name : type;
        this.color = def ? def.color : '#888';
        this.level = level;
        this.maxHp = Math.floor((100 + level * 30) * (def ? def.hpMult : 1));
        this.hp = this.maxHp;
        this.atk = Math.floor((10 + level * 5) * (def ? def.atkMult : 1));
        this.atkCooldownBase = def ? def.atkCD : 1200;
        this.attackCooldown = 0;
        this.x = 0;
        this.y = 0;
        this.targetMonster = null;
        this.alive = true;
        // 描画サイズ
        this.width = 28;
        this.height = 28;
        this.followDist = 60; // プレイヤーとの追従距離
    }

    update(dt, player, monsters) {
        if (!this.alive) return;
        // 攻撃クールダウン
        if (this.attackCooldown > 0) this.attackCooldown -= dt * 1000;

        // プレイヤーに追従
        const pdx = player.x - this.x, pdy = player.y - this.y;
        const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
        if (pdist > this.followDist) {
            const spd = 280 * dt;
            this.x += (pdx / pdist) * spd;
            this.y += (pdy / pdist) * spd;
        }

        // 最も近い生存モンスターをターゲット
        let closest = null, closestDist = 250;
        for (const m of monsters) {
            if (!m.alive) continue;
            const dx = (m.x+m.width/2) - this.x, dy = (m.y+m.height/2) - this.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            if (d < closestDist) { closest = m; closestDist = d; }
        }
        this.targetMonster = closest;

        // 攻撃
        if (this.targetMonster && this.attackCooldown <= 0 && closestDist < 150) {
            this.targetMonster.takeDamage(this.atk, 0, 0, this.x, this.y);
            this.attackCooldown = this.atkCooldownBase;
            return { hit: true, target: this.targetMonster, dmg: this.atk };
        }
        return null;
    }

    draw(ctx) {
        if (!this.alive) return;
        // 仲間の円形表示
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI*2);
        ctx.fill();
        // 目
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x+8, this.y+10, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x+20, this.y+10, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(this.x+9, this.y+11, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x+21, this.y+11, 1.5, 0, Math.PI*2); ctx.fill();
        // Lv表示
        ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
        ctx.fillText(`Lv${this.level}`, this.x+this.width/2, this.y-3);
        // 攻撃エフェクト
        if (this.attackCooldown > this.atkCooldownBase * 0.8) {
            ctx.strokeStyle = `rgba(255,255,100,0.5)`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x+this.width/2, this.y+this.height/2, this.width/2+5, 0, Math.PI*2); ctx.stroke();
        }
    }

    serialize() {
        return { type: this.type, level: this.level };
    }

    static deserialize(data) {
        return new Companion(data.type, data.level);
    }
}
