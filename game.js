// ========================================
// MONSTER HUNT 2D - Phase 1 プロトタイプ
// ========================================

// ========================================
// 武器クラス（将来の複数武器種に対応）
// ========================================
class Weapon {
    /**
     * @param {string} name - 武器名
     * @param {number} damage - ダメージ量
     * @param {number} range - 攻撃範囲（px）
     * @param {number} cooldown - 攻撃クールダウン（ms）
     * @param {number} knockback - ノックバック力
     */
    constructor(name, damage, range, cooldown, knockback = 0) {
        this.name = name;
        this.damage = damage;
        this.range = range;
        this.cooldown = cooldown;
        this.knockback = knockback;
    }
}

// 初期武器の定義
const WEAPONS = {
    sword: new Weapon('鉄の剣', 25, 50, 400, 5),
    // 将来追加用: greatSword, bow, hammer など
};

// ========================================
// プレイヤークラス
// ========================================
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.speed = 200; // px/sec

        // ステータス
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.maxStamina = 100;
        this.stamina = this.maxStamina;

        // 向き（攻撃方向に使用）: 'up', 'down', 'left', 'right'
        this.facing = 'down';

        // 武器
        this.weapon = WEAPONS.sword;

        // 攻撃管理
        this.isAttacking = false;
        this.attackTimer = 0;       // 攻撃エフェクト表示時間
        this.attackCooldown = 0;    // 次の攻撃までのクールダウン
        this.attackDuration = 200;  // エフェクト表示時間（ms）

        // 無敵時間（被ダメージ後）
        this.invincibleTimer = 0;
        this.invincibleDuration = 500; // ms

        // 将来のクラフト・インベントリ用
        this.inventory = [];
    }

    /**
     * プレイヤーの更新処理
     * @param {number} dt - デルタタイム（秒）
     * @param {Object} keys - 押下中のキー情報
     * @param {number} canvasWidth - キャンバス幅
     * @param {number} canvasHeight - キャンバス高さ
     */
    update(dt, keys, canvasWidth, canvasHeight) {
        // 移動処理
        let dx = 0;
        let dy = 0;

        if (keys['w'] || keys['arrowup']) { dy = -1; this.facing = 'up'; }
        if (keys['s'] || keys['arrowdown']) { dy = 1; this.facing = 'down'; }
        if (keys['a'] || keys['arrowleft']) { dx = -1; this.facing = 'left'; }
        if (keys['d'] || keys['arrowright']) { dx = 1; this.facing = 'right'; }

        // 斜め移動の正規化
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }

        this.x += dx * this.speed * dt;
        this.y += dy * this.speed * dt;

        // 画面内に制限
        this.x = Math.max(0, Math.min(canvasWidth - this.width, this.x));
        this.y = Math.max(0, Math.min(canvasHeight - this.height, this.y));

        // 攻撃タイマー更新
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt * 1000;
        }
        if (this.attackTimer > 0) {
            this.attackTimer -= dt * 1000;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
            }
        }

        // 無敵時間更新
        if (this.invincibleTimer > 0) {
            this.invincibleTimer -= dt * 1000;
        }
    }

    /**
     * 攻撃を実行する
     * @returns {Object|null} 攻撃判定の矩形（ヒットしたかの判定用）
     */
    attack() {
        if (this.attackCooldown > 0) return null;

        this.isAttacking = true;
        this.attackTimer = this.attackDuration;
        this.attackCooldown = this.weapon.cooldown;

        return this.getAttackHitbox();
    }

    /**
     * 攻撃判定の矩形を取得
     * @returns {Object} { x, y, width, height }
     */
    getAttackHitbox() {
        const range = this.weapon.range;
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        switch (this.facing) {
            case 'up':
                return { x: cx - 20, y: cy - range - 10, width: 40, height: range };
            case 'down':
                return { x: cx - 20, y: cy + 10, width: 40, height: range };
            case 'left':
                return { x: cx - range - 10, y: cy - 20, width: range, height: 40 };
            case 'right':
                return { x: cx + 10, y: cy - 20, width: range, height: 40 };
        }
    }

    /**
     * ダメージを受ける
     * @param {number} amount - ダメージ量
     */
    takeDamage(amount) {
        if (this.invincibleTimer > 0) return;

        this.hp = Math.max(0, this.hp - amount);
        this.invincibleTimer = this.invincibleDuration;
    }

    /**
     * プレイヤーの描画
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        // 無敵時間中は点滅
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 80) % 2 === 0) {
            return;
        }

        // プレイヤー本体（白い四角）
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // 向きを示す小さなインジケータ
        ctx.fillStyle = '#88ccff';
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        switch (this.facing) {
            case 'up':
                ctx.fillRect(cx - 4, this.y, 8, 6);
                break;
            case 'down':
                ctx.fillRect(cx - 4, this.y + this.height - 6, 8, 6);
                break;
            case 'left':
                ctx.fillRect(this.x, cy - 4, 6, 8);
                break;
            case 'right':
                ctx.fillRect(this.x + this.width - 6, cy - 4, 6, 8);
                break;
        }

        // 攻撃エフェクト描画
        if (this.isAttacking && this.attackTimer > 0) {
            this.drawAttackEffect(ctx);
        }
    }

    /**
     * 攻撃エフェクトの描画
     * @param {CanvasRenderingContext2D} ctx
     */
    drawAttackEffect(ctx) {
        const hitbox = this.getAttackHitbox();
        if (!hitbox) return;

        // 半透明の攻撃エフェクト
        const alpha = this.attackTimer / this.attackDuration;
        ctx.fillStyle = `rgba(255, 255, 100, ${alpha * 0.6})`;
        ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);

        // 剣のスラッシュライン
        ctx.strokeStyle = `rgba(255, 255, 200, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        switch (this.facing) {
            case 'up':
                ctx.moveTo(cx - 15, cy - 5);
                ctx.lineTo(cx + 15, cy - this.weapon.range - 5);
                break;
            case 'down':
                ctx.moveTo(cx - 15, cy + 5);
                ctx.lineTo(cx + 15, cy + this.weapon.range + 5);
                break;
            case 'left':
                ctx.moveTo(cx - 5, cy - 15);
                ctx.lineTo(cx - this.weapon.range - 5, cy + 15);
                break;
            case 'right':
                ctx.moveTo(cx + 5, cy - 15);
                ctx.lineTo(cx + this.weapon.range + 5, cy + 15);
                break;
        }

        ctx.stroke();
    }
}

// ========================================
// モンスタークラス
// ========================================
class Monster {
    /**
     * @param {string} name - モンスター名
     * @param {number} x - 初期X座標
     * @param {number} y - 初期Y座標
     * @param {Object} config - モンスター設定
     */
    constructor(name, x, y, config = {}) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.width = config.width || 64;
        this.height = config.height || 64;
        this.speed = config.speed || 80;
        this.color = config.color || '#cc3333';

        // ステータス
        this.maxHp = config.hp || 500;
        this.hp = this.maxHp;

        // 攻撃パラメータ
        this.attackDamage = config.attackDamage || 10;
        this.attackRange = config.attackRange || 50;
        this.attackCooldown = config.attackCooldown || 1000; // ms
        this.attackTimer = 0;

        // AI設定
        this.aggroRange = config.aggroRange || 300; // 追跡開始距離
        this.state = 'idle'; // 'idle', 'chase', 'attack', 'dead'

        // 被ダメージ演出用
        this.hitFlashTimer = 0;

        // 生存フラグ
        this.alive = true;
    }

    /**
     * モンスターの更新処理
     * @param {number} dt - デルタタイム（秒）
     * @param {Player} player - プレイヤー参照
     */
    update(dt, player) {
        if (!this.alive) return;

        // プレイヤーとの距離計算
        const dx = (player.x + player.width / 2) - (this.x + this.width / 2);
        const dy = (player.y + player.height / 2) - (this.y + this.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 攻撃クールダウン更新
        if (this.attackTimer > 0) {
            this.attackTimer -= dt * 1000;
        }

        // 被ダメージ演出タイマー
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= dt * 1000;
        }

        // AI状態遷移
        if (dist <= this.attackRange) {
            // 攻撃範囲内
            this.state = 'attack';
            if (this.attackTimer <= 0) {
                player.takeDamage(this.attackDamage);
                this.attackTimer = this.attackCooldown;
            }
        } else if (dist <= this.aggroRange) {
            // 追跡範囲内 → プレイヤーに向かって移動
            this.state = 'chase';
            const nx = dx / dist;
            const ny = dy / dist;
            this.x += nx * this.speed * dt;
            this.y += ny * this.speed * dt;
        } else {
            this.state = 'idle';
        }
    }

    /**
     * ダメージを受ける
     * @param {number} amount - ダメージ量
     * @param {number} knockbackX - ノックバックX方向
     * @param {number} knockbackY - ノックバックY方向
     */
    takeDamage(amount, knockbackX = 0, knockbackY = 0) {
        if (!this.alive) return;

        this.hp = Math.max(0, this.hp - amount);
        this.hitFlashTimer = 150; // 被ダメージ白フラッシュ

        // ノックバック
        this.x += knockbackX;
        this.y += knockbackY;

        if (this.hp <= 0) {
            this.alive = false;
            this.state = 'dead';
        }
    }

    /**
     * モンスターの描画
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        if (!this.alive) return;

        // 被ダメージ時の白フラッシュ
        if (this.hitFlashTimer > 0) {
            ctx.fillStyle = '#ffffff';
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.fillRect(this.x, this.y, this.width, this.height);

        // モンスターの目（簡易的な見た目の改善）
        ctx.fillStyle = '#ffcc00';
        const eyeY = this.y + 16;
        ctx.fillRect(this.x + 14, eyeY, 10, 10);
        ctx.fillRect(this.x + 40, eyeY, 10, 10);

        // 瞳
        ctx.fillStyle = '#000000';
        ctx.fillRect(this.x + 18, eyeY + 3, 4, 5);
        ctx.fillRect(this.x + 44, eyeY + 3, 4, 5);
    }
}

// ========================================
// ゲームメインクラス
// ========================================
class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // 入力管理
        this.keys = {};

        // ゲーム状態: 'playing', 'gameover', 'victory'
        this.state = 'playing';

        // タイムスタンプ管理
        this.lastTime = 0;

        // ゲームオブジェクト初期化
        this.init();

        // イベントリスナー設定
        this.setupInput();

        // ゲームループ開始
        requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * ゲームオブジェクトの初期化
     */
    init() {
        // プレイヤーを画面下部に配置
        this.player = new Player(
            this.canvas.width / 2 - 16,
            this.canvas.height - 80
        );

        // モンスターをステージ中央付近に配置
        this.monster = new Monster('Forest Drake',
            this.canvas.width / 2 - 32,
            this.canvas.height / 2 - 80,
            {
                hp: 500,
                width: 64,
                height: 64,
                speed: 80,
                color: '#cc3333',
                attackDamage: 10,
                attackRange: 55,
                attackCooldown: 1000,
                aggroRange: 300,
            }
        );

        this.state = 'playing';
    }

    /**
     * 入力イベントの設定
     */
    setupInput() {
        // キーダウン
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;

            // 攻撃（Zキー）
            if (e.key.toLowerCase() === 'z' && this.state === 'playing') {
                this.handleAttack();
            }

            // リスタート（Rキー）
            if (e.key.toLowerCase() === 'r' && this.state !== 'playing') {
                this.init();
            }
        });

        // キーアップ
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    /**
     * プレイヤーの攻撃処理
     */
    handleAttack() {
        const hitbox = this.player.attack();
        if (!hitbox) return;

        // モンスターとの衝突判定
        if (this.monster.alive && this.checkCollision(hitbox, this.monster)) {
            // ノックバック方向を計算
            const dx = (this.monster.x + this.monster.width / 2) - (this.player.x + this.player.width / 2);
            const dy = (this.monster.y + this.monster.height / 2) - (this.player.y + this.player.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const kb = this.player.weapon.knockback;

            this.monster.takeDamage(
                this.player.weapon.damage,
                (dx / dist) * kb,
                (dy / dist) * kb
            );
        }
    }

    /**
     * 矩形同士の衝突判定
     * @param {Object} a - { x, y, width, height }
     * @param {Object} b - { x, y, width, height }
     * @returns {boolean}
     */
    checkCollision(a, b) {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    /**
     * メインゲームループ
     * @param {number} timestamp - 現在のタイムスタンプ
     */
    loop(timestamp) {
        // デルタタイム計算（秒単位）
        const dt = this.lastTime ? (timestamp - this.lastTime) / 1000 : 0;
        this.lastTime = timestamp;

        // デルタタイムが大きすぎる場合はスキップ（タブ復帰時対策）
        const clampedDt = Math.min(dt, 0.1);

        this.update(clampedDt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * ゲーム全体の更新処理
     * @param {number} dt - デルタタイム（秒）
     */
    update(dt) {
        if (this.state !== 'playing') return;

        // プレイヤー更新
        this.player.update(dt, this.keys, this.canvas.width, this.canvas.height);

        // モンスター更新
        this.monster.update(dt, this.player);

        // ゲームオーバー判定
        if (this.player.hp <= 0) {
            this.state = 'gameover';
        }

        // 勝利判定
        if (!this.monster.alive) {
            this.state = 'victory';
        }
    }

    /**
     * ゲーム全体の描画処理
     */
    draw() {
        const ctx = this.ctx;

        // 背景描画（草原タイル風）
        this.drawBackground(ctx);

        // モンスター描画
        this.monster.draw(ctx);

        // プレイヤー描画
        this.player.draw(ctx);

        // UI描画
        this.drawUI(ctx);

        // ゲームオーバー・勝利画面
        if (this.state === 'gameover') {
            this.drawOverlay(ctx, 'GAME OVER', '#ff4444', 'Press R to Restart');
        } else if (this.state === 'victory') {
            this.drawOverlay(ctx, 'HUNT SUCCESS!', '#44ff44', 'Press R to Restart');
        }
    }

    /**
     * 草原背景の描画
     * @param {CanvasRenderingContext2D} ctx
     */
    drawBackground(ctx) {
        // ベースの草原色
        ctx.fillStyle = '#3a7d44';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // タイルパターンで微妙な変化をつける
        const tileSize = 32;
        for (let y = 0; y < this.canvas.height; y += tileSize) {
            for (let x = 0; x < this.canvas.width; x += tileSize) {
                // チェッカーパターンで微妙に色を変える
                if ((x / tileSize + y / tileSize) % 2 === 0) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
                    ctx.fillRect(x, y, tileSize, tileSize);
                }
            }
        }
    }

    /**
     * UI要素の描画
     * @param {CanvasRenderingContext2D} ctx
     */
    drawUI(ctx) {
        // === プレイヤーHPバー（左上） ===
        const pBarX = 20;
        const pBarY = 20;
        const pBarW = 200;
        const pBarH = 20;

        // ラベル
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('PLAYER HP', pBarX, pBarY - 5);

        // バー背景
        ctx.fillStyle = '#333333';
        ctx.fillRect(pBarX, pBarY, pBarW, pBarH);

        // バー本体
        const pHpRatio = this.player.hp / this.player.maxHp;
        ctx.fillStyle = pHpRatio > 0.3 ? '#44cc44' : '#cc4444';
        ctx.fillRect(pBarX, pBarY, pBarW * pHpRatio, pBarH);

        // バー枠
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(pBarX, pBarY, pBarW, pBarH);

        // HP数値
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.player.hp} / ${this.player.maxHp}`, pBarX + pBarW / 2, pBarY + 15);

        // === モンスターHPバー（上部中央）===
        if (this.monster.alive) {
            const mBarW = 300;
            const mBarH = 22;
            const mBarX = (this.canvas.width - mBarW) / 2;
            const mBarY = 30;

            // モンスター名
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.monster.name, this.canvas.width / 2, mBarY - 8);

            // バー背景
            ctx.fillStyle = '#333333';
            ctx.fillRect(mBarX, mBarY, mBarW, mBarH);

            // バー本体
            const mHpRatio = this.monster.hp / this.monster.maxHp;
            ctx.fillStyle = '#cc3333';
            ctx.fillRect(mBarX, mBarY, mBarW * mHpRatio, mBarH);

            // バー枠
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(mBarX, mBarY, mBarW, mBarH);

            // HP数値
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.monster.hp} / ${this.monster.maxHp}`, this.canvas.width / 2, mBarY + 16);
        }

        // === 操作説明（画面下部）===
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WASD: Move | Z: Attack', this.canvas.width / 2, this.canvas.height - 15);
    }

    /**
     * ゲームオーバー・勝利のオーバーレイ描画
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} title - メインテキスト
     * @param {string} color - テキスト色
     * @param {string} subtitle - サブテキスト
     */
    drawOverlay(ctx, title, color, subtitle) {
        // 半透明オーバーレイ
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // メインテキスト
        ctx.fillStyle = color;
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(title, this.canvas.width / 2, this.canvas.height / 2 - 20);

        // サブテキスト
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px monospace';
        ctx.fillText(subtitle, this.canvas.width / 2, this.canvas.height / 2 + 30);
    }
}

// ========================================
// ゲーム起動
// ========================================
window.addEventListener('load', () => {
    new Game('gameCanvas');
});
