// ========================================================================
// JOGO.JS - VERSÃO COM ARQUITETURA DE RENDERIZAÇÃO CORRIGIDA
// ========================================================================

window.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÃO INICIAL (SETUP) ---
    const canvas = document.getElementById('gameCanvas');
    const startScreen = document.getElementById('start-screen');
    const characterSelection = document.getElementById('character-selection');
    const loadingMessage = document.getElementById('loading-message');
    const characterButtons = document.querySelectorAll('.character-card button');
    const highScoreValueEl = document.getElementById('high-score-value');
    const highWaveValueEl = document.getElementById('high-wave-value');
    const pageFooter = document.getElementById('page-footer');
    const ctx = canvas.getContext('2d');
    
    const zoomLevel = 1.25;
    const HEALTH_ORB_DROP_CHANCE = 0.15;

    const keys = { w: { pressed: false }, a: { pressed: false }, s: { pressed: false }, d: { pressed: false } };
    let player; 
    const projectiles = []; const monsters = []; const enemyProjectiles = []; const lootDrops = []; const shockwaves = []; const orbitals = []; const damageNumbers = [];
    let score = 0; let animationId; let passiveChoiceOptions = [];
    let waveNumber = 0; let monstersRemainingInWave = 0; let waveTransitionTimer = 3 * 60; let gameState = 'start_screen';
    let screenShakeDuration = 0; let screenShakeIntensity = 0;
    
    const assetsToLoad = { backgroundImage: 'background.png', playerDownImage: 'player-down.png', playerUpImage: 'player-up.png', playerRightImage: 'player-right.png', meleeMonsterImage: 'melee-monster.png', rangedMonsterImage: 'ranged-monster.png', bossImage: 'boss.png', playerProjectileImage: 'projectile-player.png', enemyProjectileImage: 'projectile-enemy.png' };
    const assets = {};
    let assetsLoaded = 0;
    const totalAssets = Object.keys(assetsToLoad).length;
    function assetLoadedCallback() { assetsLoaded++; if (assetsLoaded === totalAssets) { loadingMessage.classList.add('hidden'); characterSelection.classList.remove('hidden'); characterButtons.forEach(button => button.disabled = false); } }
    for (const key in assetsToLoad) { assets[key] = new Image(); assets[key].src = `assets/${assetsToLoad[key]}`; assets[key].onload = assetLoadedCallback; assets[key].onerror = () => { console.error(`Erro ao carregar o recurso: ${assetsToLoad[key]}`); loadingMessage.innerText = `Erro ao carregar ${assetsToLoad[key]}.`; }; }

    const backgroundMusic = new Audio('assets/background-music.mp3');
    backgroundMusic.loop = true; backgroundMusic.volume = 0.4;
    
    const SKILL_DATA = { shockwave: { name: 'Onda de Choque', maxLevel: 5, description: "Cria uma explosão em área." }, nova: { name: 'Nova de Projéteis', maxLevel: 5, description: "Dispara projéteis em 360 graus." }, orbitals: { name: 'Orbes Giratórios', maxLevel: 1, description: "Conjura um orbe que o protege." }, vigor: { name: 'Vigor', maxLevel: 5, description: "+15% Vida Máxima" }, frenesim: { name: 'Frenesim', maxLevel: 5, description: "+15% Vel. de Ataque" }, pressa: { name: 'Pressa', maxLevel: 5, description: "+12% Vel. de Movimento" }, forca: { name: 'Força', maxLevel: 5, description: "+20% de Dano" }, ganancia: { name: 'Ganância', maxLevel: 5, description: "+40% Raio de Coleta" }, recuperacao: { name: 'Recuperação', maxLevel: 1, description: "Cura 40% da vida máxima"} };

    function playSound(src, volume = 0.5) { const sound = new Audio(`assets/${src}`); sound.volume = volume; sound.play().catch(error => console.error(`Erro ao tocar o som ${src}:`, error)); }
    function triggerScreenShake(duration, intensity) { screenShakeDuration = duration; screenShakeIntensity = intensity; }
    function decreaseScreenShake() { if (screenShakeDuration > 0) { screenShakeDuration--; } else { screenShakeIntensity = 0; } }

    // ========================================================================
    // CLASSES
    // ========================================================================
    class Player { constructor(x, y) { this.x = x; this.y = y; this.images = { down: assets.playerDownImage, up: assets.playerUpImage, right: assets.playerRightImage, }; this.direction = 'down'; this.image = this.images.down; this.width = 40; this.height = 40; this.radius = 20; this.speed = 3; this.maxHealth = 100; this.health = this.maxHealth; this.level = 1; this.xp = 0; this.xpToNextLevel = 100; this.projectileSpeed = 5; this.attackCooldown = 30; this.currentAttackCooldown = 0; this.damage = 25; this.collectionRadius = 50; this.skills = {}; this.skillCooldowns = { shockwave: 480, nova: 600 }; this.currentSkillCooldowns = { shockwave: 0, nova: 0 }; } 
        draw() { if (this.direction === 'left') { ctx.save(); ctx.scale(-1, 1); ctx.drawImage(this.images.right, -this.x - this.width / 2, this.y - this.height / 2, this.width, this.height); ctx.restore(); } else { ctx.drawImage(this.image, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height); } } 
        drawHealthBar() { ctx.fillStyle = 'red'; ctx.fillRect(10, 10, 200, 20); ctx.fillStyle = 'green'; ctx.fillRect(10, 10, (this.health / this.maxHealth) * 200, 20); ctx.strokeStyle = 'white'; ctx.strokeRect(10, 10, 200, 20); } 
        drawXpBar() { const barWidth = canvas.width - 20; ctx.fillStyle = '#444'; ctx.fillRect(10, canvas.height - 30, barWidth, 20); ctx.fillStyle = '#8a2be2'; ctx.fillRect(10, canvas.height - 30, (this.xp / this.xpToNextLevel) * barWidth, 20); ctx.strokeStyle = 'white'; ctx.strokeRect(10, canvas.height - 30, barWidth, 20); ctx.fillStyle = 'white'; ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.fillText(`LVL ${this.level}`, 40, canvas.height - 15); ctx.fillText(`${Math.floor(this.xp)} / ${this.xpToNextLevel}`, barWidth / 2 + 10, canvas.height - 15); ctx.textAlign = 'left'; } 
        gainXp(amount) { if (gameState !== 'in_wave') return; this.xp += amount; if (this.xp >= this.xpToNextLevel) { this.levelUp(); } } 
        heal(amount) { this.health = Math.min(this.maxHealth, this.health + amount); } 
        levelUp() { this.level++; this.xp -= this.xpToNextLevel; this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5); gameState = 'passive_choice'; playSound('levelup.wav', 0.8); generatePassiveChoices(); } 
        update() { if (keys.w.pressed) { this.y -= this.speed; this.direction = 'up'; } if (keys.s.pressed) { this.y += this.speed; this.direction = 'down'; } if (keys.a.pressed) { this.x -= this.speed; this.direction = 'left'; } if (keys.d.pressed) { this.x += this.speed; this.direction = 'right'; } if(this.direction !== 'left') { this.image = this.images[this.direction]; } this.currentAttackCooldown--; if (this.currentAttackCooldown <= 0) { this.performBasicAttack(); this.currentAttackCooldown = this.attackCooldown; } this.updateSkillCooldowns(); } 
        performBasicAttack() { let closestEnemy = null; let minDistance = Infinity; const aimingRange = 300; monsters.forEach(monster => { const distance = Math.hypot(this.x - monster.x, this.y - monster.y); if (distance < aimingRange && distance < minDistance) { closestEnemy = monster; minDistance = distance; } }); if (closestEnemy) { const angle = Math.atan2(closestEnemy.y - this.y, closestEnemy.x - this.x); const velocity = { x: Math.cos(angle) * this.projectileSpeed, y: Math.sin(angle) * this.projectileSpeed }; projectiles.push(new Projectile(this.x, this.y, velocity, assets.playerProjectileImage)); playSound('shoot.wav', 0.3); } } 
        updateSkillCooldowns() { for (const skill in this.currentSkillCooldowns) { if (this.skills[skill]) { if (this.currentSkillCooldowns[skill] > 0) { this.currentSkillCooldowns[skill]--; } else { if (skill === 'shockwave') this.performShockwave(); if (skill === 'nova') this.performNova(); this.currentSkillCooldowns[skill] = this.skillCooldowns[skill]; } } } } 
        performShockwave() { const level = this.skills.shockwave || 1; const radius = 100 + (level * 20); const damage = 40 + (level * 10); shockwaves.push(new Shockwave(this.x, this.y, radius, damage)); } 
        performNova() { const level = this.skills.nova || 1; const projectileCount = 8 + (level * 2); const angleIncrement = (Math.PI * 2) / projectileCount; for (let i = 0; i < projectileCount; i++) { const angle = i * angleIncrement; const velocity = { x: Math.cos(angle) * 3, y: Math.sin(angle) * 3 }; projectiles.push(new Projectile(this.x, this.y, velocity, assets.playerProjectileImage)); } } 
    }
    class Projectile { constructor(x, y, velocity, image) { this.x = x; this.y = y; this.velocity = velocity; this.image = image; this.width = 25; this.height = 25; this.radius = 12.5; } draw() { ctx.drawImage(this.image, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height); } update() { this.x += this.velocity.x; this.y += this.velocity.y; } }
    class Loot { constructor(x, y, radius, color, xpValue, scoreValue, type = 'xp', healAmount = 0) { this.x = x; this.y = y; this.radius = radius; this.color = color; this.xpValue = xpValue; this.scoreValue = scoreValue; this.type = type; this.healAmount = healAmount; } draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); } update() { const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y); if (distToPlayer < player.collectionRadius) { const angle = Math.atan2(player.y - this.y, player.x - this.x); const speed = Math.max(5, (player.collectionRadius - distToPlayer) * 0.1); this.x += Math.cos(angle) * speed; this.y += Math.sin(angle) * speed; } } }
    class Monster { constructor(x, y, width, height, speed, health, image, xpValue) { this.x = x; this.y = y; this.width = width; this.height = height; this.radius = width / 2; this.speed = speed; this.maxHealth = health; this.health = health; this.image = image; this.velocity = { x: 0, y: 0 }; this.xpValue = xpValue; this.scoreValue = 100; } 
        draw() { ctx.drawImage(this.image, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height); this.drawHealthBar(); } 
        drawHealthBar() { if(this.health < this.maxHealth) { const barWidth = this.width * 0.8; const barHeight = 5; const yOffset = this.y - this.height / 2 - 10; ctx.fillStyle = '#333'; ctx.fillRect(this.x - barWidth / 2, yOffset, barWidth, barHeight); ctx.fillStyle = 'red'; ctx.fillRect(this.x - barWidth / 2, yOffset, barWidth * (this.health / this.maxHealth), barHeight); } } 
        update() { const angle = Math.atan2(player.y - this.y, player.x - this.x); this.velocity.x = Math.cos(angle) * this.speed; this.velocity.y = Math.sin(angle) * this.speed; this.x += this.velocity.x; this.y += this.velocity.y; } 
    }
    class MeleeMonster extends Monster { constructor(x, y, width, height, speed, health, isRare, xpValue) { super(x, y, width, height, speed, health, assets.meleeMonsterImage, xpValue); } }
    class RangedMonster extends Monster {
        constructor(x, y, width, height, speed, health, isRare, xpValue) {
            super(x, y, width, height, speed, health, assets.rangedMonsterImage, xpValue);
            this.shootCooldown = 120;
            this.width = 65; this.height = 65; this.radius = 32.5;
            if(isRare) { this.width *= 1.2; this.height *= 1.2; this.radius *= 1.2; }
        }
        update() {
            const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
            if (distToPlayer > 300) {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                this.velocity.x = Math.cos(angle) * this.speed;
                this.velocity.y = Math.sin(angle) * this.speed;
                this.x += this.velocity.x;
                this.y += this.velocity.y;
            }
            this.shootCooldown--;
            if (this.shootCooldown <= 0) {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                const projectileSpeed = 4;
                const velocity = { x: Math.cos(angle) * projectileSpeed, y: Math.sin(angle) * projectileSpeed };
                enemyProjectiles.push(new Projectile(this.x, this.y, velocity, assets.enemyProjectileImage));
                this.shootCooldown = 120;
            }
        }
    }
    class Shockwave { constructor(x, y, maxRadius, damage) { this.x = x; this.y = y; this.maxRadius = maxRadius; this.damage = damage; this.currentRadius = 10; this.speed = 5; this.monstersHit = []; } update() { this.currentRadius += this.speed; } draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.currentRadius, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255, 255, 0, ${1 - this.currentRadius / this.maxRadius})`; ctx.lineWidth = 5; ctx.stroke(); } }
    class Orbital { constructor(player, distance, angleOffset) { this.player = player; this.distance = distance; this.angle = angleOffset; this.radius = 8; this.color = 'magenta'; this.damage = 10; this.rotationSpeed = 0.05; this.hitCooldown = 30; this.monstersOnCooldown = new Map(); } update() { this.angle += this.rotationSpeed; this.x = this.player.x + Math.cos(this.angle) * this.distance; this.y = this.player.y + Math.sin(this.angle) * this.distance; this.monstersOnCooldown.forEach((cooldown, monster) => { if (cooldown > 0) { this.monstersOnCooldown.set(monster, cooldown - 1); } else { this.monstersOnCooldown.delete(monster); } }); } draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill(); ctx.strokeStyle = 'white'; ctx.stroke(); } }
    class Boss extends RangedMonster { constructor(x, y, xpValue) { const width = 100, height = 100, speed = 0.8; const health = 1000 + (waveNumber * 100); super(x, y, width, height, speed, health, true, xpValue); this.image = assets.bossImage; this.shootCooldown = 90; this.xpValue = xpValue || 500; this.scoreValue = 2000; } update() { super.update(); } }
    class DamageText { constructor(x, y, text, color = 'white') { this.x = x; this.y = y; this.text = text; this.color = color; this.alpha = 1; this.velocity = -0.5; this.lifespan = 60; } update() { this.y += this.velocity; this.lifespan--; if (this.lifespan < 30) { this.alpha -= 1 / 30; } } draw() { ctx.save(); ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText(this.text, this.x, this.y); ctx.restore(); } }

    // ========================================================================
    // FUNÇÕES DE GESTÃO DE JOGO E RECORDES
    // ========================================================================
    function saveHighScores() { const currentHighScore = parseInt(localStorage.getItem('highScore')) || 0; const currentHighWave = parseInt(localStorage.getItem('highWave')) || 0; if (score > currentHighScore) { localStorage.setItem('highScore', score); } if (waveNumber > currentHighWave) { localStorage.setItem('highWave', waveNumber); } }
    function loadHighScores() { const highScore = parseInt(localStorage.getItem('highScore')) || 0; const highWave = parseInt(localStorage.getItem('highWave')) || 0; highScoreValueEl.innerText = highScore; highWaveValueEl.innerText = highWave; }
    function triggerGameOver() { saveHighScores(); cancelAnimationFrame(animationId); backgroundMusic.pause(); backgroundMusic.currentTime = 0; ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'white'; ctx.font = '50px Cinzel'; ctx.textAlign = 'center'; ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40); ctx.font = '30px Arial'; ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20); ctx.font = '20px Arial'; ctx.fillText('Clique para recomeçar', canvas.width / 2, canvas.height / 2 + 70); }

    // ========================================================================
    // LÓGICA PRINCIPAL DO JOGO
    // ========================================================================
    const camera = { x: 0, y: 0, update: function() { if (!player) return; this.x = player.x - canvas.width / 2; this.y = player.y - canvas.height / 2; } };
    function initializeGame(characterType) { let startHealth = 100, startSpeed = 3, startProjectileSpeed = 5, startAttackCooldown = 35, startDamage = 25, startCollectionRadius = 50; switch (characterType) { case 'gladiator': startHealth = 140; startSpeed = 2.8; startAttackCooldown = 40; break; case 'witch': startHealth = 80; startProjectileSpeed = 6; startAttackCooldown = 30; startCollectionRadius = 70; break; case 'ranger': startSpeed = 3.5; startDamage = 20; startAttackCooldown = 30; break; } player = new Player(0, 0); player.maxHealth = startHealth; player.health = startHealth; player.speed = startSpeed; player.projectileSpeed = startProjectileSpeed; player.attackCooldown = startAttackCooldown; player.damage = startDamage; player.collectionRadius = startCollectionRadius; startScreen.classList.add('hidden'); pageFooter.classList.add('hidden'); canvas.classList.remove('hidden'); gameState = 'wave_transition'; backgroundMusic.play(); animate(); }
    function generatePassiveChoices() { const choicePool = []; const ownedSkills = Object.keys(player.skills); const allPossibleSkills = Object.keys(SKILL_DATA); const passiveUpgrades = ['vigor', 'frenesim', 'pressa', 'forca', 'ganancia', 'recuperacao']; passiveUpgrades.forEach(skill => { const currentLevel = player.skills[skill] || 0; if (currentLevel < SKILL_DATA[skill].maxLevel) { const levelText = SKILL_DATA[skill].maxLevel > 1 ? ` (Nível ${currentLevel + 1})` : ''; choicePool.push({ type: 'upgrade', skill: skill, text: `PASSIVA: ${SKILL_DATA[skill].name}${levelText}`, description: SKILL_DATA[skill].description, action: () => { if (!player.skills[skill]) player.skills[skill] = 0; player.skills[skill]++; generatePassiveChoices.actions[skill](); } }); } }); const activeSkills = ['shockwave', 'nova', 'orbitals']; const availableNewSkills = activeSkills.filter(skill => !ownedSkills.includes(skill)); availableNewSkills.forEach(newSkill => { choicePool.push({ type: 'new_skill', skill: newSkill, text: `NOVA: ${SKILL_DATA[newSkill].name}`, description: SKILL_DATA[newSkill].description, action: () => { player.skills[newSkill] = 1; if (newSkill === 'orbitals') { orbitals.push(new Orbital(player, 50, 0)); } } }); }); const upgradeableActiveSkills = activeSkills.filter(skill => ownedSkills.includes(skill) && player.skills[skill] < SKILL_DATA[skill].maxLevel); upgradeableActiveSkills.forEach(skillToUpgrade => { choicePool.push({ type: 'upgrade', skill: skillToUpgrade, text: `UPGRADE: ${SKILL_DATA[skillToUpgrade].name} (Nível ${player.skills[skillToUpgrade] + 1})`, description: SKILL_DATA[skillToUpgrade].description, action: () => { player.skills[skillToUpgrade]++; } }); }); passiveChoiceOptions = choicePool.sort(() => 0.5 - Math.random()).slice(0, 3); }
    generatePassiveChoices.actions = { vigor: () => { player.maxHealth *= 1.15; player.health = player.maxHealth; }, frenesim: () => { player.attackCooldown = Math.max(5, player.attackCooldown * 0.85); }, pressa: () => { player.speed *= 1.12; }, forca: () => { player.damage *= 1.20; }, ganancia: () => { player.collectionRadius *= 1.40; }, recuperacao: () => { player.heal(player.maxHealth * 0.4); } };
    function drawPassiveChoiceScreen() { ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'white'; ctx.font = '40px Cinzel'; ctx.textAlign = 'center'; ctx.fillText('NÍVEL AUMENTADO!', canvas.width / 2, 150); ctx.font = '25px Cinzel'; ctx.fillText('Escolha uma melhoria (Pressione 1, 2 ou 3)', canvas.width / 2, 200); passiveChoiceOptions.forEach((option, index) => { ctx.font = `bold 20px Cinzel`; ctx.fillStyle = option.type === 'new_skill' ? '#d4c19c' : '#8888ff'; ctx.fillText(`${index + 1}: ${option.text}`, canvas.width / 2, 300 + (index * 70)); ctx.font = `16px Arial`; ctx.fillStyle = 'white'; ctx.fillText(option.description, canvas.width / 2, 330 + (index * 70)); }); }
    function startNextWave() { waveNumber++; gameState = 'in_wave'; if (waveNumber % 10 === 0) { const bossXp = 500 + (waveNumber * 20); monsters.push(new Boss(player.x, player.y - 400, bossXp)); monstersRemainingInWave = 1; } else if (waveNumber % 5 === 0) { monstersRemainingInWave = waveNumber * 3 + 2; for (let i = 0; i < monstersRemainingInWave; i++) { setTimeout(() => { let x, y; if (Math.random() < 0.5) { x = Math.random() < 0.5 ? player.x - canvas.width / 2 / zoomLevel - 50 : player.x + canvas.width / 2 / zoomLevel + 50; y = player.y + (Math.random() - 0.5) * (canvas.height / zoomLevel + 100); } else { x = player.x + (Math.random() - 0.5) * (canvas.width / zoomLevel + 100); y = Math.random() < 0.5 ? player.y - canvas.height / 2 / zoomLevel - 50 : player.y + canvas.height / 2 / zoomLevel + 50; } const width = 50, height = 50, speed = 1.25; const health = (50 + (waveNumber * 15)) * 3; const xp = (25 + (waveNumber * 10)) * 3; if (Math.random() < 0.7) { monsters.push(new MeleeMonster(x, y, width, height, speed, health, true, xp)); } else { monsters.push(new RangedMonster(x, y, width, height, speed, health, true, xp)); } }, i * 750); } } else { monstersRemainingInWave = waveNumber * 5 + 5; for (let i = 0; i < monstersRemainingInWave; i++) { setTimeout(() => { let x, y; if (Math.random() < 0.5) { x = Math.random() < 0.5 ? player.x - canvas.width / 2 / zoomLevel - 50 : player.x + canvas.width / 2 / zoomLevel + 50; y = player.y + (Math.random() - 0.5) * (canvas.height / zoomLevel + 100); } else { x = player.x + (Math.random() - 0.5) * (canvas.width / zoomLevel + 100); y = Math.random() < 0.5 ? player.y - canvas.height / 2 / zoomLevel - 50 : player.y + canvas.height / 2 / zoomLevel + 50; } let width = 40, height = 40, speed = 1, health = 50 + (waveNumber * 15), xp = 25 + (waveNumber * 10); let isRare = Math.random() < 0.05; if (isRare) { width *= 1.2; height *= 1.2; speed *= 1.25; health *= 3; xp *= 3; } if (Math.random() < 0.7) { monsters.push(new MeleeMonster(x, y, width, height, speed, health, isRare, xp)); } else { monsters.push(new RangedMonster(x, y, width, height, speed, health, isRare, xp)); } }, i * 750); } } }

    function animate() {
        animationId = requestAnimationFrame(animate);
        if (gameState === 'passive_choice') { drawPassiveChoiceScreen(); return; }
        if (!player) return;
        
        ctx.save();
        if (screenShakeDuration > 0) { const offsetX = (Math.random() - 0.5) * screenShakeIntensity * 2; const offsetY = (Math.random() - 0.5) * screenShakeIntensity * 2; ctx.translate(offsetX, offsetY); decreaseScreenShake(); }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(zoomLevel, zoomLevel);
        ctx.translate(-player.x, -player.y);

        if (assets.backgroundImage.complete && assets.backgroundImage.naturalWidth !== 0) { const tileSize = 200; const startX = Math.floor((player.x - canvas.width / 2 / zoomLevel) / tileSize) * tileSize; const startY = Math.floor((player.y - canvas.height / 2 / zoomLevel) / tileSize) * tileSize; const endX = startX + canvas.width / zoomLevel + tileSize; const endY = startY + canvas.height / zoomLevel + tileSize; for (let y = startY; y < endY; y += tileSize) { for (let x = startX; x < endX; x += tileSize) { ctx.drawImage(assets.backgroundImage, x, y, tileSize, tileSize); } } }
        
        // --- Fase de Desenho (Draw Phase) ---
        lootDrops.forEach(l => l.draw());
        shockwaves.forEach(s => s.draw());
        orbitals.forEach(o => o.draw());
        projectiles.forEach(p => p.draw());
        enemyProjectiles.forEach(p => p.draw());
        monsters.forEach(m => m.draw());
        damageNumbers.forEach(d => d.draw());
        player.draw();
        
        ctx.restore();
        
        const vignetteGradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 100, canvas.width / 2, canvas.height / 2, canvas.width / 2); vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)'); vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.7)'); ctx.fillStyle = vignetteGradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        player.drawHealthBar(); player.drawXpBar();
        ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Score: ' + score, 10, 60); ctx.fillText('Wave: ' + waveNumber, canvas.width - 100, 30);
        if (gameState === 'wave_transition') { waveTransitionTimer--; ctx.font = '30px Cinzel'; ctx.textAlign = 'center'; ctx.fillText(`Próxima onda em: ${Math.ceil(waveTransitionTimer / 60)}`, canvas.width / 2, canvas.height / 2); if (waveTransitionTimer <= 0) { startNextWave(); } return; }

        // --- Fase de Lógica e Atualização (Update Phase) ---
        player.update();
        for (let i = projectiles.length - 1; i >= 0; i--) { projectiles[i].update(); if (projectiles[i].x < player.x - canvas.width / zoomLevel || projectiles[i].x > player.x + canvas.width / zoomLevel || projectiles[i].y < player.y - canvas.height / zoomLevel || projectiles[i].y > player.y + canvas.height / zoomLevel) { projectiles.splice(i, 1); } }
        for (let i = enemyProjectiles.length - 1; i >= 0; i--) { const p = enemyProjectiles[i]; p.update(); const dist = Math.hypot(player.x - p.x, player.y - p.y); if (dist - player.radius - p.radius < 1) { player.health -= 5; triggerScreenShake(15, 4); enemyProjectiles.splice(i, 1); if (player.health <= 0) { triggerGameOver(); return; } } }
        for (let i = lootDrops.length - 1; i >= 0; i--) { const l = lootDrops[i]; l.update(); const dist = Math.hypot(player.x - l.x, player.y - l.y); if (dist - l.radius - player.radius < 1) { if (l.type === 'health') { player.heal(l.healAmount); } else { player.gainXp(l.xpValue); score += l.scoreValue || 100; } playSound('pickup.wav', 0.7); lootDrops.splice(i, 1); } }
        for (let i = damageNumbers.length - 1; i >= 0; i--) { damageNumbers[i].update(); if (damageNumbers[i].lifespan <= 0) { damageNumbers.splice(i, 1); } }
        for (let i = shockwaves.length - 1; i >= 0; i--) { const sw = shockwaves[i]; sw.update(); monsters.forEach(monster => { const dist = Math.hypot(sw.x - monster.x, sw.y - monster.y); if (dist < sw.currentRadius + monster.radius && !sw.monstersHit.includes(monster)) { monster.health -= sw.damage; damageNumbers.push(new DamageText(monster.x, monster.y, Math.floor(sw.damage), '#FFFF99')); sw.monstersHit.push(monster); } }); if (sw.currentRadius >= sw.maxRadius) { shockwaves.splice(i, 1); } }
        orbitals.forEach(orb => { orb.update(); monsters.forEach(monster => { const dist = Math.hypot(orb.x - monster.x, orb.y - monster.y); if (dist < orb.radius + monster.radius && !orb.monstersOnCooldown.has(monster)) { monster.health -= orb.damage; damageNumbers.push(new DamageText(monster.x, monster.y, Math.floor(orb.damage), '#FF99FF')); orb.monstersOnCooldown.set(monster, orb.hitCooldown); } }); });
        
        for (let monsterIndex = monsters.length - 1; monsterIndex >= 0; monsterIndex--) {
            const monster = monsters[monsterIndex];
            if (!monster) continue;
            monster.update();
            const distPlayerMonster = Math.hypot(player.x - monster.x, player.y - monster.y);
            if (distPlayerMonster - monster.radius - player.radius < 1) { player.health -= 10; triggerScreenShake(20, 7); const knockbackAngle = Math.atan2(monster.y - player.y, monster.x - player.x); monster.x += Math.cos(knockbackAngle) * 10; monster.y += Math.sin(knockbackAngle) * 10; if (player.health <= 0) { triggerGameOver(); return; } }
            for (let projIndex = projectiles.length - 1; projIndex >= 0; projIndex--) {
                const projectile = projectiles[projIndex];
                if (!projectile || !monster) continue;
                const dist = Math.hypot(projectile.x - monster.x, projectile.y - monster.y);
                if (dist - monster.radius - projectile.radius < 1) {
                    monster.health -= player.damage;
                    damageNumbers.push(new DamageText(monster.x, monster.y, Math.floor(player.damage)));
                    playSound('hit.wav', 0.5);
                    projectiles.splice(projIndex, 1);
                    if (monster.health <= 0) {
                        if (Math.random() < HEALTH_ORB_DROP_CHANCE) { const healAmount = 25; lootDrops.push(new Loot(monster.x, monster.y, 8, 'red', 0, 0, 'health', healAmount)); } else { const xpFromMonster = monster.xpValue; const scoreFromMonster = monster.scoreValue; lootDrops.push(new Loot(monster.x, monster.y, 7, 'gold', xpFromMonster, scoreFromMonster, 'xp', 0)); }
                        monstersRemainingInWave--;
                        playSound('death.wav', 0.6);
                        monsters.splice(monsterIndex, 1);
                        break;
                    }
                }
            }
        }
        if (monsters.length === 0 && monstersRemainingInWave <= 0 && gameState === 'in_wave') { gameState = 'wave_transition'; waveTransitionTimer = 3 * 60; score += 500 * waveNumber; }
    }

    // ========================================================================
    // LISTENERS DE EVENTOS E INÍCIO DO JOGO
    // ========================================================================
    characterButtons.forEach(button => { button.addEventListener('click', () => { const charType = button.getAttribute('data-char'); initializeGame(charType); }); });
    window.addEventListener('click', (event) => { if (!player) return; if (player.health <= 0) { window.location.reload(); return; } });
    window.addEventListener('keydown', (event) => { if (!player) return; if (gameState === 'passive_choice') { const choiceIndex = parseInt(event.key) - 1; if (passiveChoiceOptions[choiceIndex]) { passiveChoiceOptions[choiceIndex].action(); gameState = 'in_wave'; } return; } switch (event.key.toLowerCase()) { case 'w': keys.w.pressed = true; break; case 'a': keys.a.pressed = true; break; case 's': keys.s.pressed = true; break; case 'd': keys.d.pressed = true; break; } });
    window.addEventListener('keyup', (event) => { switch (event.key.toLowerCase()) { case 'w': keys.w.pressed = false; break; case 'a': keys.a.pressed = false; break; case 's': keys.s.pressed = false; break; case 'd': keys.d.pressed = false; break; } });
    
    loadHighScores();
});