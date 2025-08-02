// ========================================================================
// JOGO.JS - VERSÃO FINAL COM CORREÇÃO DE TIMING (DOMContentLoaded)
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

    const keys = { w: { pressed: false }, a: { pressed: false }, s: { pressed: false }, d: { pressed: false } };

    let player; 

    const projectiles = []; const monsters = []; const enemyProjectiles = []; const lootDrops = []; const shockwaves = []; const orbitals = []; const damageNumbers = [];
    let score = 0; let animationId; let passiveChoiceOptions = [];
    let waveNumber = 0; let monstersRemainingInWave = 0; let waveTransitionTimer = 3 * 60; let gameState = 'start_screen';
    
    let screenShakeDuration = 0;
    let screenShakeIntensity = 0;

    const backgroundImage = new Image();
    backgroundImage.src = 'background.png';
    backgroundImage.onload = () => { loadingMessage.classList.add('hidden'); characterSelection.classList.remove('hidden'); characterButtons.forEach(button => button.disabled = false); };
    backgroundImage.onerror = () => { loadingMessage.innerText = "Erro: Ficheiro 'background.png' não encontrado."; };

    const backgroundMusic = new Audio('assets/background-music.mp3');
    backgroundMusic.loop = true; backgroundMusic.volume = 0.4;

    function playSound(src, volume = 0.5) { const sound = new Audio(`assets/${src}`); sound.volume = volume; sound.play().catch(error => console.error(`Erro ao tocar o som ${src}:`, error)); }

    const SKILL_DATA = { shockwave: { name: 'Onda de Choque', maxLevel: 5, description: "Cria uma explosão em área." }, nova: { name: 'Nova de Projéteis', maxLevel: 5, description: "Dispara projéteis em 360 graus." }, orbitals: { name: 'Orbes Giratórios', maxLevel: 1, description: "Conjura um orbe que o protege." }, vigor: { name: 'Vigor', maxLevel: 5, description: "+20 Vida Máxima" }, frenesim: { name: 'Frenesim', maxLevel: 5, description: "+10% Vel. de Ataque" }, pressa: { name: 'Pressa', maxLevel: 5, description: "+10% Vel. de Movimento" }, forca: { name: 'Força', maxLevel: 5, description: "+10% de Dano" }, ganancia: { name: 'Ganância', maxLevel: 5, description: "+25% Raio de Coleta" } };

    // ========================================================================
    // CLASSES
    // ========================================================================
    class Player { constructor(x, y, radius, color) { this.x = x; this.y = y; this.radius = radius; this.color = color; this.speed = 3; this.maxHealth = 100; this.health = this.maxHealth; this.level = 1; this.xp = 0; this.xpToNextLevel = 100; this.projectileSpeed = 5; this.attackCooldown = 30; this.currentAttackCooldown = 0; this.damage = 25; this.collectionRadius = 50; this.skills = {}; this.skillCooldowns = { shockwave: 480, nova: 600 }; this.currentSkillCooldowns = { shockwave: 0, nova: 0 }; } draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); } drawHealthBar() { ctx.fillStyle = 'red'; ctx.fillRect(10, 10, 200, 20); ctx.fillStyle = 'green'; ctx.fillRect(10, 10, (this.health / this.maxHealth) * 200, 20); ctx.strokeStyle = 'white'; ctx.strokeRect(10, 10, 200, 20); } drawXpBar() { const barWidth = canvas.width - 20; ctx.fillStyle = '#444'; ctx.fillRect(10, canvas.height - 30, barWidth, 20); ctx.fillStyle = '#8a2be2'; ctx.fillRect(10, canvas.height - 30, (this.xp / this.xpToNextLevel) * barWidth, 20); ctx.strokeStyle = 'white'; ctx.strokeRect(10, canvas.height - 30, barWidth, 20); ctx.fillStyle = 'white'; ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.fillText(`LVL ${this.level}`, 40, canvas.height - 15); ctx.fillText(`${Math.floor(this.xp)} / ${this.xpToNextLevel}`, barWidth / 2 + 10, canvas.height - 15); ctx.textAlign = 'left'; } gainXp(amount) { if (gameState !== 'in_wave') return; this.xp += amount; if (this.xp >= this.xpToNextLevel) { this.levelUp(); } } levelUp() { this.level++; this.xp -= this.xpToNextLevel; this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5); gameState = 'passive_choice'; playSound('levelup.wav', 0.8); generatePassiveChoices(); } update() { if (keys.w.pressed && this.y - this.radius > 0) { this.y -= this.speed; } if (keys.s.pressed && this.y + this.radius < canvas.height) { this.y += this.speed; } if (keys.a.pressed && this.x - this.radius > 0) { this.x -= this.speed; } if (keys.d.pressed && this.x + this.radius < canvas.width) { this.x += this.speed; } this.currentAttackCooldown--; if (this.currentAttackCooldown <= 0) { this.performBasicAttack(); this.currentAttackCooldown = this.attackCooldown; } this.updateSkillCooldowns(); } performBasicAttack() { let closestEnemy = null; let minDistance = Infinity; const aimingRange = 300; monsters.forEach(monster => { const distance = Math.hypot(this.x - monster.x, this.y - monster.y); if (distance < aimingRange && distance < minDistance) { closestEnemy = monster; minDistance = distance; } }); if (closestEnemy) { const angle = Math.atan2(closestEnemy.y - this.y, closestEnemy.x - this.x); const velocity = { x: Math.cos(angle) * this.projectileSpeed, y: Math.sin(angle) * this.projectileSpeed }; projectiles.push(new Projectile(this.x, this.y, 5, 'white', velocity)); playSound('shoot.wav', 0.3); } } updateSkillCooldowns() { for (const skill in this.currentSkillCooldowns) { if (this.skills[skill]) { if (this.currentSkillCooldowns[skill] > 0) { this.currentSkillCooldowns[skill]--; } else { if (skill === 'shockwave') this.performShockwave(); if (skill === 'nova') this.performNova(); this.currentSkillCooldowns[skill] = this.skillCooldowns[skill]; } } } } performShockwave() { const level = this.skills.shockwave || 1; const radius = 100 + (level * 20); const damage = 40 + (level * 10); shockwaves.push(new Shockwave(this.x, this.y, radius, damage)); } performNova() { const level = this.skills.nova || 1; const projectileCount = 8 + (level * 2); const angleIncrement = (Math.PI * 2) / projectileCount; for (let i = 0; i < projectileCount; i++) { const angle = i * angleIncrement; const velocity = { x: Math.cos(angle) * 3, y: Math.sin(angle) * 3 }; projectiles.push(new Projectile(this.x, this.y, 6, 'lightblue', velocity)); } } }
    class Projectile { constructor(x, y, radius, color, velocity) { this.x = x; this.y = y; this.radius = radius; this.color = color; this.velocity = velocity; } draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); } update() { this.draw(); this.x = this.x + this.velocity.x; this.y = this.y + this.velocity.y; } }
    class Loot { constructor(x, y, radius, color, xpValue, scoreValue) { this.x = x; this.y = y; this.radius = radius; this.color = color; this.xpValue = xpValue; this.scoreValue = scoreValue; } draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); } update() { const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y); if (distToPlayer < player.collectionRadius) { const angle = Math.atan2(player.y - this.y, player.x - this.x); const speed = Math.max(5, (player.collectionRadius - distToPlayer) * 0.1); this.x += Math.cos(angle) * speed; this.y += Math.sin(angle) * speed; } this.draw(); } }
    class Monster { constructor(x, y, radius, color, speed, health) { this.x = x; this.y = y; this.radius = radius; this.color = color; this.speed = speed; this.velocity = { x: 0, y: 0 }; this.maxHealth = health; this.health = health; this.xpValue = 25; this.scoreValue = 100;} draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); ctx.strokeStyle = 'black'; ctx.stroke(); } drawHealthBar() { if(this.health < this.maxHealth) { const barWidth = this.radius * 2; const barHeight = 5; const yOffset = this.y - this.radius - 10; ctx.fillStyle = '#333'; ctx.fillRect(this.x - this.radius, yOffset, barWidth, barHeight); ctx.fillStyle = 'red'; ctx.fillRect(this.x - this.radius, yOffset, barWidth * (this.health / this.maxHealth), barHeight); } } update() { this.draw(); this.drawHealthBar(); const angle = Math.atan2(player.y - this.y, player.x - this.x); this.velocity.x = Math.cos(angle) * this.speed; this.velocity.y = Math.sin(angle) * this.speed; this.x += this.velocity.x; this.y += this.velocity.y; } }
    class MeleeMonster extends Monster { constructor(x, y, radius, color, speed, health) { super(x, y, radius, color, speed, health); } }
    class RangedMonster extends Monster { constructor(x, y, radius, color, speed, health) { super(x, y, radius, color, speed, health); this.shootCooldown = 120; } update() { this.draw(); this.drawHealthBar(); const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y); if (distToPlayer > 300) { const angle = Math.atan2(player.y - this.y, player.x - this.x); this.velocity.x = Math.cos(angle) * this.speed; this.velocity.y = Math.sin(angle) * this.speed; this.x += this.velocity.x; this.y += this.velocity.y; } this.shootCooldown--; if (this.shootCooldown <= 0) { const angle = Math.atan2(player.y - this.y, player.x - this.x); const projectileSpeed = 4; const velocity = { x: Math.cos(angle) * projectileSpeed, y: Math.sin(angle) * projectileSpeed }; enemyProjectiles.push(new Projectile(this.x, this.y, 5, 'orange', velocity)); this.shootCooldown = 120; } } }
    class Shockwave { constructor(x, y, maxRadius, damage) { this.x = x; this.y = y; this.maxRadius = maxRadius; this.damage = damage; this.currentRadius = 10; this.speed = 5; this.monstersHit = []; } update() { this.currentRadius += this.speed; this.draw(); } draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.currentRadius, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255, 255, 0, ${1 - this.currentRadius / this.maxRadius})`; ctx.lineWidth = 5; ctx.stroke(); } }
    class Orbital { constructor(player, distance, angleOffset) { this.player = player; this.distance = distance; this.angle = angleOffset; this.radius = 8; this.color = 'magenta'; this.damage = 10; this.rotationSpeed = 0.05; this.hitCooldown = 30; this.monstersOnCooldown = new Map(); } update() { this.angle += this.rotationSpeed; this.x = this.player.x + Math.cos(this.angle) * this.distance; this.y = this.player.y + Math.sin(this.angle) * this.distance; this.monstersOnCooldown.forEach((cooldown, monster) => { if (cooldown > 0) { this.monstersOnCooldown.set(monster, cooldown - 1); } else { this.monstersOnCooldown.delete(monster); } }); this.draw(); } draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill(); ctx.strokeStyle = 'white'; ctx.stroke(); } }
    class Boss extends RangedMonster { constructor(x, y) { const radius = 50; const color = '#6a0dad'; const speed = 0.8; const health = 1000 + (waveNumber * 100); super(x, y, radius, color, speed, health); this.shootCooldown = 90; this.xpValue = 500; this.scoreValue = 2000; } update() { const angle = Math.atan2(player.y - this.y, player.x - this.x); this.velocity.x = Math.cos(angle) * this.speed; this.velocity.y = Math.sin(angle) * this.speed; this.x += this.velocity.x; this.y += this.velocity.y; this.shootCooldown--; if (this.shootCooldown <= 0) { const projectileCount = 16; const angleIncrement = (Math.PI * 2) / projectileCount; for (let i = 0; i < projectileCount; i++) { const projAngle = i * angleIncrement; const velocity = { x: Math.cos(projAngle) * 3, y: Math.sin(projAngle) * 3 }; enemyProjectiles.push(new Projectile(this.x, this.y, 8, 'red', velocity)); } this.shootCooldown = 90; } this.draw(); this.drawHealthBar(); } }
    class DamageText { constructor(x, y, text, color = 'white') { this.x = x; this.y = y; this.text = text; this.color = color; this.alpha = 1; this.velocity = -0.5; this.lifespan = 60; } update() { this.y += this.velocity; this.lifespan--; if (this.lifespan < 30) { this.alpha -= 1 / 30; } this.draw(); } draw() { ctx.save(); ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText(this.text, this.x, this.y); ctx.restore(); } }

    // ========================================================================
    // FUNÇÕES DE GESTÃO DE JOGO E RECORDES
    // ========================================================================
    function saveHighScores() { const currentHighScore = parseInt(localStorage.getItem('highScore')) || 0; const currentHighWave = parseInt(localStorage.getItem('highWave')) || 0; if (score > currentHighScore) { localStorage.setItem('highScore', score); } if (waveNumber > currentHighWave) { localStorage.setItem('highWave', waveNumber); } }
    function loadHighScores() { const highScore = parseInt(localStorage.getItem('highScore')) || 0; const highWave = parseInt(localStorage.getItem('highWave')) || 0; highScoreValueEl.innerText = highScore; highWaveValueEl.innerText = highWave; }
    function triggerGameOver() { saveHighScores(); cancelAnimationFrame(animationId); backgroundMusic.pause(); backgroundMusic.currentTime = 0; ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'white'; ctx.font = '50px Cinzel'; ctx.textAlign = 'center'; ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40); ctx.font = '30px Arial'; ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20); ctx.font = '20px Arial'; ctx.fillText('Clique para recomeçar', canvas.width / 2, canvas.height / 2 + 70); }
    function triggerScreenShake(duration, intensity) { screenShakeDuration = duration; screenShakeIntensity = intensity; }

    // ========================================================================
    // LÓGICA PRINCIPAL DO JOGO
    // ========================================================================
    function initializeGame(characterType) { let startHealth = 100, startSpeed = 3, startProjectileSpeed = 5, startAttackCooldown = 35, startDamage = 25, startCollectionRadius = 50; switch (characterType) { case 'gladiator': startHealth = 140; startSpeed = 2.8; startAttackCooldown = 40; break; case 'witch': startHealth = 80; startProjectileSpeed = 6; startAttackCooldown = 30; startCollectionRadius = 70; break; case 'ranger': startSpeed = 3.5; startDamage = 20; startAttackCooldown = 30; break; } player = new Player(canvas.width / 2, canvas.height / 2, 15, 'cyan'); player.maxHealth = startHealth; player.health = startHealth; player.speed = startSpeed; player.projectileSpeed = startProjectileSpeed; player.attackCooldown = startAttackCooldown; player.damage = startDamage; player.collectionRadius = startCollectionRadius; startScreen.classList.add('hidden'); pageFooter.classList.add('hidden'); canvas.classList.remove('hidden'); gameState = 'wave_transition'; backgroundMusic.play(); animate(); }
    function generatePassiveChoices() { const choicePool = []; const ownedSkills = Object.keys(player.skills); const allPossibleSkills = Object.keys(SKILL_DATA); const passiveUpgrades = ['vigor', 'frenesim', 'pressa', 'forca', 'ganancia']; passiveUpgrades.forEach(skill => { const currentLevel = player.skills[skill] || 0; if (currentLevel < SKILL_DATA[skill].maxLevel) { const levelText = ` (Nível ${currentLevel + 1})`; choicePool.push({ type: 'upgrade', skill: skill, text: `PASSIVA: ${SKILL_DATA[skill].name}${levelText}`, description: SKILL_DATA[skill].description, action: () => { if (!player.skills[skill]) player.skills[skill] = 0; player.skills[skill]++; generatePassiveChoices.actions[skill](); } }); } }); const activeSkills = ['shockwave', 'nova', 'orbitals']; const availableNewSkills = activeSkills.filter(skill => !ownedSkills.includes(skill)); availableNewSkills.forEach(newSkill => { choicePool.push({ type: 'new_skill', skill: newSkill, text: `NOVA: ${SKILL_DATA[newSkill].name}`, description: SKILL_DATA[newSkill].description, action: () => { player.skills[newSkill] = 1; if (newSkill === 'orbitals') { orbitals.push(new Orbital(player, 50, 0)); } } }); }); const upgradeableActiveSkills = activeSkills.filter(skill => ownedSkills.includes(skill) && player.skills[skill] < SKILL_DATA[skill].maxLevel); upgradeableActiveSkills.forEach(skillToUpgrade => { choicePool.push({ type: 'upgrade', skill: skillToUpgrade, text: `UPGRADE: ${SKILL_DATA[skillToUpgrade].name} (Nível ${player.skills[skillToUpgrade] + 1})`, description: SKILL_DATA[skillToUpgrade].description, action: () => { player.skills[skillToUpgrade]++; } }); }); passiveChoiceOptions = choicePool.sort(() => 0.5 - Math.random()).slice(0, 3); }
    generatePassiveChoices.actions = { vigor: () => { player.maxHealth += 20; player.health += 20; }, frenesim: () => { player.attackCooldown = Math.max(5, player.attackCooldown * 0.9); }, pressa: () => { player.speed *= 1.1; }, forca: () => { player.damage *= 1.1; }, ganancia: () => { player.collectionRadius *= 1.25; } };
    function drawPassiveChoiceScreen() { ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'white'; ctx.font = '40px Cinzel'; ctx.textAlign = 'center'; ctx.fillText('NÍVEL AUMENTADO!', canvas.width / 2, 150); ctx.font = '25px Cinzel'; ctx.fillText('Escolha uma melhoria (Pressione 1, 2 ou 3)', canvas.width / 2, 200); passiveChoiceOptions.forEach((option, index) => { ctx.font = `bold 20px Cinzel`; ctx.fillStyle = option.type === 'new_skill' ? '#d4c19c' : '#8888ff'; ctx.fillText(`${index + 1}: ${option.text}`, canvas.width / 2, 300 + (index * 70)); ctx.font = `16px Arial`; ctx.fillStyle = 'white'; ctx.fillText(option.description, canvas.width / 2, 330 + (index * 70)); }); }
    function startNextWave() { waveNumber++; gameState = 'in_wave'; if (waveNumber % 10 === 0) { monstersRemainingInWave = 1; monsters.push(new Boss(canvas.width / 2, -100)); } else if (waveNumber % 5 === 0) { monstersRemainingInWave = waveNumber * 2 + 1; for (let i = 0; i < monstersRemainingInWave; i++) { setTimeout(() => { let x = Math.random() < 0.5 ? 0 - 30 : canvas.width + 30; let y = Math.random() < 0.5 ? 0 - 30 : canvas.height + 30; let radius = 30; let color = 'yellow'; let speed = 1.25; let health = (50 + (waveNumber * 10)) * 3; if (Math.random() < 0.7) { monsters.push(new MeleeMonster(x, y, radius, color, speed, health)); } else { monsters.push(new RangedMonster(x, y, radius, color, speed, health)); } }, i * 1000); } } else { monstersRemainingInWave = waveNumber * 3 + 2; for (let i = 0; i < monstersRemainingInWave; i++) { setTimeout(() => { let x = Math.random() < 0.5 ? 0 - 30 : canvas.width + 30; let y = Math.random() < 0.5 ? 0 - 30 : canvas.height + 30; let radius = 15, color = 'red', speed = 1; let health = 50 + (waveNumber * 10); const isRare = Math.random() < 0.05; if (isRare) { radius = 30; color = 'yellow'; speed *= 1.25; health *= 3; } if (Math.random() < 0.7) { monsters.push(new MeleeMonster(x, y, radius, color, speed, health)); } else { if (!isRare) color = '#ff8c00'; monsters.push(new RangedMonster(x, y, radius, color, speed, health)); } }, i * 1000); } } }

    function animate() {
        animationId = requestAnimationFrame(animate);
        if (gameState === 'passive_choice') { drawPassiveChoiceScreen(); return; }
        if (!player) return;
        
        ctx.save();
        if (screenShakeDuration > 0) {
            const offsetX = (Math.random() - 0.5) * screenShakeIntensity * 2;
            const offsetY = (Math.random() - 0.5) * screenShakeIntensity * 2;
            ctx.translate(offsetX, offsetY);
            screenShakeDuration--;
        } else {
            screenShakeIntensity = 0;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (backgroundImage.complete && backgroundImage.naturalWidth !== 0) { const tileSize = 200; for (let y = 0; y < canvas.height; y += tileSize) { for (let x = 0; x < canvas.width; x += tileSize) { ctx.drawImage(backgroundImage, x, y, tileSize, tileSize); } } }
        const vignetteGradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width / 4, canvas.width / 2, canvas.height / 2, canvas.width); vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)'); vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.7)'); ctx.fillStyle = vignetteGradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
        player.update(); player.draw(); player.drawHealthBar(); player.drawXpBar();
        ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Score: ' + score, 10, 60);
        ctx.fillText('Wave: ' + waveNumber, canvas.width - 100, 30);
        if (gameState === 'wave_transition') { waveTransitionTimer--; ctx.font = '30px Cinzel'; ctx.textAlign = 'center'; ctx.fillText(`Próxima onda em: ${Math.ceil(waveTransitionTimer / 60)}`, canvas.width / 2, canvas.height / 2); if (waveTransitionTimer <= 0) { startNextWave(); } ctx.restore(); return; }
        for (let i = damageNumbers.length - 1; i >= 0; i--) { const damageText = damageNumbers[i]; damageText.update(); if (damageText.lifespan <= 0) { damageNumbers.splice(i, 1); } }
        shockwaves.forEach((sw, index) => { sw.update(); monsters.forEach(monster => { const dist = Math.hypot(sw.x - monster.x, sw.y - monster.y); if (dist < sw.currentRadius && !sw.monstersHit.includes(monster)) { monster.health -= sw.damage; damageNumbers.push(new DamageText(monster.x, monster.y, Math.floor(sw.damage), '#FFFF99')); sw.monstersHit.push(monster); } }); if (sw.currentRadius >= sw.maxRadius) { shockwaves.splice(index, 1); } });
        orbitals.forEach(orb => { orb.update(); monsters.forEach(monster => { const dist = Math.hypot(orb.x - monster.x, orb.y - monster.y); if (dist < orb.radius + monster.radius && !orb.monstersOnCooldown.has(monster)) { monster.health -= orb.damage; damageNumbers.push(new DamageText(monster.x, monster.y, Math.floor(orb.damage), '#FF99FF')); orb.monstersOnCooldown.set(monster, orb.hitCooldown); } }); });
        lootDrops.forEach((loot, lootIndex) => { loot.update(); const dist = Math.hypot(player.x - loot.x, player.y - loot.y); if (dist - loot.radius - player.radius < 1) { player.gainXp(loot.xpValue); score += loot.scoreValue || 100; lootDrops.splice(lootIndex, 1); playSound('pickup.wav', 0.7); } });
        projectiles.forEach((projectile, projIndex) => { projectile.update(); if (projectile.x + projectile.radius < 0 || projectile.x - projectile.radius > canvas.width || projectile.y + projectile.radius < 0 || projectile.y - projectile.radius > canvas.height) { projectiles.splice(projIndex, 1); } });
        enemyProjectiles.forEach((enemyProj, index) => { enemyProj.update(); if (enemyProj.x + enemyProj.radius < 0 || enemyProj.x - enemyProj.radius > canvas.width || enemyProj.y - enemyProj.radius < 0 || enemyProj.y - enemyProj.radius > canvas.height) { setTimeout(() => { enemyProjectiles.splice(index, 1); }, 0); } const dist = Math.hypot(player.x - enemyProj.x, player.y - enemyProj.y); if (dist - player.radius - enemyProj.radius < 1) { player.health -= 5; triggerScreenShake(15, 4); enemyProjectiles.splice(index, 1); if (player.health <= 0) { triggerGameOver(); ctx.restore(); return; } } });
        monsters.forEach((monster, monsterIndex) => {
            monster.update();
            const distPlayerMonster = Math.hypot(player.x - monster.x, player.y - monster.y);
            if (distPlayerMonster - monster.radius - player.radius < 1) {
                player.health -= 15;
                triggerScreenShake(20, 7);
                const knockbackAngle = Math.atan2(monster.y - player.y, monster.x - player.x);
                const knockbackDistance = 10;
                monster.x += Math.cos(knockbackAngle) * knockbackDistance;
                monster.y += Math.sin(knockbackAngle) * knockbackDistance;
                if (player.health <= 0) { triggerGameOver(); ctx.restore(); return; }
            }
            projectiles.forEach((projectile, projIndex) => {
                const dist = Math.hypot(projectile.x - monster.x, projectile.y - monster.y);
                if (dist - monster.radius - projectile.radius < 1) {
                    monster.health -= player.damage;
                    damageNumbers.push(new DamageText(monster.x, monster.y, Math.floor(player.damage)));
                    playSound('hit.wav', 0.5);
                    projectiles.splice(projIndex, 1);
                    if (monster.health <= 0) {
                        const xpFromMonster = monster.xpValue || ((monster.color === 'yellow') ? 75 : 25);
                        const scoreFromMonster = monster.scoreValue || 100;
                        lootDrops.push(new Loot(monster.x, monster.y, 7, 'gold', xpFromMonster, scoreFromMonster));
                        monstersRemainingInWave--;
                        playSound('death.wav', 0.6);
                        setTimeout(() => {
                            monsters.splice(monsterIndex, 1);
                        }, 0);
                    }
                }
            });
        });
        if (monsters.length === 0 && monstersRemainingInWave <= 0 && gameState === 'in_wave') { gameState = 'wave_transition'; waveTransitionTimer = 3 * 60; score += 500 * waveNumber; }

        ctx.restore();
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