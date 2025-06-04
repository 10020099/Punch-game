const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const upgradePanel = document.getElementById('upgrade-panel');
const closeUpgradePanelButton = document.getElementById('close-upgrade-panel-button');
const openUpgradePanelButtonGameOver = document.getElementById('open-upgrade-panel-button-gameover');
const upgradePanelCurrencyDisplay = document.getElementById('upgrade-panel-currency');
const powerUpUpgradesContainer = document.getElementById('power-up-upgrades-container');
const playerStatUpgradesContainer = document.getElementById('player-stat-upgrades-container');
const cheatPanel = document.getElementById('cheat-panel');
const closeCheatPanelButton = document.getElementById('close-cheat-panel-button');

// 调试开关
const DEBUG = false;
const debugLog = (...args) => { if (DEBUG) console.log(...args); };

// 简单的子弹对象池减少内存分配
const bulletPool = [];
function getBullet() {
    return bulletPool.pop() || {};
}
function releaseBullet(bullet) {
    bulletPool.push(bullet);
}


// --- 游戏全局状态 ---
let score = 0;
let scoreForBossTrigger = 0; // 新增：专门用于触发Boss的分数计数器
let totalCurrency = 0; // 玩家总积分（货币）
let isGamePaused = false;
let gameLoopRequestId;

// 作弊码缓冲
let cheatCodeBuffer = "";
const CHEAT_EFFECT_DURATION = 20000; // 作弊码效果持续20秒

function activateCheatCode(code) {
    if (code === 'tq123') {
        totalCurrency += 10000;
        localStorage.setItem('totalGameCurrency', totalCurrency);
        updateGameUIDisplays();
        if (upgradePanel.style.display === 'block') {
            renderUpgradePanel();
        }
        debugLog('作弊码激活: tq123 - 增加10000积分');
        alert('作弊码激活: 增加10000积分');
    } else if (code === 'tq456') {
        player.isDoubleShotActive = true;
        player.currentAttackSpeed = player.baseAttackSpeed / 2;
        player.isScoreMultiplierActive = true;
        player.activePowerUps['CHEAT_SUPER_EFFECT'] = Date.now() + CHEAT_EFFECT_DURATION;
        debugLog('作弊码激活: tq456 - 临时超级组合效果 (20秒)');
        alert('作弊码激活: 临时超级组合效果 (20秒)');
    }
}

// 黄金飞机系统
const GOLDEN_FIGHTER_PRICE = 5000;  // 黄金飞机价格
let hasGoldenFighter = false;       // 是否拥有黄金飞机
let isUsingGoldenFighter = false;   // 是否正在使用黄金飞机

// --- 强化系统数据 ---

// 道具相关常量 - 需要在 upgradeLevels 之前声明
const POWER_UP_TYPES = {
    DOUBLE_SHOT: 'double_shot',
    ATTACK_SPEED: 'attack_speed',
    SCORE_MULTIPLIER: 'score_multiplier',
    SUPER_COMBO: 'super_combo'
};

// 强化等级上限 - 根据当前使用的飞机动态调整
const BASE_MAX_UPGRADE_LEVEL = 10;  // 基础上限
const GOLDEN_MAX_UPGRADE_LEVEL = 20; // 黄金飞机拥有者上限
// MAX_UPGRADE_LEVEL 将在applyUpgrades中动态设置

// 全满级特殊奖励标志
let shieldEfficiencyBoost = false;  // 护盾强度提升标志
let reducedSuperComboRequirement = false; // 超级组合道具需求降低标志
const NORMAL_SUPER_COMBO_REQUIREMENT = 5;  // 普通需求
const REDUCED_SUPER_COMBO_REQUIREMENT = 3; // 降低后的需求

// 场地Buff真实伤害击杀计数
let normalFighterKillsForBuff = 0;
let goldenFighterKillsForBuff = 0;

const PLAYER_BASE_ATTACK_SPEED_INTERVAL = 300; // ms
const ATTACK_SPEED_DECREMENT_PER_LEVEL = 10; // ms
const PLAYER_BASE_MAX_SHIELD = 20;
const MAX_SHIELD_INCREMENT_PER_LEVEL = 5;
const PLAYER_BASE_BULLET_DAMAGE = 1; // 伤害系数
const BULLET_DAMAGE_INCREMENT_PER_LEVEL = 0.1;
const BASE_POWER_UP_DURATION = 10000; // 10秒
const POWER_UP_DURATION_INCREMENT_PER_LEVEL = 1000; // 1秒

let upgradeLevels = {
    // 道具持续时间等级
    [POWER_UP_TYPES.DOUBLE_SHOT + 'DurationLevel']: 0,
    [POWER_UP_TYPES.ATTACK_SPEED + 'DurationLevel']: 0,
    [POWER_UP_TYPES.SCORE_MULTIPLIER + 'DurationLevel']: 0,
    // 战机属性等级
    playerAttackSpeedLevel: 0,
    playerMaxShieldLevel: 0,
    playerBulletDamageLevel: 0
};


// --- 玩家对象 ---
let player = {
    x: canvas.width / 2,
    y: canvas.height - 30,
    width: 60,
    height: 60,
    speed: 3,
    bullets: [],
    image: null,
    shield: 20, // 初始护盾
    maxShield: 20, // 最大护盾
    baseAttackSpeed: 300, // 基础攻击速度
    currentAttackSpeed: 300, // 当前攻击速度，受道具影响
    lastAttackTime: 0, // 上次攻击时间
    shieldRegenRate: 1, // 每秒护盾回复量
    lastShieldRegenTime: 0, // 上次护盾回复时间
    bulletDamage: PLAYER_BASE_BULLET_DAMAGE, // 受强化影响
    isDoubleShotActive: false,
    isScoreMultiplierActive: false,
    activePowerUps: {}, // 存储激活的道具及其结束时间
    superComboCount: 0, // 超级组合道具计数
    isSuperComboActive: false // 超级组合道具是否永久激活
};
let enemies = [];
let powerUps = []; // 存储屏幕上的道具
let keys = {};

// const POWER_UP_DURATION = 10000; // 基础持续时间现在是 BASE_POWER_UP_DURATION (已在顶部定义)
const POWER_UP_SIZE = 20; // 道具大小
const POWER_UP_SPEED = 0.5; // 道具掉落速度
let powerUpSpawnInterval = 15000; // 15秒生成一个道具 (可调整)
let lastPowerUpSpawnTime = 0;


let boss = null;
let bossActive = false;
const scoreForBoss = 800; // 修改Boss出现分数为800
let nextBossScore = scoreForBoss;
let enemyInterval; // 用于控制普通敌人的生成

const baseBossShield = 100; // Boss基础护盾
const baseBossHealth = 200; // Boss基础血量
let bossSpawnCount = 0; // Boss出现次数计数器
let boss2SpawnCount = 0; // Boss 2出现次数计数器

let backgroundIndex = 1;
let backgroundChangeThreshold = 100; // 移动距离阈值，用于切换背景
let lastPlayerX = player.x;

// 加载玩家战机图片
const playerImage = new Image();
playerImage.src = 'assets/images/airplane.png';
playerImage.onload = function() {
    player.image = playerImage;
};

// 加载敌方战机图片
const enemyImage = new Image();
enemyImage.src = 'assets/images/enemy fighter.png';

// 加载第二种敌方战机图片
const enemyImage2 = new Image();
enemyImage2.src = 'assets/images/enemy fighter 2.png';

// 加载Boss图片
const bossImage = new Image();
bossImage.src = 'assets/images/boss.png'; // 确保boss图片路径正确

// 加载Boss图片2
const bossImage2 = new Image();
bossImage2.src = 'assets/images/boss 2.png';

// 加载黄金战机图片
const goldenFighterImage = new Image();
goldenFighterImage.src = 'assets/images/Golden Fighter.png';


// --- 初始化函数 ---
function initializeGame() {
    // 尝试从localStorage加载总积分
    const savedCurrency = localStorage.getItem('totalGameCurrency');
    if (savedCurrency !== null) {
        totalCurrency = parseInt(savedCurrency, 10) || 0;
    } else {
        totalCurrency = 0;
    }
    debugLog(`游戏初始化，当前总积分: ${totalCurrency}`);

    // 尝试从localStorage加载强化等级
    const savedUpgradeLevels = localStorage.getItem('gameUpgradeLevels');
    if (savedUpgradeLevels) {
        try {
            const parsedLevels = JSON.parse(savedUpgradeLevels);
            // 合并加载的等级，确保所有键都存在
            upgradeLevels = { ...upgradeLevels, ...parsedLevels };
        } catch (e) {
            console.error("无法解析存储的强化等级:", e);
            // 如果解析失败，使用默认值并保存
            localStorage.setItem('gameUpgradeLevels', JSON.stringify(upgradeLevels));
        }
    } else {
        // 如果没有存储的等级，保存当前默认等级
        localStorage.setItem('gameUpgradeLevels', JSON.stringify(upgradeLevels));
    }
    debugLog("加载的强化等级:", upgradeLevels);

    // Load Boss 1 defeat count
    const savedBossSpawnCount = localStorage.getItem('bossSpawnCount');
    if (savedBossSpawnCount !== null) {
        bossSpawnCount = parseInt(savedBossSpawnCount, 10) || 0;
    } else {
        bossSpawnCount = 0; // Default if not found
    }
    debugLog(`Loaded Boss 1 defeat count: ${bossSpawnCount}`);

    // Load Boss 2 defeat count
    const savedBoss2SpawnCount = localStorage.getItem('boss2SpawnCount');
    if (savedBoss2SpawnCount !== null) {
        boss2SpawnCount = parseInt(savedBoss2SpawnCount, 10) || 0;
    } else {
        boss2SpawnCount = 0; // Default if not found
    }
    debugLog(`Loaded Boss 2 defeat count: ${boss2SpawnCount}`);

    // 加载黄金飞机拥有状态
    const savedHasGoldenFighter = localStorage.getItem('hasGoldenFighter');
    hasGoldenFighter = savedHasGoldenFighter === 'true';
    isUsingGoldenFighter = false; // 每次开始游戏默认使用普通飞机
    debugLog(`黄金飞机状态 - 拥有: ${hasGoldenFighter}, 使用中: ${isUsingGoldenFighter}`);

    // 根据强化等级应用属性，这也会检查特殊奖励条件
    applyUpgrades();
    
    // 重置玩家每局游戏的状态
    player.shield = player.maxShield; // 确保初始护盾满
    player.currentAttackSpeed = player.baseAttackSpeed; // 攻速道具会临时改变这个
    player.activePowerUps = {};
    player.isDoubleShotActive = false;
    player.isScoreMultiplierActive = false;
    player.superComboCount = 0; // 重置超级道具计数器
    player.isSuperComboActive = false; // 重置超级道具永久激活状态
    // 重置场地Buff击杀计数
    normalFighterKillsForBuff = 0;
    goldenFighterKillsForBuff = 0;
    // 根据当前使用的飞机设置图像
    updatePlayerImage();
    
    // 初始化Boss分数阈值和各类分数
    score = 0; 
    scoreForBossTrigger = 0; // 初始化用于Boss触发的分数
    scoreElement.textContent = `分数: ${score}`;
    nextBossScore = scoreForBoss; 
    // bossSpawnCount and boss2SpawnCount are now loaded from localStorage or defaulted to 0
    bossActive = false;
    boss = null;

    // ... 其他需要每局开始都初始化的玩家状态
}

function applyUpgrades() {
    // 根据当前使用的飞机动态设置最大强化等级
    const MAX_UPGRADE_LEVEL = isUsingGoldenFighter ? GOLDEN_MAX_UPGRADE_LEVEL : BASE_MAX_UPGRADE_LEVEL;

    // 应用战机属性强化，考虑黄金飞机的双倍效果
    const multiplier = isUsingGoldenFighter ? 2 : 1; // 黄金飞机时增益效果加倍

    // 计算基础攻击速度 (数值越小攻击越快)
    // 攻击速度需要特殊处理，因为它是数值越小越好
    const effectiveAttackSpeedLevel = isUsingGoldenFighter
        ? upgradeLevels.playerAttackSpeedLevel
        : Math.min(upgradeLevels.playerAttackSpeedLevel, BASE_MAX_UPGRADE_LEVEL);
    let attackSpeedReduction = effectiveAttackSpeedLevel * ATTACK_SPEED_DECREMENT_PER_LEVEL;
    if (isUsingGoldenFighter) attackSpeedReduction *= 2; // 黄金飞机双倍效果
    player.baseAttackSpeed = PLAYER_BASE_ATTACK_SPEED_INTERVAL - attackSpeedReduction;
    if (player.baseAttackSpeed < 50) player.baseAttackSpeed = 50; // 设置一个攻速上限(最小间隔)

    // 计算最大护盾 - 修正为对整个值应用倍率
    const effectiveShieldLevel = isUsingGoldenFighter
        ? upgradeLevels.playerMaxShieldLevel
        : Math.min(upgradeLevels.playerMaxShieldLevel, BASE_MAX_UPGRADE_LEVEL);
    const baseShieldWithUpgrades = PLAYER_BASE_MAX_SHIELD + (effectiveShieldLevel * MAX_SHIELD_INCREMENT_PER_LEVEL);
    player.maxShield = baseShieldWithUpgrades * multiplier;

    // 计算子弹伤害 - 修正为对整个值应用倍率
    const effectiveDamageLevel = isUsingGoldenFighter
        ? upgradeLevels.playerBulletDamageLevel
        : Math.min(upgradeLevels.playerBulletDamageLevel, BASE_MAX_UPGRADE_LEVEL);
    const baseDamageWithUpgrades = PLAYER_BASE_BULLET_DAMAGE + (effectiveDamageLevel * BULLET_DAMAGE_INCREMENT_PER_LEVEL);
    player.bulletDamage = baseDamageWithUpgrades * multiplier;

    // 检查是否满足特殊奖励条件 - 所有强化项目达到20级
    if (hasGoldenFighter) {
        checkForSpecialRewards();
    }

    debugLog("应用强化后玩家属性:", {
        baseAttackSpeed: player.baseAttackSpeed,
        maxShield: player.maxShield,
        bulletDamage: player.bulletDamage,
        usingGoldenFighter: isUsingGoldenFighter,
        maxUpgradeLevel: MAX_UPGRADE_LEVEL,
        shieldEfficiencyBoost: shieldEfficiencyBoost,
        reducedSuperComboRequirement: reducedSuperComboRequirement
    });
}

// 检查是否达成特殊奖励条件
function checkForSpecialRewards() {
    // 只有拥有黄金飞机的玩家才能获得特殊奖励
    if (!hasGoldenFighter) return;
    
    // 检查所有强化项目是否达到20级
    const allMaxed = Object.keys(upgradeLevels).every(key => 
        upgradeLevels[key] >= GOLDEN_MAX_UPGRADE_LEVEL
    );
    
    if (allMaxed) {
        // 激活特殊奖励
        shieldEfficiencyBoost = true;
        reducedSuperComboRequirement = true;
        debugLog("特殊奖励已激活! 护盾效率提升 & 超级组合道具需求降低");
    } else {
        shieldEfficiencyBoost = false;
        reducedSuperComboRequirement = false;
    }
}


// --- 事件监听 ---
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    // 空格键现在用于切换背景
    if (e.code === 'Space') {
        backgroundIndex = backgroundIndex === 1 ? 2 : 1;
        document.getElementById('canvas-background').style.backgroundImage = `url('assets/images/container background${backgroundIndex}.png')`;
        debugLog(`背景切换到: ${backgroundIndex}`);
        // 当切换到背景2时，重置护盾回复计时器，以便立即开始计算回复
        if (backgroundIndex === 2) {
            player.lastShieldRegenTime = Date.now();
        }
    }
    // 'U' 键控制强化面板显隐
    if (e.code === 'KeyU') {
        toggleUpgradePanel();
    }
    // 'F' 键切换飞机
    if (e.code === 'KeyF') {
        toggleFighter();
    }
    // 'K' 键打开作弊面板
    if (e.code === 'KeyK') {
        toggleCheatPanel();
    }

    // 作弊码逻辑
    if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) { // 只接受字母和数字
        cheatCodeBuffer += e.key.toLowerCase();
    } else if (e.code === 'Enter') {
        activateCheatCode(cheatCodeBuffer);
        cheatCodeBuffer = "";
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// --- 强化面板控制 ---
function toggleUpgradePanel() {
    if (upgradePanel.style.display === 'none') {
        openUpgradePanel();
    } else {
        closeUpgradePanel();
    }
}

function openUpgradePanel() {
    isGamePaused = true;
    cancelAnimationFrame(gameLoopRequestId);
    clearInterval(enemyInterval); // 停止生成敌人
    // 如果Boss有独立的计时器行为，也需要在这里暂停

    upgradePanel.style.display = 'block';
    renderUpgradePanel(); // 打开时渲染/更新内容
    debugLog("游戏已暂停，强化面板打开");
}

function closeUpgradePanel() {
    isGamePaused = false;
    upgradePanel.style.display = 'none';
    
    if (!bossActive) { // 只有在没有Boss时才恢复普通敌人生成
        startEnemyCreation();
    }
    // 如果Boss有独立的计时器行为，也需要在这里恢复
    
    gameLoopRequestId = requestAnimationFrame(gameLoop); // 重新启动游戏循环
    debugLog("游戏已恢复，强化面板关闭");
}

// --- 作弊面板控制 ---
function toggleCheatPanel() {
    if (cheatPanel.style.display === 'none') {
        openCheatPanel();
    } else {
        closeCheatPanel();
    }
}

function openCheatPanel() {
    isGamePaused = true;
    cancelAnimationFrame(gameLoopRequestId);
    clearInterval(enemyInterval);
    if (upgradePanel.style.display === 'block') {
        upgradePanel.style.display = 'none';
    }
    cheatPanel.style.display = 'block';
    debugLog('游戏已暂停，作弊面板打开');
}

function closeCheatPanel() {
    isGamePaused = false;
    cheatPanel.style.display = 'none';
    if (!bossActive) {
        startEnemyCreation();
    }
    gameLoopRequestId = requestAnimationFrame(gameLoop);
    debugLog('游戏已恢复，作弊面板关闭');
}

// 事件监听：关闭作弊面板按钮
if (closeCheatPanelButton) {
    closeCheatPanelButton.addEventListener('click', closeCheatPanel);
}

// 事件监听：作弊按钮
document.querySelectorAll('.cheat-button').forEach(btn => {
    btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-code');
        activateCheatCode(code);
    });
});

// 事件监听：关闭强化面板按钮
if (closeUpgradePanelButton) {
    closeUpgradePanelButton.addEventListener('click', closeUpgradePanel);
}

// 事件监听：游戏结束后打开强化面板按钮
if (openUpgradePanelButtonGameOver) {
    openUpgradePanelButtonGameOver.addEventListener('click', () => {
        document.getElementById('game-over').style.display = 'none'; // 关闭游戏结束提示
        openUpgradePanel();
    });
}


// --- 强化面板渲染 ---
function renderUpgradePanel() {
    if (!upgradePanelCurrencyDisplay || !powerUpUpgradesContainer || !playerStatUpgradesContainer) {
        console.error("强化面板部分DOM元素未找到!");
        return;
    }
    
    // 根据当前使用的飞机动态设置最大强化等级
    const MAX_UPGRADE_LEVEL = isUsingGoldenFighter ? GOLDEN_MAX_UPGRADE_LEVEL : BASE_MAX_UPGRADE_LEVEL;
    
    upgradePanelCurrencyDisplay.textContent = totalCurrency;

    // 更新黄金飞机状态
    updateGoldenFighterStatus();

    // 清空现有强化项
    powerUpUpgradesContainer.innerHTML = '<h3>道具强化 (持续时间)</h3>';
    playerStatUpgradesContainer.innerHTML = '<h3>战机属性强化</h3>';

    // 渲染当前最大等级信息
    const maxLevelInfo = document.createElement('div');
    maxLevelInfo.classList.add('max-level-info');
    maxLevelInfo.innerHTML = `当前强化等级上限: <span style="color: ${hasGoldenFighter ? 'gold' : 'white'}">${MAX_UPGRADE_LEVEL}</span>${hasGoldenFighter ? ' (黄金飞机特权)' : ''}`;
    powerUpUpgradesContainer.appendChild(maxLevelInfo);

    // 如果已激活特殊奖励，显示奖励信息
    if (shieldEfficiencyBoost && reducedSuperComboRequirement) {
        const specialRewardInfo = document.createElement('div');
        specialRewardInfo.classList.add('special-reward-info');
        specialRewardInfo.style.color = 'gold';
        specialRewardInfo.style.fontWeight = 'bold';
        specialRewardInfo.innerHTML = '全满级特殊奖励已激活:<br>- 护盾强度提升 (5点抵挡一次伤害)<br>- 超级组合道具需求降低 (3次永久激活)';
        powerUpUpgradesContainer.appendChild(specialRewardInfo);
    }

    // 渲染道具持续时间强化
    Object.values(POWER_UP_TYPES).forEach(type => {
        const levelKey = type + 'DurationLevel';
        const currentLevel = upgradeLevels[levelKey];
        const cost = calculateUpgradeCost(currentLevel);
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('upgrade-item');
        itemDiv.innerHTML = `
            <span>${getPowerUpName(type)} 持续时间: +${currentLevel * (POWER_UP_DURATION_INCREMENT_PER_LEVEL / 1000)}s (等级 ${currentLevel}/${MAX_UPGRADE_LEVEL})</span>
            <button data-type="${type}" data-category="duration" ${currentLevel >= MAX_UPGRADE_LEVEL || totalCurrency < cost ? 'disabled' : ''}>
                升级 (消耗 ${cost} 积分)
            </button>
        `;
        powerUpUpgradesContainer.appendChild(itemDiv);
    });

    // 渲染战机属性强化
    const playerStats = [
        { key: 'playerAttackSpeedLevel', name: '战机攻速', base: PLAYER_BASE_ATTACK_SPEED_INTERVAL, increment: -ATTACK_SPEED_DECREMENT_PER_LEVEL, unit: 'ms', displayMultiplier: 1, higherIsBetter: false },
        { key: 'playerMaxShieldLevel', name: '护盾上限', base: PLAYER_BASE_MAX_SHIELD, increment: MAX_SHIELD_INCREMENT_PER_LEVEL, unit: '', displayMultiplier: 1, higherIsBetter: true },
        { key: 'playerBulletDamageLevel', name: '攻击伤害', base: PLAYER_BASE_BULLET_DAMAGE, increment: BULLET_DAMAGE_INCREMENT_PER_LEVEL, unit: 'x', displayMultiplier: 1, higherIsBetter: true }
    ];

    playerStats.forEach(stat => {
        const currentLevel = upgradeLevels[stat.key];
        const cost = calculateUpgradeCost(currentLevel);
        let currentValue = stat.base + (currentLevel * stat.increment);
        if (stat.key === 'playerAttackSpeedLevel' && currentValue < 50) currentValue = 50; // 攻速下限

        const itemDiv = document.createElement('div');
        itemDiv.classList.add('upgrade-item');
        itemDiv.innerHTML = `
            <span>${stat.name}: ${currentValue.toFixed(stat.unit === 'ms' ? 0 : 1)}${stat.unit} (等级 ${currentLevel}/${MAX_UPGRADE_LEVEL})</span>
            <button data-type="${stat.key}" data-category="player" ${currentLevel >= MAX_UPGRADE_LEVEL || totalCurrency < cost ? 'disabled' : ''}>
                升级 (消耗 ${cost} 积分)
            </button>
        `;
        playerStatUpgradesContainer.appendChild(itemDiv);
    });

    // 为新生成的按钮添加事件监听
    upgradePanel.querySelectorAll('.upgrade-item button').forEach(button => {
        button.addEventListener('click', handleUpgradeClick);
    });
}

function getPowerUpName(type) {
    switch (type) {
        case POWER_UP_TYPES.DOUBLE_SHOT: return '双倍火力';
        case POWER_UP_TYPES.ATTACK_SPEED: return '攻速提升道具'; // 区分战机基础攻速
        case POWER_UP_TYPES.SCORE_MULTIPLIER: return '双倍积分';
        case POWER_UP_TYPES.SUPER_COMBO: return '超级组合道具';
        default: return '未知道具';
    }
}

function calculateUpgradeCost(currentLevel) {
    return 50 + Math.floor(Math.pow(currentLevel, 1.8) * 20); // 示例花费公式
}

function handleUpgradeClick(event) {
    // 根据当前使用的飞机动态设置最大强化等级
    const MAX_UPGRADE_LEVEL = isUsingGoldenFighter ? GOLDEN_MAX_UPGRADE_LEVEL : BASE_MAX_UPGRADE_LEVEL;
    
    const button = event.target;
    const type = button.dataset.type;
    const category = button.dataset.category; // 'duration' or 'player'

    let levelKey;
    if (category === 'duration') {
        levelKey = type + 'DurationLevel';
    } else {
        levelKey = type; // player stat keys are direct
    }

    const currentLevel = upgradeLevels[levelKey];
    if (currentLevel >= MAX_UPGRADE_LEVEL) {
        alert(`已达到最高等级 (${MAX_UPGRADE_LEVEL})!`);
        return;
    }

    const cost = calculateUpgradeCost(currentLevel);
    if (totalCurrency >= cost) {
        totalCurrency -= cost;
        upgradeLevels[levelKey]++;
        
        localStorage.setItem('totalGameCurrency', totalCurrency);
        localStorage.setItem('gameUpgradeLevels', JSON.stringify(upgradeLevels));
        
        applyUpgrades(); // 应用新的强化等级
        renderUpgradePanel(); // 重新渲染面板以更新状态和按钮
        updateGameUIDisplays(); // 更新游戏内可能显示的积分等

        debugLog(`强化 ${levelKey} 到等级 ${upgradeLevels[levelKey]}/${MAX_UPGRADE_LEVEL}. 剩余积分: ${totalCurrency}`);
        
        // 检查是否所有强化都达到最大等级
        if (hasGoldenFighter) {
            checkForSpecialRewards();
        }
    } else {
        alert("积分不足!");
    }
}

// 更新游戏内UI（例如游戏结束界面上的总积分）
function updateGameUIDisplays() {
    const totalCurrencyDisplayGameOver = document.getElementById('total-currency-display-gameover');
    if (totalCurrencyDisplayGameOver) {
        totalCurrencyDisplayGameOver.textContent = totalCurrency;
    }
    // 如果有其他地方显示总积分，也在这里更新
}


// 创建敌方战机
function createEnemy() {
    if (!bossActive) { // 只有在没有Boss时才创建普通敌人
        const isStrongerEnemy = Math.random() < 0.5; // 50% chance for a stronger enemy
        let newEnemy = {
            x: Math.random() * (canvas.width - 50), // 减去敌人宽度，防止出界
            y: -50, // 从画布外生成
            width: 50,
            height: 50,
            speed: 1.0
        };

        if (isStrongerEnemy) {
            newEnemy.image = enemyImage2;
            newEnemy.health = 2;
            newEnemy.type = 'fighter2';
        } else {
            newEnemy.image = enemyImage;
            newEnemy.health = 1; // Explicitly set health for normal enemy
            newEnemy.type = 'fighter1';
        }
        enemies.push(newEnemy);
    }
}

function createBoss() {
    enemies = []; // 清除所有普通敌人
    let bossType;
    let currentShield;
    let currentHealth;
    let bossImg;
    const bossWidth = 200;
    const bossHeight = 150;

    if (Math.random() < 0.5) {
        // Boss 2
        bossType = 'boss2';
        currentShield = (baseBossShield * (1 + 0.1 * boss2SpawnCount)) * 2; // Use boss2SpawnCount
        currentHealth = (baseBossHealth * (1 + 0.1 * boss2SpawnCount)) * 2; // Use boss2SpawnCount
        bossImg = bossImage2;
    } else {
        // Boss 1 (Original)
        bossType = 'boss1';
        currentShield = baseBossShield * (1 + 0.1 * bossSpawnCount);
        currentHealth = baseBossHealth * (1 + 0.1 * bossSpawnCount);
        bossImg = bossImage;
        // Spawn counts are now incremented on defeat
    }

    boss = {
        type: bossType,
        x: canvas.width / 2,
        y: 150, // Boss初始Y位置
        width: bossWidth, // Boss宽度
        height: bossHeight, // Boss高度
        speed: 0.5, // Boss移动速度
        shield: currentShield,
        health: currentHealth,
        maxShield: currentShield, // 存储最大护盾值
        maxHealth: currentHealth, // 存储最大健康值
        image: bossImg,
        dx: Math.random() < 0.5 ? -1 : 1, // 初始移动方向
        bullets: [],
        lastAttackTime: 0,
        attackInterval: 3000, // ms, Boss攻击间隔延长，因为新攻击方式更强
        currentAttackType: 0, // 0: 螺旋弹幕, 1: 追踪弹, 2: 圆形扩散
        attackCooldown: false // 攻击冷却状态
    };
    bossActive = true;
    clearInterval(enemyInterval); // 停止生成普通敌人
    debugLog(`Boss (${boss.type})出现了! 第 ${boss.type === 'boss1' ? bossSpawnCount : boss2SpawnCount} 次 (scaling based on previous defeats). 护盾: ${boss.shield}, 血量: ${boss.health}`);
}

// 螺旋弹幕攻击
function spiralBulletAttack() {
    if (!boss || isGamePaused) return;
    
    const bulletCount = 8;  // 每一圈发射的子弹数
    const spiralDuration = 3000;  // 螺旋持续时间(ms)
    const rotationsPerSecond = 0.5;  // 每秒旋转次数
    const bulletSpeed = 1.5;  // 较慢的子弹速度
    
    let startAngle = 0;
    boss.attackCooldown = true;
    
    const spiralInterval = setInterval(() => {
        if (!boss || isGamePaused) {
            clearInterval(spiralInterval);
            return;
        }
        
        for (let i = 0; i < bulletCount; i++) {
            const angle = startAngle + (Math.PI * 2 * i / bulletCount);
            const vx = Math.cos(angle) * bulletSpeed;
            const vy = Math.sin(angle) * bulletSpeed;
            
            const bullet = getBullet();
            bullet.x = boss.x;
            bullet.y = boss.y + boss.height / 2;
            bullet.width = 8;
            bullet.height = 8;
            bullet.dx = vx;
            bullet.dy = vy;
            bullet.damage = 10;
            bullet.color = '#FF00FF';  // 粉紫色子弹
            boss.bullets.push(bullet);
        }
        
        startAngle += Math.PI * 2 * rotationsPerSecond / (1000 / 200);  // 按rotationsPerSecond的速率旋转
    }, 200);  // 每200ms发射一波
    
    // 螺旋持续一段时间后停止
    setTimeout(() => {
        clearInterval(spiralInterval);
        if(boss) boss.attackCooldown = false;
    }, spiralDuration);
}

// 追踪弹攻击
function homingBulletAttack() {
    if (!boss || isGamePaused) return;
    
    const bulletCount = 3;  // 发射3颗追踪弹
    const bulletSpeed = 1.2;  // 追踪弹的基础速度
    const bulletLifespan = 8000;  // 追踪弹存在时间(ms)
    
    boss.attackCooldown = true;
    
    for (let i = 0; i < bulletCount; i++) {
        setTimeout(() => {
            if (!boss || isGamePaused) return;
            
            const bullet = getBullet();
            bullet.x = boss.x;
            bullet.y = boss.y + boss.height / 2;
            bullet.width = 12;
            bullet.height = 12;
            bullet.dx = 0;
            bullet.dy = bulletSpeed;
            bullet.damage = 15;
            bullet.color = '#00FFFF';  // 青色子弹
            bullet.isHoming = true;
            bullet.creationTime = Date.now();
            bullet.trackingStrength = 0.03;  // 追踪强度，值越大追踪越敏感

            boss.bullets.push(bullet);
        }, i * 500);  // 每0.5秒发射一颗
    }
    
    // 发射完所有子弹后结束冷却
    setTimeout(() => {
        if(boss) boss.attackCooldown = false;
    }, bulletCount * 500 + 500);  // 额外等待500ms
}

// 圆形扩散弹幕
function circularBulletAttack() {
    if (!boss || isGamePaused) return;
    
    const waveCount = 3;  // 发射3波
    const bulletsPerWave = 16;  // 每波16颗子弹
    const bulletSpeed = 1.8;  // 子弹速度
    
    boss.attackCooldown = true;
    
    for (let wave = 0; wave < waveCount; wave++) {
        setTimeout(() => {
            if (!boss || isGamePaused) return;
            
            for (let i = 0; i < bulletsPerWave; i++) {
                const angle = (Math.PI * 2 * i) / bulletsPerWave;
                const vx = Math.cos(angle) * bulletSpeed;
                const vy = Math.sin(angle) * bulletSpeed;
                
                const bullet = getBullet();
                bullet.x = boss.x;
                bullet.y = boss.y + boss.height / 2;
                bullet.width = 10;
                bullet.height = 10;
                bullet.dx = vx;
                bullet.dy = vy;
                bullet.damage = 12;
                bullet.color = '#FFFF00';  // 黄色子弹
                boss.bullets.push(bullet);
            }
        }, wave * 800);  // 每波之间间隔0.8秒
    }
    
    // 所有波次结束后取消冷却状态
    setTimeout(() => {
        if(boss) boss.attackCooldown = false;
    }, waveCount * 800 + 500);  // 额外等待500ms
}

function update() {
    // Boss 生成逻辑
    if (scoreForBossTrigger >= nextBossScore && !bossActive) { // 使用 scoreForBossTrigger 判断
        createBoss();
    }

    // 更新玩家位置
    if (keys['ArrowLeft'] && player.x > player.width / 2) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] && player.x < canvas.width - player.width / 2) {
        player.x += player.speed;
    }
    if (keys['ArrowUp'] && player.y > player.height / 2) {
        player.y -= player.speed;
    }
    if (keys['ArrowDown'] && player.y < canvas.height - player.height / 2) {
        player.y += player.speed;
    }

    // 移除基于移动距离的背景切换
    // if (Math.abs(player.x - lastPlayerX) > backgroundChangeThreshold) {
    //     backgroundIndex = backgroundIndex === 1 ? 2 : 1;
    //     document.getElementById('canvas-background').style.backgroundImage = `url('assets/images/container background${backgroundIndex}.png')`;
    //     lastPlayerX = player.x;
    // }

    // 玩家自动攻击
    const currentTime = Date.now();
    if (currentTime - player.lastAttackTime > player.currentAttackSpeed) { // 使用 currentAttackSpeed
        if (player.isDoubleShotActive) {
            let bullet = getBullet();
            bullet.x = player.x - player.width / 4;
            bullet.y = player.y - player.height / 2;
            bullet.width = 6;
            bullet.height = 14;
            bullet.speed = 10;
            player.bullets.push(bullet); // 左侧子弹

            bullet = getBullet();
            bullet.x = player.x + player.width / 4;
            bullet.y = player.y - player.height / 2;
            bullet.width = 6;
            bullet.height = 14;
            bullet.speed = 10;
            player.bullets.push(bullet); // 右侧子弹
        } else {
            const bullet = getBullet();
            bullet.x = player.x;
            bullet.y = player.y - player.height / 2;
            bullet.width = 6;
            bullet.height = 14;
            bullet.speed = 10;
            player.bullets.push(bullet);
        }
        player.lastAttackTime = currentTime;
    }

    // 场地效果2：护盾回复
    if (backgroundIndex === 2 && player.shield < player.maxShield) {
        if (currentTime - player.lastShieldRegenTime >= 1000) { // 每秒回复
            // 黄金飞机双倍护盾回复
            const regenAmount = isUsingGoldenFighter ? player.shieldRegenRate * 2 : player.shieldRegenRate;
            player.shield += regenAmount;
            if (player.shield > player.maxShield) {
                player.shield = player.maxShield;
            }
            player.lastShieldRegenTime = currentTime;
            debugLog(`玩家护盾回复: ${regenAmount} (总: ${player.shield})`);
        }
    }

    // 更新道具
    updatePowerUps(currentTime);
    // 生成道具
    spawnPowerUps(currentTime);
    // 检查激活的道具是否到期
    checkActivePowerUps(currentTime);


    // 更新玩家子弹
    for (let i = player.bullets.length - 1; i >= 0; i--) {
        let bullet = player.bullets[i];
        bullet.y -= bullet.speed;
        if (bullet.y < 0) {
            player.bullets.splice(i, 1);
            releaseBullet(bullet);
        }
    }

    // 更新敌人 (普通敌人)
    if (!bossActive) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            let enemy = enemies[i];
            enemy.y += enemy.speed;
            if (enemy.y > canvas.height) {
                enemies.splice(i, 1);
            }
        }
    }

    // 更新Boss
    if (bossActive && boss) {
        boss.x += boss.speed * boss.dx;
        // Boss 左右边界碰撞检测
        if (boss.x - boss.width / 2 < 0 || boss.x + boss.width / 2 > canvas.width) {
            boss.dx *= -1; // 改变方向
        }
        // Boss 与玩家子弹碰撞
        for (let j = player.bullets.length - 1; j >= 0; j--) {
            let bullet = player.bullets[j];
            if (bullet.x < boss.x + boss.width / 2 &&
                bullet.x + bullet.width > boss.x - boss.width / 2 &&
                bullet.y < boss.y + boss.height / 2 &&
                bullet.y + bullet.height > boss.y - boss.height / 2) {
                player.bullets.splice(j, 1); // 子弹消失
                releaseBullet(bullet);
                
                let damageDealt = player.bulletDamage * 10; // 基础伤害，乘以玩家子弹伤害系数

                if (boss.shield > 0) {
                    boss.shield -= damageDealt;
                    if (boss.shield < 0) { 
                        boss.health += boss.shield; 
                        boss.shield = 0;
                    }
                } else if (boss.health > 0) {
                    boss.health -= damageDealt;
                }
                
                if (backgroundIndex === 1 && boss.health > 0) {
                    // 场地真实伤害，根据击杀数计算
                    let realDamageForBuff;
                    if (isUsingGoldenFighter) {
                        realDamageForBuff = 1 + (goldenFighterKillsForBuff * 2);
                    } else {
                        realDamageForBuff = 1 + normalFighterKillsForBuff;
                    }
                    boss.health -= realDamageForBuff; 
                    debugLog(`场地真实伤害 (基于击杀): 对Boss造成 ${realDamageForBuff} 点伤害`);
                }

                if (boss.health < 0) boss.health = 0;

                if (boss.health <= 0) {
                    let bossKillScore = 500; // Base score for defeating a boss
                    // Adjust score based on which boss and its spawn count (difficulty)
                    if (boss.type === 'boss1') {
                        bossKillScore += (bossSpawnCount) * 100; // bossSpawnCount already reflects current encounter's level due to createBoss logic
                    } else if (boss.type === 'boss2') {
                        bossKillScore += (boss2SpawnCount) * 150; // Boss 2 might be worth more
                    }

                    if (player.isScoreMultiplierActive) bossKillScore *= 2;
                    score += bossKillScore; // 总分增加
                    scoreElement.textContent = `分数: ${score}`;

                    const defeatedBossType = boss.type; // Store type before boss is nulled
                    bossActive = false;
                    boss = null;

                    // Increment defeat counters for scaling next appearance
                    if (defeatedBossType === 'boss1') {
                        bossSpawnCount++;
                        debugLog(`Boss 1 defeated. Boss 1 appearance count for next scaling: ${bossSpawnCount}`);
                    } else if (defeatedBossType === 'boss2') {
                        boss2SpawnCount++;
                        debugLog(`Boss 2 defeated. Boss 2 appearance count for next scaling: ${boss2SpawnCount}`);
                    }
                    
                    nextBossScore += scoreForBoss; 
                    debugLog(`Boss (${defeatedBossType}) 被击败! Next Boss score trigger: ${nextBossScore}. Total score: ${score}, Boss trigger score: ${scoreForBossTrigger}`);

                    startEnemyCreation(); 
                    break;
                }
            }
        }

        // Boss 与玩家碰撞
        // 再次检查boss是否存在，因为它可能在上面的子弹碰撞中被击败并设为null
        if (boss && player.x < boss.x + boss.width / 2 &&
            player.x + player.width > boss.x - boss.width / 2 &&
            player.y < boss.y + boss.height / 2 &&
            player.y + player.height > boss.y - boss.height / 2) {
            handlePlayerHit(20); // 假设Boss碰撞造成20点伤害
        }

        // Boss 攻击逻辑 - 使用三种新的攻击模式
        if (boss && currentTime - boss.lastAttackTime > boss.attackInterval && !boss.attackCooldown) {
            // 随机选择一种攻击方式
            boss.currentAttackType = Math.floor(Math.random() * 3); // 0-2之间的随机整数
            
            switch (boss.currentAttackType) {
                case 0:
                    spiralBulletAttack(); // 螺旋弹幕
                    break;
                case 1:
                    homingBulletAttack(); // 追踪弹
                    break;
                case 2:
                    circularBulletAttack(); // 圆形扩散弹幕
                    break;
            }
            
            boss.lastAttackTime = currentTime;
        }

        // 更新Boss子弹
        if (boss) { 
            for (let i = boss.bullets.length - 1; i >= 0; i--) {
                let bBullet = boss.bullets[i];
                
                // 追踪弹特殊处理 - 如果是追踪弹，则朝向玩家方向调整速度
                if (bBullet.isHoming) {
                    // 检查子弹是否超过生命周期
                    if (Date.now() - bBullet.creationTime > 8000) { // 8秒后消失
                        boss.bullets.splice(i, 1);
                        releaseBullet(bBullet);
                        continue;
                    }
                    
                    // 计算朝向玩家的方向
                    const dx = player.x + player.width/2 - bBullet.x;
                    const dy = player.y + player.height/2 - bBullet.y;
                    const angle = Math.atan2(dy, dx);
                    
                    // 缓慢调整子弹速度向玩家方向
                    bBullet.dx += Math.cos(angle) * bBullet.trackingStrength;
                    bBullet.dy += Math.sin(angle) * bBullet.trackingStrength;
                    
                    // 限制最大速度
                    const speed = Math.sqrt(bBullet.dx * bBullet.dx + bBullet.dy * bBullet.dy);
                    if (speed > 1.8) { // 最大速度为1.8
                        bBullet.dx = (bBullet.dx / speed) * 1.8;
                        bBullet.dy = (bBullet.dy / speed) * 1.8;
                    }
                }
                
                // 更新子弹位置
                bBullet.x += bBullet.dx;
                bBullet.y += bBullet.dy;

                // Boss子弹与玩家碰撞检测 (使用中心点判定，更精确)
                if (bBullet.x + bBullet.width / 2 > player.x - player.width / 2 &&
                    bBullet.x - bBullet.width / 2 < player.x + player.width / 2 &&
                    bBullet.y + bBullet.height / 2 > player.y - player.height / 2 &&
                    bBullet.y - bBullet.height / 2 < player.y + player.height / 2) {
                    handlePlayerHit(bBullet.damage);
                    boss.bullets.splice(i, 1); // 子弹消失
                    releaseBullet(bBullet);
                    continue;
                }

                // 移除飞出边界的Boss子弹 (也检查左右边界)
                if (bBullet.y > canvas.height || bBullet.y < -bBullet.height || 
                    bBullet.x < -bBullet.width || bBullet.x > canvas.width + bBullet.width) {
                    boss.bullets.splice(i, 1);
                    releaseBullet(bBullet);
                }
            }
        }
    }


    // Detect collision between normal enemies and bullets
    if (!bossActive) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            let enemy = enemies[i];
            for (let j = player.bullets.length - 1; j >= 0; j--) {
                let bullet = player.bullets[j];
                if (bullet.x < enemy.x + enemy.width &&
                    bullet.x + bullet.width > enemy.x &&
                    bullet.y < enemy.y + enemy.height &&
                    bullet.y + bullet.height > enemy.y) {
                    
                    player.bullets.splice(j, 1);
                    releaseBullet(bullet);

                    // Handle enemy health
                    enemy.health -= 1; // Assuming player bullet does 1 damage

                    if (enemy.health <= 0) {
                        enemies.splice(i, 1);
                        let enemyKillScore = (enemy.type === 'fighter2') ? 20 : 10; // More points for stronger enemy
                        if (player.isScoreMultiplierActive) enemyKillScore *= 2;
                        score += enemyKillScore;  // 总分增加
                        scoreForBossTrigger += enemyKillScore; // Boss触发分也增加
                        scoreElement.textContent = `分数: ${score}`;

                        // Add to kill counts for buffs, ensuring enemy object still exists for type check
                        if (isUsingGoldenFighter) {
                            goldenFighterKillsForBuff++;
                        } else {
                            normalFighterKillsForBuff++;
                        }
                        debugLog(`场地Buff击杀计数 - 普通: ${normalFighterKillsForBuff}, 黄金: ${goldenFighterKillsForBuff}`);

                        if (backgroundIndex === 1) {
                            debugLog(`敌人 (${enemy.type}) 在背景1下被击中并消灭`);
                        } else {
                            debugLog(`敌人 (${enemy.type}) 在背景2下被击中并消灭`);
                        }
                    } else {
                        // Enemy is damaged but not destroyed
                        debugLog(`敌人 (${enemy.type}) 受伤, 剩余生命: ${enemy.health}`);
                    }
                    break; 
                }
            }
        }
    }

    // 检测玩家与普通敌人碰撞
    if (!bossActive) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            let enemy = enemies[i];
            if (player.x < enemy.x + enemy.width &&
                player.x + player.width > enemy.x &&
                player.y < enemy.y + enemy.height &&
                player.y + player.height > enemy.y) {
                enemies.splice(i, 1); // 敌人消失
                handlePlayerHit(10); // 假设普通敌人碰撞造成10点伤害
                break;
            }
        }
    }
}

function handlePlayerHit(damage) {
    if (player.shield > 0) {
        // 如果护盾效率提升特殊奖励激活，每5点护盾可以抵挡一次伤害
        if (shieldEfficiencyBoost) {
            // 只扣除5点护盾或剩余护盾值（如果不足5点）
            const shieldCost = Math.min(5, player.shield);
            player.shield -= shieldCost;
            debugLog(`玩家护盾高效抵挡伤害! 扣除护盾: ${shieldCost} (剩余: ${player.shield})`);
        } else {
            // 正常扣除护盾
            player.shield -= damage;
            if (player.shield < 0) {
                player.shield = 0; // 护盾不会为负
            }
            debugLog(`玩家护盾受损: ${player.shield}`);
        }
    } else {
        gameOver();
    }
}


function gameOver() {
    // 暂停游戏循环并清理计时器
    isGamePaused = true;
    cancelAnimationFrame(gameLoopRequestId);
    clearInterval(enemyInterval);

    const earnedCurrency = Math.floor(score / 2);
    totalCurrency += earnedCurrency;
    localStorage.setItem('totalGameCurrency', totalCurrency);

    // Save Boss defeat counts
    localStorage.setItem('bossSpawnCount', bossSpawnCount);
    debugLog(`Saved Boss 1 defeat count: ${bossSpawnCount}`);
    localStorage.setItem('boss2SpawnCount', boss2SpawnCount);
    debugLog(`Saved Boss 2 defeat count: ${boss2SpawnCount}`);

    // alert(`游戏结束！\n本局得分: ${score}\n获得积分: ${earnedCurrency}\n总积分: ${totalCurrency}`);
    document.getElementById('final-score-display').textContent = score;
    document.getElementById('earned-currency-display').textContent = earnedCurrency;
    document.getElementById('total-currency-display-gameover').textContent = totalCurrency;
    document.getElementById('game-over').style.display = 'block'; // 显示游戏结束面板
    
    score = 0;
    scoreElement.textContent = `分数: ${score}`;
    enemies = []; 
    player.x = canvas.width / 2;
    player.y = canvas.height - 30;
    player.bullets.forEach(releaseBullet);
    player.bullets = []; // 清除所有子弹
    player.shield = player.maxShield; 
    // 重置激活的道具效果
    Object.keys(player.activePowerUps).forEach(type => deactivatePowerUp(type, true)); // silent = true, 避免重复设置基础值
    if (boss) {
        boss.bullets.forEach(releaseBullet);
        boss.bullets = []; // 清空Boss子弹
    }
    player.isDoubleShotActive = false;
    player.isScoreMultiplierActive = false;
    player.currentAttackSpeed = player.baseAttackSpeed;
    // 重置超级组合道具状态
    player.superComboCount = 0; // 重置超级道具计数器
    player.isSuperComboActive = false; // 重置超级道具永久激活状态
    
    // 重置场地Buff击杀计数
    normalFighterKillsForBuff = 0;
    goldenFighterKillsForBuff = 0;

    boss = null; 
    bossActive = false;
    // 使用新的 scoreForBoss (800) 来计算下一次Boss的分数线
    // 这个逻辑确保了如果在一局游戏中途结束，下一次开始时 boss score 是合理的
    // 应该基于 scoreForBossTrigger 来计算
    nextBossScore = scoreForBoss * (Math.floor(scoreForBossTrigger / scoreForBoss) + 1); 
    if (scoreForBossTrigger < scoreForBoss) nextBossScore = scoreForBoss; 
    
    // bossSpawnCount and boss2SpawnCount are NOT reset here, they persist across games.
    powerUps = []; // 清空屏幕上的道具
    lastPowerUpSpawnTime = 0; // 重置道具生成计时
    scoreForBossTrigger = 0; // 重置用于触发Boss的分数
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制玩家
    if (player.image) {
        ctx.drawImage(player.image, player.x - player.width / 2, player.y - player.height / 2, player.width, player.height);
        
        // 如果是黄金飞机，添加发光效果
        if (isUsingGoldenFighter) {
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'gold';
            ctx.drawImage(player.image, player.x - player.width / 2, player.y - player.height / 2, player.width, player.height);
            ctx.restore();
        }
        
        // 绘制玩家护盾条和数值
        if (player.maxShield > 0) {
            let shieldPercentage = player.shield / player.maxShield;
            let shieldColor = 'rgba(0, 255, 255, 0.7)'; // 青色 (默认)
            if (shieldPercentage <= 0.3) {
                shieldColor = 'rgba(255, 0, 0, 0.7)'; // 红色 (低护盾)
            } else if (shieldPercentage <= 0.7) {
                shieldColor = 'rgba(255, 255, 0, 0.7)'; // 黄色 (中等护盾)
            }
            ctx.fillStyle = shieldColor;
            ctx.fillRect(player.x - player.width / 2, player.y + player.height / 2 + 5, player.width * shieldPercentage, 5);
            ctx.strokeStyle = 'white';
            ctx.strokeRect(player.x - player.width / 2, player.y + player.height / 2 + 5, player.width, 5);
        }
    } else {
        ctx.fillStyle = 'blue';
        ctx.fillRect(player.x - player.width / 2, player.y - player.height / 2, player.width, player.height);
    }

    // 绘制玩家子弹
    ctx.fillStyle = 'red';
    for (let bullet of player.bullets) {
        ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    }

    // 绘制敌人 (普通敌人)
    if (!bossActive) {
        for (let enemy of enemies) {
            if (enemy.image && enemy.image.complete) { // Check if enemy.image exists and is loaded
                ctx.drawImage(enemy.image, enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height);
            } else {
                // Fallback drawing if the specific enemy image isn't ready (e.g. new type image still loading)
                // Or if enemy.image was somehow not set (shouldn't happen with current createEnemy)
                ctx.fillStyle = 'grey'; // A neutral fallback color
                ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height);
                debugLog("Fallback drawing for an enemy, its image might not be loaded or set.", enemy);
            }
        }
    }

    // 绘制Boss
    if (bossActive && boss && boss.image.complete) {
        ctx.drawImage(boss.image, boss.x - boss.width / 2, boss.y - boss.height / 2, boss.width, boss.height);
        // 绘制Boss护盾条
        if (boss.shield > 0) {
            ctx.fillStyle = 'rgba(0, 150, 255, 0.7)'; // 蓝色护盾条
            ctx.fillRect(boss.x - boss.width / 2, boss.y - boss.height / 2 - 20, boss.width * (boss.shield / boss.maxShield), 10);
            ctx.strokeStyle = 'white';
            ctx.strokeRect(boss.x - boss.width / 2, boss.y - boss.height / 2 - 20, boss.width, 10);
        }
        // 绘制Boss血条
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'; // 红色血条
        const healthBarY = boss.shield > 0 ? boss.y - boss.height / 2 - 35 : boss.y - boss.height / 2 - 20; // 如果有护盾，血条在护盾条下方
        ctx.fillRect(boss.x - boss.width / 2, healthBarY, boss.width * (boss.health / boss.maxHealth), 10);
        ctx.strokeStyle = 'white';
        ctx.strokeRect(boss.x - boss.width / 2, healthBarY, boss.width, 10);

        // 绘制Boss子弹 - 根据攻击类型显示不同颜色
        for (let bBullet of boss.bullets) {
            // 使用子弹自身的颜色，如果没有定义则使用默认的紫色
            ctx.fillStyle = bBullet.color || 'purple';
            ctx.fillRect(bBullet.x - bBullet.width / 2, bBullet.y - bBullet.height / 2, bBullet.width, bBullet.height);
            
            // 对于追踪弹，添加发光效果
            if (bBullet.isHoming) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = bBullet.color;
                ctx.fillRect(bBullet.x - bBullet.width / 2, bBullet.y - bBullet.height / 2, bBullet.width, bBullet.height);
                ctx.shadowBlur = 0; // 重置阴影效果
            }
        }
    }

    // 显示当前场地Buff状态
    ctx.fillStyle = 'yellow';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left'; 
    let buffText = '';
    if (backgroundIndex === 1) {
        let currentRealDamageBuff = 1; // 基础伤害为1
        if (isUsingGoldenFighter) {
            currentRealDamageBuff += (goldenFighterKillsForBuff * 2);
        } else {
            currentRealDamageBuff += normalFighterKillsForBuff;
        }
        buffText = `场地: 真实伤害 (+${currentRealDamageBuff})`;
    } else if (backgroundIndex === 2) {
        buffText = '场地: 护盾回复 (+1/s)';
    }
    ctx.fillText(buffText, 10, canvas.height - 10);

    // 在右上角标题下方显示玩家护盾值
    if (player.maxShield > 0) {
        ctx.fillStyle = 'white';
        ctx.font = '18px Arial';
        ctx.textAlign = 'right'; 
        ctx.fillText(`护盾: ${player.shield} / ${player.maxShield}`, canvas.width - 20, 95); 
    }
    
    // 显示总积分 (临时，后续移到强化界面或主菜单)
    ctx.fillStyle = 'gold';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`总积分: ${totalCurrency}`, canvas.width - 20, 110); // 调整Y坐标到护盾值下方
    
    // 显示黄金飞机状态
    if (isUsingGoldenFighter) {
        ctx.fillStyle = 'gold';
        ctx.font = '16px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('黄金飞机激活 - 双倍增益中!', canvas.width - 20, 130);
        
        // 添加动画效果
        const pulseSize = 3 * Math.sin(Date.now() / 200) + 3; // 产生一个3-6之间的变化值
        ctx.beginPath();
        ctx.arc(canvas.width - 150, 130, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = 'gold';
        ctx.fill();
    }

    // 绘制道具
    drawPowerUps();
    // 绘制激活的道具状态
    drawActivePowerUpStatus();
}

// --- 道具系统函数 ---
function createPowerUp() {
    const types = Object.values(POWER_UP_TYPES);
    // 根据当前使用的飞机类型过滤可用道具
    let availableTypes = [...types]; 
    
    // 如果不是使用黄金飞机，则移除超级组合道具
    if (!isUsingGoldenFighter) {
        availableTypes = availableTypes.filter(type => type !== POWER_UP_TYPES.SUPER_COMBO);
    }
    
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    let color;
    switch (type) {
        case POWER_UP_TYPES.DOUBLE_SHOT: color = 'blue'; break;
        case POWER_UP_TYPES.ATTACK_SPEED: color = 'lime'; break; // 使用 lime 替代 green，更亮眼
        case POWER_UP_TYPES.SCORE_MULTIPLIER: color = 'gold'; break;
        case POWER_UP_TYPES.SUPER_COMBO: color = 'rainbow'; break;
        default: color = 'grey';
    }
    powerUps.push({
        x: Math.random() * (canvas.width - POWER_UP_SIZE),
        y: -POWER_UP_SIZE,
        width: POWER_UP_SIZE,
        height: POWER_UP_SIZE,
        type: type,
        color: color,
        speed: POWER_UP_SPEED
    });
    debugLog(`生成道具: ${type}${type === POWER_UP_TYPES.SUPER_COMBO ? ' (黄金飞机专属)' : ''}`);
}

function updatePowerUps(currentTime) {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        let p = powerUps[i];
        p.y += p.speed;

        // 玩家拾取检测
        if (p.x < player.x + player.width / 2 &&
            p.x + p.width > player.x - player.width / 2 &&
            p.y < player.y + player.height / 2 &&
            p.y + p.height > player.y - player.height / 2) {
            activatePowerUp(p.type, currentTime);
            powerUps.splice(i, 1);
            continue;
        }

        if (p.y > canvas.height) {
            powerUps.splice(i, 1);
        }
    }
}

function spawnPowerUps(currentTime) {
    if (currentTime - lastPowerUpSpawnTime > powerUpSpawnInterval) {
        createPowerUp();
        lastPowerUpSpawnTime = currentTime;
    }
}

function activatePowerUp(type, currentTime) {
    debugLog(`激活道具: ${type}`);
    let duration = BASE_POWER_UP_DURATION;
    const durationLevelKey = type + 'DurationLevel';
    if (upgradeLevels[durationLevelKey] !== undefined) {
        const effectiveDurationLevel = isUsingGoldenFighter
            ? upgradeLevels[durationLevelKey]
            : Math.min(upgradeLevels[durationLevelKey], BASE_MAX_UPGRADE_LEVEL);
        duration += effectiveDurationLevel * POWER_UP_DURATION_INCREMENT_PER_LEVEL;
    }
    
    // 黄金飞机双倍持续时间效果
    if (isUsingGoldenFighter) {
        duration *= 2;
    }
    
    player.activePowerUps[type] = currentTime + duration;
    debugLog(`道具 ${type} 持续时间: ${duration / 1000}s${isUsingGoldenFighter ? ' (黄金飞机加成)' : ''}`);

    switch (type) {
        case POWER_UP_TYPES.DOUBLE_SHOT:
            player.isDoubleShotActive = true;
            break;
        case POWER_UP_TYPES.ATTACK_SPEED:
            player.currentAttackSpeed = player.baseAttackSpeed / 2;
            break;
        case POWER_UP_TYPES.SCORE_MULTIPLIER:
            player.isScoreMultiplierActive = true;
            break;
        case POWER_UP_TYPES.SUPER_COMBO:
            // 超级组合道具逻辑
            player.superComboCount++;
            
            // 根据特殊奖励状态确定永久激活所需次数
            const requiredCount = reducedSuperComboRequirement ? REDUCED_SUPER_COMBO_REQUIREMENT : NORMAL_SUPER_COMBO_REQUIREMENT;
            debugLog(`超级组合道具计数: ${player.superComboCount}/${requiredCount}${reducedSuperComboRequirement ? ' (需求已降低!)' : ''}`);
            
            // 同时激活所有道具效果
            player.isDoubleShotActive = true;
            player.currentAttackSpeed = player.baseAttackSpeed / 2;
            player.isScoreMultiplierActive = true;
            
            // 当拾取到足够次数后，永久激活组合效果
            if (player.superComboCount >= requiredCount && !player.isSuperComboActive) {
                player.isSuperComboActive = true;
                debugLog(`超级组合道具效果已永久激活! (需求: ${requiredCount}次)`);
                
                // 移除计时器，因为效果已永久激活
                delete player.activePowerUps[type];
            }
            break;
    }
}

function deactivatePowerUp(type, silent = false) {
    if (!silent) debugLog(`道具结束: ${type}`);
    delete player.activePowerUps[type];

    switch (type) {
        case POWER_UP_TYPES.DOUBLE_SHOT:
            // 只有当超级组合效果未永久激活时才取消效果
            if (!player.isSuperComboActive && !player.activePowerUps['CHEAT_SUPER_EFFECT']) {
                player.isDoubleShotActive = false;
            }
            break;
        case POWER_UP_TYPES.ATTACK_SPEED:
            // 只有当超级组合效果未永久激活时才恢复攻速
            if (!player.isSuperComboActive && !player.activePowerUps['CHEAT_SUPER_EFFECT']) {
                player.currentAttackSpeed = player.baseAttackSpeed;
            }
            break;
        case POWER_UP_TYPES.SCORE_MULTIPLIER:
            // 只有当超级组合效果未永久激活时才取消效果
            if (!player.isSuperComboActive && !player.activePowerUps['CHEAT_SUPER_EFFECT']) {
                player.isScoreMultiplierActive = false;
            }
            break;
        case POWER_UP_TYPES.SUPER_COMBO:
            // 如果超级组合道具未达到永久激活条件，则取消所有效果
            // 并且当前没有作弊码的超级效果激活
            if (!player.isSuperComboActive && !player.activePowerUps['CHEAT_SUPER_EFFECT']) {
                player.isDoubleShotActive = false;
                player.currentAttackSpeed = player.baseAttackSpeed;
                player.isScoreMultiplierActive = false;
            }
            break;
        case 'CHEAT_SUPER_EFFECT': // 处理作弊码效果到期
            if (!player.isSuperComboActive) { // 如果永久超级组合未激活
                player.isDoubleShotActive = false;
                player.currentAttackSpeed = player.baseAttackSpeed;
                player.isScoreMultiplierActive = false;
                debugLog("作弊码超级效果结束");
            } else {
                 // 如果永久超级组合已激活，作弊码效果结束时不需要改变状态，因为永久效果优先
                debugLog("作弊码超级效果计时结束，但永久超级组合已激活");
            }
            break;
    }
}

function checkActivePowerUps(currentTime) {
    for (const type in player.activePowerUps) {
        if (currentTime >= player.activePowerUps[type]) {
            deactivatePowerUp(type);
        }
    }
}

function drawPowerUps() {
    for (let p of powerUps) {
        if (p.color === 'rainbow') {
            // 为超级组合道具绘制彩色渐变
            const gradient = ctx.createLinearGradient(p.x, p.y, p.x + p.width, p.y + p.height);
            gradient.addColorStop(0, 'red');
            gradient.addColorStop(0.2, 'orange');
            gradient.addColorStop(0.4, 'yellow');
            gradient.addColorStop(0.6, 'green');
            gradient.addColorStop(0.8, 'blue');
            gradient.addColorStop(1, 'purple');
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = p.color;
        }
        ctx.fillRect(p.x, p.y, p.width, p.height);
        // 可以绘制文字标识道具类型
        ctx.fillStyle = 'black';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        let text = '';
        if (p.type === POWER_UP_TYPES.DOUBLE_SHOT) text = '2X';
        else if (p.type === POWER_UP_TYPES.ATTACK_SPEED) text = 'SPD';
        else if (p.type === POWER_UP_TYPES.SCORE_MULTIPLIER) text = 'PTS';
        else if (p.type === POWER_UP_TYPES.SUPER_COMBO) text = 'ALL';
        ctx.fillText(text, p.x + p.width / 2, p.y + p.height / 2 + 3);
    }
}

function drawActivePowerUpStatus() {
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    let yOffset = canvas.height - 30; // 从场地buff文字上方开始

    // 如果超级组合道具永久激活，显示该状态
    if (player.isSuperComboActive) {
        ctx.fillStyle = 'gold';
        ctx.fillText("超级组合效果已永久激活!", 10, yOffset);
        yOffset -= 20;
        ctx.fillStyle = 'white';
    } else {
        // 显示超级组合道具计数
        if (player.superComboCount > 0) {
            const requiredCount = reducedSuperComboRequirement ? REDUCED_SUPER_COMBO_REQUIREMENT : NORMAL_SUPER_COMBO_REQUIREMENT;
            ctx.fillStyle = 'gold';
            ctx.fillText(`超级组合: ${player.superComboCount}/${requiredCount}${reducedSuperComboRequirement ? ' (需求已降低!)' : ''}`, 10, yOffset);
            yOffset -= 20;
            ctx.fillStyle = 'white';
        }
    }

    // 如果护盾效率提升特殊奖励激活，显示该状态
    if (shieldEfficiencyBoost) {
        ctx.fillStyle = 'cyan';
        ctx.fillText("护盾增强: 5点抵挡一次伤害", 10, yOffset);
        yOffset -= 20;
        ctx.fillStyle = 'white';
    }

    Object.keys(player.activePowerUps).forEach(type => {
        const timeLeft = Math.ceil((player.activePowerUps[type] - Date.now()) / 1000);
        let text = '';
        if (type === POWER_UP_TYPES.DOUBLE_SHOT) text = `双倍火力: ${timeLeft}s`;
        else if (type === POWER_UP_TYPES.ATTACK_SPEED) text = `攻速提升: ${timeLeft}s`;
        else if (type === POWER_UP_TYPES.SCORE_MULTIPLIER) text = `双倍积分: ${timeLeft}s`;
        else if (type === POWER_UP_TYPES.SUPER_COMBO) text = `超级组合: ${timeLeft}s`;
        else if (type === 'CHEAT_SUPER_EFFECT') text = `作弊效果 (类超组合): ${timeLeft}s`;
        
        if (text) {
            ctx.fillText(text, 10, yOffset);
            yOffset -= 20; // 上移，为下一个buff留空间
        }
    });
}


// --- 游戏主循环和启动 ---
function gameLoop() {
    if (isGamePaused) {
        // 如果游戏暂停，可以只绘制UI覆盖层或什么都不做，然后等待恢复
        // requestAnimationFrame(gameLoop); // 如果希望暂停时仍保持动画循环（例如面板动画）
        return; // 或者直接返回，完全停止，直到 unpause 时再调用 requestAnimationFrame
    }
    update();
    draw();
    gameLoopRequestId = requestAnimationFrame(gameLoop);
}

function startEnemyCreation() {
    clearInterval(enemyInterval); 
    enemyInterval = setInterval(createEnemy, 1000);
}

// --- 游戏启动 ---
initializeGame(); // 初始化游戏数据
renderUpgradePanel(); // 初始渲染一次强化面板，确保按钮事件绑定
// 游戏将在点击开始按钮或重新开始按钮时启动

// 更新玩家飞机图像
function updatePlayerImage() {
    if (isUsingGoldenFighter && hasGoldenFighter) {
        player.image = goldenFighterImage;
    } else {
        player.image = playerImage;
    }
}

// 切换飞机函数
function toggleFighter() {
    if (hasGoldenFighter) {
        isUsingGoldenFighter = !isUsingGoldenFighter;
        updatePlayerImage();
        applyUpgrades(); // 重新应用所有属性

        // 切换飞机后同步当前属性
        if (
            player.isSuperComboActive ||
            player.activePowerUps[POWER_UP_TYPES.ATTACK_SPEED] ||
            player.activePowerUps[POWER_UP_TYPES.SUPER_COMBO] ||
            player.activePowerUps['CHEAT_SUPER_EFFECT']
        ) {
            player.currentAttackSpeed = player.baseAttackSpeed / 2;
        } else {
            player.currentAttackSpeed = player.baseAttackSpeed;
        }
        if (player.shield > player.maxShield) {
            player.shield = player.maxShield;
        }
        updateGoldenFighterStatus();
        debugLog(`切换到${isUsingGoldenFighter ? '黄金飞机' : '普通飞机'}`);
        
        // 更新游戏界面提示
        const goldenFighterIndicator = document.getElementById('golden-fighter-indicator');
        if (isUsingGoldenFighter) {
            if (!goldenFighterIndicator) {
                const indicator = document.createElement('div');
                indicator.id = 'golden-fighter-indicator';
                indicator.className = 'using-golden-fighter';
                indicator.textContent = '黄金飞机 - 双倍增益中';
                document.getElementById('game-container').appendChild(indicator);
            }
        } else {
            if (goldenFighterIndicator) {
                goldenFighterIndicator.remove();
            }
        }
    } else {
        debugLog('没有黄金飞机，无法切换');
    }
}

// 添加更新黄金飞机状态的函数
function updateGoldenFighterStatus() {
    const statusContainer = document.getElementById('golden-fighter-status');
    if (!statusContainer) return;
    
    statusContainer.innerHTML = '';
    
    if (hasGoldenFighter) {
        // 已拥有，显示切换按钮
        const statusText = document.createElement('p');
        statusText.textContent = `状态: ${isUsingGoldenFighter ? '使用中' : '未使用'}`;
        statusText.style.color = isUsingGoldenFighter ? 'gold' : 'white';
        statusContainer.appendChild(statusText);
        
        const toggleButton = document.createElement('button');
        toggleButton.textContent = isUsingGoldenFighter ? '切换到普通飞机' : '启用黄金飞机';
        toggleButton.onclick = function() {
            toggleFighter();
        };
        statusContainer.appendChild(toggleButton);
    } else {
        // 未拥有，显示购买按钮
        const statusText = document.createElement('p');
        statusText.textContent = `未拥有 - 价格: ${GOLDEN_FIGHTER_PRICE} 积分`;
        statusText.style.color = 'silver';
        statusContainer.appendChild(statusText);
        
        const buyButton = document.createElement('button');
        buyButton.textContent = '购买黄金飞机';
        buyButton.disabled = totalCurrency < GOLDEN_FIGHTER_PRICE;
        buyButton.onclick = function() {
            if (totalCurrency >= GOLDEN_FIGHTER_PRICE) {
                totalCurrency -= GOLDEN_FIGHTER_PRICE;
                hasGoldenFighter = true;
                localStorage.setItem('hasGoldenFighter', 'true');
                localStorage.setItem('totalGameCurrency', totalCurrency);
                upgradePanelCurrencyDisplay.textContent = totalCurrency;
                updateGoldenFighterStatus();
                debugLog('黄金飞机购买成功!');
            } else {
                debugLog('积分不足，无法购买黄金飞机');
            }
        };
        statusContainer.appendChild(buyButton);
    }
}

// 重新开始游戏
function restartGame() {
    document.getElementById('game-over').style.display = 'none';
    initializeGame();
    isGamePaused = false;
    startEnemyCreation();
    gameLoopRequestId = requestAnimationFrame(gameLoop);
}

// 绑定开始和重新开始按钮事件
const startButton = document.getElementById('start-button');
if (startButton) {
    startButton.style.display = 'block';
    startButton.addEventListener('click', () => {
        startButton.style.display = 'none';
        restartGame();
    });
}

const restartButton = document.getElementById('restart-button');
if (restartButton) {
    restartButton.addEventListener('click', restartGame);
}
