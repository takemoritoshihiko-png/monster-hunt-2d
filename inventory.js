import { Weapon, Armor, WEAPONS, ARMORS, UPGRADE_COSTS, UPGRADE_DMG_MULT, ARMOR_UPGRADE_MULT, MATERIALS, BOX_RECIPES } from './data.js';
import { Companion } from './companion.js';

export class Inventory {
    constructor() {
        this.materials = {}; this.weapons = [WEAPONS.basicSword]; this.armors = [];
        this.companions = [];           // 仲間モンスターリスト
        this.activeCompanion = null;    // 出撃中の仲間
        this.clearedQuests = new Set();
        this.bestTimes = {};
        this.title = '';
    }
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
        if (r.resultType==='weapon') {
            const w = new Weapon(WEAPONS[r.resultId].name, WEAPONS[r.resultId].baseDamage,
                WEAPONS[r.resultId].range, WEAPONS[r.resultId].cooldown, WEAPONS[r.resultId].knockback,
                WEAPONS[r.resultId].type, WEAPONS[r.resultId].style, WEAPONS[r.resultId].desc);
            this.weapons.push(w);
        }
        else if (r.resultType==='armor') this.armors.push(new Armor(ARMORS[r.resultId].name, ARMORS[r.resultId].defense, ARMORS[r.resultId].damageMultiplier));
        return true;
    }
    /** 武器アップグレード */
    canUpgrade(weapon) {
        const id = this.getWeaponId(weapon);
        if (!id || !UPGRADE_COSTS[id]) return false;
        if (weapon.upgradeLevel >= 3) return false;
        const cost = UPGRADE_COSTS[id].costs[weapon.upgradeLevel];
        const mat = UPGRADE_COSTS[id].mat;
        return this.getMaterialCount(mat) >= cost.m && this.getMaterialCount('drakeCore') >= cost.c;
    }
    upgradeWeapon(weapon) {
        const id = this.getWeaponId(weapon);
        if (!this.canUpgrade(weapon)) return false;
        const cost = UPGRADE_COSTS[id].costs[weapon.upgradeLevel];
        const mat = UPGRADE_COSTS[id].mat;
        this.consumeMaterial(mat, cost.m);
        if (cost.c > 0) this.consumeMaterial('drakeCore', cost.c);
        weapon.upgradeLevel++;
        weapon.damage = weapon.getEffectiveDamage();
        return true;
    }
    canUpgradeArmor(armor) {
        if (!armor || armor.upgradeLevel >= 3) return false;
        const cost = UPGRADE_COSTS['drakeArmor'];
        if (!cost) return false;
        const c = cost.costs[armor.upgradeLevel];
        return this.getMaterialCount(cost.mat) >= c.m && this.getMaterialCount('drakeCore') >= c.c;
    }
    upgradeArmor(armor) {
        if (!this.canUpgradeArmor(armor)) return false;
        const cost = UPGRADE_COSTS['drakeArmor'];
        const c = cost.costs[armor.upgradeLevel];
        this.consumeMaterial(cost.mat, c.m);
        if (c.c > 0) this.consumeMaterial('drakeCore', c.c);
        armor.upgradeLevel = (armor.upgradeLevel || 0) + 1;
        armor.damageMultiplier = ARMOR_UPGRADE_MULT[armor.upgradeLevel];
        return true;
    }
    getWeaponId(weapon) {
        for (const [id, w] of Object.entries(WEAPONS)) {
            if (w.name === weapon.name) return id;
        }
        return null;
    }
    /** セーブ用にシリアライズ */
    serialize() {
        return {
            materials: { ...this.materials },
            weapons: this.weapons.map(w => ({
                id: this.getWeaponId(w) || 'basicSword',
                upgradeLevel: w.upgradeLevel || 0,
            })),
            armors: this.armors.map(a => ({
                id: 'drakeArmor',
                upgradeLevel: a.upgradeLevel || 0,
            })),
            clearedQuests: [...this.clearedQuests],
            bestTimes: { ...this.bestTimes },
            title: this.title,
            companions: this.companions.map(c => c.serialize()),
            activeCompanionIdx: this.activeCompanion ? this.companions.indexOf(this.activeCompanion) : -1,
        };
    }
    /** セーブデータから復元 */
    deserialize(data) {
        if (!data) return;
        this.materials = data.materials || {};
        this.weapons = (data.weapons || []).map(w => {
            const base = WEAPONS[w.id];
            if (!base) return null;
            const weapon = new Weapon(base.name, base.baseDamage, base.range, base.cooldown,
                base.knockback, base.type, base.style, base.desc);
            weapon.upgradeLevel = w.upgradeLevel || 0;
            weapon.damage = weapon.getEffectiveDamage();
            return weapon;
        }).filter(w => w !== null);
        if (this.weapons.length === 0) this.weapons = [WEAPONS.basicSword];
        this.armors = (data.armors || []).map(a => {
            const armor = new Armor(ARMORS.drakeArmor.name, ARMORS.drakeArmor.defense, ARMORS.drakeArmor.damageMultiplier);
            armor.upgradeLevel = a.upgradeLevel || 0;
            if (armor.upgradeLevel > 0) armor.damageMultiplier = ARMOR_UPGRADE_MULT[armor.upgradeLevel];
            return armor;
        });
        this.clearedQuests = new Set(data.clearedQuests || []);
        this.bestTimes = data.bestTimes || {};
        this.title = data.title || '';
        // 仲間復元
        this.companions = (data.companions || []).map(c => Companion.deserialize(c));
        if (data.activeCompanionIdx >= 0 && data.activeCompanionIdx < this.companions.length) {
            this.activeCompanion = this.companions[data.activeCompanionIdx];
        }
    }
    /** ボックスをクラフトできるか */
    canCraftBox(boxRecipe) {
        return boxRecipe.materials.every(m => this.getMaterialCount(m.materialId) >= m.count);
    }
    /** ボックスを開封して仲間を獲得 */
    openBox(boxRecipe) {
        if (!this.canCraftBox(boxRecipe)) return null;
        for (const m of boxRecipe.materials) this.consumeMaterial(m.materialId, m.count);
        // 確率抽選
        const roll = Math.random();
        let cumulative = 0;
        let resultType = 'forest_drake';
        for (const [type, rate] of Object.entries(boxRecipe.rates)) {
            cumulative += rate;
            if (roll < cumulative) { resultType = type; break; }
        }
        const companion = new Companion(resultType, 1);
        this.companions.push(companion);
        return companion;
    }
}
