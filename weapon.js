import { MATERIALS, WORLD_W, WORLD_H } from './data.js';

// ========================================
// DroppedItem / Arrow
// ========================================
export class DroppedItem {
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

export class Arrow {
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
