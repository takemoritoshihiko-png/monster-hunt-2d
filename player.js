import { WORLD_W, WORLD_H, TREE_COLLISION_R, MAX_LEVEL, EXP_TABLE, UPGRADE_DMG_MULT } from './data.js';
import { Sound } from './utils.js';

// ========================================
// プレイヤークラス（コンボ攻撃対応）
// ========================================
export class Player {
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
