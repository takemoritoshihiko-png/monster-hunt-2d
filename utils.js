// ========================================
// シード付き乱数生成（フィールド配置の再現性用）
// ========================================
export class SeededRandom {
    constructor(seed) { this.seed = seed; }
    next() {
        this.seed = (this.seed * 16807 + 0) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
}

// ========================================
// パーティクルクラス
// ========================================
export class Particle {
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
export class DamageNumber {
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
export class SoundManager {
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
export const Sound = new SoundManager();

// ========================================
// 角丸矩形ヘルパー
// ========================================
export function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
}
