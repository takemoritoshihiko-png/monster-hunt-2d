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
        this._recalcStats();
        this.hp = this.maxHp;
        this.atkCooldownBase = def ? def.atkCD : 1200;
        this.attackCooldown = 0;
        this.x = 0; this.y = 0;
        this.targetMonster = null;
        this.alive = true;
        this.width = 28; this.height = 28;
        // AI状態
        this.state = 'follow'; // 'follow' | 'chase' | 'return'
        this.hitFlashTimer = 0;
        // EXP
        this.exp = 0;
        this.expToNext = 80 + level * 40;
    }

    _recalcStats() {
        const def = COMPANION_TYPES[this.type];
        this.maxHp = Math.floor((100 + this.level * 30) * (def ? def.hpMult : 1));
        this.atk = Math.floor((10 + this.level * 5) * (def ? def.atkMult : 1));
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
            return true; // レベルアップ
        }
        return false;
    }

    takeDamage(amount) {
        if (!this.alive) return;
        this.hp = Math.max(0, this.hp - amount);
        this.hitFlashTimer = 200;
        if (this.hp <= 0) { this.alive = false; this.state = 'follow'; }
    }

    update(dt, player, monsters) {
        if (!this.alive) return null;
        if (this.attackCooldown > 0) this.attackCooldown -= dt * 1000;
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt * 1000;

        const pcx = player.x + player.width/2;
        const pcy = player.y + player.height/2;
        // プレイヤー後方のフォローポイント
        let followX = pcx, followY = pcy + 100;
        switch (player.facing) {
            case 'up':    followX = pcx; followY = pcy + 100; break;
            case 'down':  followX = pcx; followY = pcy - 100; break;
            case 'left':  followX = pcx + 100; followY = pcy; break;
            case 'right': followX = pcx - 100; followY = pcy; break;
        }

        // 最も近い生存モンスターを探す
        let closest = null, closestDist = Infinity;
        for (const m of monsters) {
            if (!m.alive) continue;
            const dx = (m.x+m.width/2) - this.x, dy = (m.y+m.height/2) - this.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            if (d < closestDist) { closest = m; closestDist = d; }
        }
        this.targetMonster = closest;

        const moveSpeed = player.baseSpeed * 0.9 * dt;

        // AI状態遷移
        if (this.targetMonster && closestDist < 200) {
            this.state = 'chase';
        } else if (this.state === 'chase') {
            this.state = 'return';
        }

        if (this.state === 'chase' && this.targetMonster) {
            // 敵に向かって突進
            const tx = this.targetMonster.x + this.targetMonster.width/2;
            const ty = this.targetMonster.y + this.targetMonster.height/2;
            const dx = tx - this.x, dy = ty - this.y;
            const d = Math.sqrt(dx*dx + dy*dy) || 1;
            if (d > 40) {
                this.x += (dx/d) * moveSpeed;
                this.y += (dy/d) * moveSpeed;
            }
            // 攻撃判定（40px以内）
            if (d <= 40 && this.attackCooldown <= 0) {
                this.targetMonster.takeDamage(this.atk, 0, 0, this.x, this.y);
                this.attackCooldown = this.atkCooldownBase;
                return { hit: true, target: this.targetMonster, dmg: this.atk };
            }
        } else {
            // プレイヤー後方に戻る
            this.state = 'follow';
            const fdx = followX - this.x, fdy = followY - this.y;
            const fd = Math.sqrt(fdx*fdx + fdy*fdy);
            if (fd > 80) {
                // 150px以上離れたら追いかける
                if (fd > 150) {
                    this.x += (fdx/fd) * moveSpeed * 1.2;
                    this.y += (fdy/fd) * moveSpeed * 1.2;
                } else if (fd > 80) {
                    this.x += (fdx/fd) * moveSpeed * 0.6;
                    this.y += (fdy/fd) * moveSpeed * 0.6;
                }
            }
            // 80px以下で停止（何もしない）
        }
        return null;
    }

    draw(ctx) {
        if (!this.alive) return;
        const cx = this.x + this.width/2, cy = this.y + this.height/2;
        // ダメージフラッシュ
        if (this.hitFlashTimer > 0) {
            ctx.fillStyle = '#ff4444';
        } else {
            ctx.fillStyle = this.color;
        }
        ctx.beginPath(); ctx.arc(cx, cy, this.width/2, 0, Math.PI*2); ctx.fill();
        // 目
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(this.x+8, this.y+10, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x+20, this.y+10, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(this.x+9, this.y+11, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x+21, this.y+11, 1.5, 0, Math.PI*2); ctx.fill();
        // Lv表示
        ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
        ctx.fillText(`Lv${this.level}`, cx, this.y-3);
        // 攻撃エフェクト
        if (this.attackCooldown > this.atkCooldownBase * 0.8) {
            ctx.strokeStyle = 'rgba(255,255,100,0.5)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, this.width/2+5, 0, Math.PI*2); ctx.stroke();
        }
        // chaseモード時のターゲット線
        if (this.state === 'chase' && this.targetMonster) {
            ctx.strokeStyle = 'rgba(255,100,100,0.2)'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(this.targetMonster.x+this.targetMonster.width/2, this.targetMonster.y+this.targetMonster.height/2);
            ctx.stroke();
        }
    }

    serialize() {
        return { type: this.type, level: this.level, exp: this.exp };
    }

    static deserialize(data) {
        const c = new Companion(data.type, data.level);
        c.exp = data.exp || 0;
        return c;
    }
}
