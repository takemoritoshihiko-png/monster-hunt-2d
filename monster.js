import { WORLD_W, WORLD_H, DROP_TABLES, MATERIALS } from './data.js';
import { Particle, DamageNumber, Sound } from './utils.js';
import { DroppedItem } from './weapon.js';

// ========================================
// モンスタークラス（遅延HPバー対応）
// ========================================
export class Monster {
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
        this.chargeSpeed=350; this.chargeDamage=28;
        this.chargeCooldown=5000; this.chargeCooldownTimer=0;
        this.chargeDir={x:0,y:0}; this.chargeHitDealt=false;
        // スロー効果（Frost Blade等で付与）
        this.slowTimer = 0;
        // Ice Wolf: 氷の息
        this.isIceWolf = config.isIceWolf || false;
        this.iceBreathCooldown = 2000; // 2秒ごと
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
        this.frozenDmgMult = 1.1; // 凍結中の被ダメ倍率
        // 毒システム（Poison Dagger用）
        this.poisonTimer = 0;
        this.poisonTickTimer = 0;
        // 怒り状態
        this.enraged = false;
        this.enrageFlashTimer = 0;
        // 逃走・巣回復
        this.nestX = Math.min(WORLD_W - 200, this.spawnX + 600);
        this.nestY = Math.max(100, this.spawnY - 400);
        this.recovering = false;
        this.recoverTimer = 0;
        // 巡回行動
        this.patrolTarget = { x: this.spawnX, y: this.spawnY };
        this.patrolTimer = 0;
        // 弱点ゾーン定義
        this.weakZones = this._initWeakZones();
        this.hardZones = this._initHardZones();
        // 攻撃予備動作
        this.telegraphTimer = 0;
        this.telegraphing = false;
    }
    _initWeakZones() {
        const n = this.name;
        if (n === 'Forest Drake' || n === 'Elder Drake') return ['head', 'body'];
        if (n === 'Ice Wolf') return ['legs', 'side'];
        if (n === 'Giant Drake') return ['head', 'side'];
        return [];
    }
    _initHardZones() {
        const n = this.name;
        if (n === 'Forest Drake' || n === 'Elder Drake') return ['legs'];
        if (n === 'Giant Drake') return ['body'];
        return [];
    }
    /**
     * プレイヤー位置からヒットゾーンを判定
     * @param {number} px - プレイヤーX
     * @param {number} py - プレイヤーY
     * @returns {{ zone: string, mult: number, label: string }}
     */
    getHitZone(px, py) {
        const mcx = this.x + this.width / 2;
        const mcy = this.y + this.height / 2;
        const dx = px - mcx;
        const dy = py - mcy;

        let zone;
        if (dy < -this.height * 0.2) {
            zone = 'head';
        } else if (dy > this.height * 0.2) {
            zone = 'legs';
        } else if (Math.abs(dx) > this.width * 0.3) {
            zone = 'side';
        } else {
            zone = 'body';
        }

        if (this.weakZones.includes(zone)) {
            return { zone, mult: 2.0, label: 'WEAK!' };
        }
        if (this.hardZones.includes(zone)) {
            return { zone, mult: 0.5, label: 'HARD' };
        }
        return { zone, mult: 1.0, label: '' };
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
                this.hp = Math.max(0, this.hp - 6);
                this.hitFlashTimer = 80;
                if (game) game.damageNumbers.push(new DamageNumber(
                    this.x+this.width/2, this.y-10, 6, '#44cc44', 'POISON'));
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
        // 怒り判定（HP50%以下）
        if (!this.enraged && this.hp <= this.maxHp * 0.5 && !this.isElder) {
            this.enraged = true;
            this.speed = Math.floor(this.baseSpeed * 1.4);
            this.attackDamage = Math.floor(this.baseAttackDamage * 1.3);
            if (game) game.damageNumbers.push(new DamageNumber(this.x+this.width/2, this.y-30, 0, '#ff6622', 'ENRAGED!'));
        }
        // 怒りフラッシュタイマー
        if (this.enraged) {
            this.enrageFlashTimer -= dt * 1000;
            if (this.enrageFlashTimer <= 0) this.enrageFlashTimer = 500;
        }

        // 逃走判定（HP20%以下・ボス以外）
        if (!this.isBoss && this.hp <= this.maxHp * 0.2 && this.hp > 0) {
            // 巣で回復中
            const nestDx = this.nestX - this.x, nestDy = this.nestY - this.y;
            const nestDist = Math.sqrt(nestDx*nestDx + nestDy*nestDy);
            if (nestDist < 60) {
                // 巣に到着 → 回復開始
                this.state = 'recovering';
                this.recovering = true;
                this.recoverTimer += dt * 1000;
                if (this.recoverTimer < 5000) {
                    this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.3 * dt / 5));
                } else {
                    this.recovering = false; this.recoverTimer = 0;
                }
                // プレイヤーが近いと回復中断
                if (dist < 200) { this.recovering = false; this.recoverTimer = 0; this.state = 'chase'; }
                else return;
            } else {
                // 巣に向かって逃走
                this.state = 'flee';
                const nd = nestDist || 1;
                this.x += (nestDx/nd) * this.speed * 1.2 * speedMult * dt;
                this.y += (nestDy/nd) * this.speed * 1.2 * speedMult * dt;
                return;
            }
        }
        this.recovering = false; this.recoverTimer = 0;

        // ボス突進
        if (this.isBoss&&this.hp<=this.maxHp*0.5&&this.chargeCooldownTimer<=0&&dist<this.aggroRange) {
            this.state='charge_windup'; this.chargeWindupTimer=this.chargeWindupDuration;
            Sound.playChargeWarning(); this.chargeCooldownTimer=this.chargeCooldown; return;
        }
        // 攻撃（予備動作付き）
        if (dist<=this.attackRange) {
            this.state='attack';
            if (this.attackTimer<=0) {
                // 予備動作フェーズ
                if (!this.telegraphing) {
                    this.telegraphing = true;
                    this.telegraphTimer = 800; // 0.8秒予告
                    return;
                }
                this.telegraphTimer -= dt * 1000;
                if (this.telegraphTimer > 0) return; // まだ予告中
                this.telegraphing = false;
                // 予備動作を見逃した場合ダメージ1.5倍
                const telegraphDmg = player.dashTimer > 0 ? this.attackDamage : Math.floor(this.attackDamage * 1.5);
                const result = player.takeDamage(telegraphDmg);
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
            // 追跡
            this.state='chase';
            this.x+=dx/dist*this.speed*speedMult*dt; this.y+=dy/dist*this.speed*speedMult*dt;
        } else {
            // 巡回行動
            this.state='patrol';
            this.patrolTimer -= dt * 1000;
            if (this.patrolTimer <= 0) {
                this.patrolTimer = 15000 + Math.random() * 10000;
                const angle = Math.random() * Math.PI * 2;
                const r = 100 + Math.random() * 200;
                this.patrolTarget.x = Math.max(20, Math.min(WORLD_W-20, this.spawnX + Math.cos(angle)*r));
                this.patrolTarget.y = Math.max(20, Math.min(WORLD_H-20, this.spawnY + Math.sin(angle)*r));
            }
            const pdx = this.patrolTarget.x - this.x, pdy = this.patrolTarget.y - this.y;
            const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
            if (pdist > 10) {
                this.x += pdx/pdist * this.speed * 0.3 * dt;
                this.y += pdy/pdist * this.speed * 0.3 * dt;
            }
        }
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
        this.phase2=false; this.speed=this.baseSpeed; this.attackDamage=this.baseAttackDamage;
        this.frostCount=0; this.frozenTimer=0; this.poisonTimer=0; this.poisonTickTimer=0;
        this.enraged=false; this.enrageFlashTimer=0;
        this.recovering=false; this.recoverTimer=0; this.patrolTimer=0;
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
        // Ice Wolf描画
        if (this.isIceWolf) {
            const sw = 130, sh = 130;
            const drawX = this.x + this.width/2 - sw/2;
            const drawY = this.y + this.height/2 - sh/2;
            if (img) {
                ctx.save();
                if (this.hitFlashTimer > 0) {
                    ctx.globalAlpha = 0.6;
                    ctx.drawImage(img, drawX, drawY, sw, sh);
                    ctx.globalCompositeOperation = 'source-atop';
                    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(drawX, drawY, sw, sh);
                    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
                } else {
                    ctx.drawImage(img, drawX, drawY, sw, sh);
                }
                ctx.restore();
            } else {
                ctx.fillStyle = this.hitFlashTimer > 0 ? '#fff' : '#88ccee';
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
            if (this.slowTimer > 0) {
                ctx.strokeStyle = 'rgba(100,200,255,0.5)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(this.x+this.width/2, this.y+this.height/2, sw*0.5, 0, Math.PI*2); ctx.stroke();
            }
            return;
        }
        const sw = this.isElder ? 300 : (this.isBoss ? 220 : 160), sh = sw;
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
        // 予備動作エフェクト
        if (this.telegraphing) {
            const pulse = Math.sin(Date.now() * 0.015) > 0;
            if (pulse) {
                ctx.save(); ctx.globalAlpha = 0.25;
                ctx.fillStyle = '#ff2222';
                ctx.fillRect(this.x-3, this.y-3, this.width+6, this.height+6);
                ctx.restore();
            }
            // ！マーク点滅
            ctx.fillStyle = '#ff4444'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
            if (Math.sin(Date.now() * 0.01) > 0) {
                ctx.fillText('!', this.x + this.width/2, this.y - 15);
            }
        }
        // 怒りフラッシュ
        if (this.enraged && this.enrageFlashTimer > 250) {
            ctx.save(); ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#ff4422';
            ctx.fillRect(this.x-2, this.y-2, this.width+4, this.height+4);
            ctx.restore();
        }
        // 怒りテキスト
        if (this.enraged && !this.recovering) {
            ctx.fillStyle = '#ff6622'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
            ctx.fillText('ENRAGED', this.x+this.width/2, this.y-8);
        }
        // 逃走「!」アイコン
        if (this.state === 'flee') {
            ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
            ctx.fillText('!', this.x+this.width/2, this.y-12);
        }
        // 回復エフェクト
        if (this.recovering) {
            ctx.save(); ctx.globalAlpha = 0.2 + Math.sin(Date.now()*0.006)*0.1;
            ctx.fillStyle = '#44ff44';
            ctx.beginPath(); ctx.arc(this.x+this.width/2, this.y+this.height/2, this.width*0.7, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#44cc44'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
            ctx.fillText('Recovering...', this.x+this.width/2, this.y-8);
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
