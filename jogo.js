// ========================================================================
// JOGO.JS - VERSÃO COMPLETA COM FUNDO DO CANVAS CORRIGIDO
// ========================================================================

// --- CONFIGURAÇÃO INICIAL (SETUP) ---
const canvas = document.getElementById('gameCanvas');
const startScreen = document.getElementById('start-screen');
const characterSelection = document.getElementById('character-selection');
const loadingMessage = document.getElementById('loading-message');
const characterButtons = document.querySelectorAll('.character-card button');
const ctx = canvas.getContext('2d');

const keys = { w: { pressed: false }, a: { pressed: false }, s: { pressed: false }, d: { pressed: false } };

let player; 

const projectiles = [];
const monsters = [];
const enemyProjectiles = [];
const lootDrops = [];
let score = 0;
let animationId;
let passiveChoiceOptions = [];

let waveNumber = 0;
let monstersRemainingInWave = 0;
let waveTransitionTimer = 3 * 60;
let gameState = 'start_screen';

// Carregamento da imagem de fundo
const backgroundImage = new Image();
backgroundImage.src = 'background.png'; // O nome do seu ficheiro

backgroundImage.onload = () => {
    // Apenas esconde a mensagem de "loading" e mostra os personagens.
    // O padrão não é mais criado aqui.
    loadingMessage.classList.add('hidden');
    characterSelection.classList.remove('hidden');
    characterButtons.forEach(button => button.disabled = false);
};

backgroundImage.onerror = () => {
    loadingMessage.innerText = "Erro: Ficheiro 'background.png' não encontrado. Verifique se está na pasta correta.";
};

// ========================================================================
// CLASSES
// ========================================================================

class Player {
    constructor(x, y, radius, color) {
        this.x = x; this.y = y; this.radius = radius; this.color = color; this.speed = 3;
        this.maxHealth = 100; this.health = this.maxHealth;
        this.level = 1; this.xp = 0; this.xpToNextLevel = 100;
        this.projectileSpeed = 5; this.attackCooldown = 30; this.currentAttackCooldown = 0;
        this.damage = 25; this.collectionRadius = 50;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color; ctx.fill();
    }
    drawHealthBar() {
        ctx.fillStyle = 'red'; ctx.fillRect(10, 10, 200, 20);
        ctx.fillStyle = 'green'; ctx.fillRect(10, 10, (this.health / this.maxHealth) * 200, 20);
        ctx.strokeStyle = 'white'; ctx.strokeRect(10, 10, 200, 20);
    }
    drawXpBar() {
        const barWidth = canvas.width - 20;
        ctx.fillStyle = '#444'; ctx.fillRect(10, canvas.height - 30, barWidth, 20);
        ctx.fillStyle = '#8a2be2'; ctx.fillRect(10, canvas.height - 30, (this.xp / this.xpToNextLevel) * barWidth, 20);
        ctx.strokeStyle = 'white'; ctx.strokeRect(10, canvas.height - 30, barWidth, 20);
        ctx.fillStyle = 'white'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
        ctx.fillText(`LVL ${this.level}`, 40, canvas.height - 15);
        ctx.fillText(`${Math.floor(this.xp)} / ${this.xpToNextLevel}`, barWidth / 2 + 10, canvas.height - 15);
        ctx.textAlign = 'left';
    }
    gainXp(amount) {
        if (gameState !== 'in_wave') return;
        this.xp += amount;
        if (this.xp >= this.xpToNextLevel) { this.levelUp(); }
    }
    levelUp() {
        this.level++; this.xp -= this.xpToNextLevel;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
        gameState = 'passive_choice';
        generatePassiveChoices();
    }
    update() {
        if (keys.w.pressed && this.y - this.radius > 0) { this.y -= this.speed; }
        if (keys.s.pressed && this.y + this.radius < canvas.height) { this.y += this.speed; }
        if (keys.a.pressed && this.x - this.radius > 0) { this.x -= this.speed; }
        if (keys.d.pressed && this.x + this.radius < canvas.width) { this.x += this.speed; }
        if (this.currentAttackCooldown > 0) { this.currentAttackCooldown--; }
    }
}

class Projectile {
    constructor(x, y, radius, color, velocity) {
        this.x = x; this.y = y; this.radius = radius; this.color = color;
        this.velocity = velocity;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color; ctx.fill();
    }
    update() {
        this.draw();
        this.x = this.x + this.velocity.x;
        this.y = this.y + this.velocity.y;
    }
}

class Loot {
    constructor(x, y, radius, color, xpValue) {
        this.x = x; this.y = y; this.radius = radius; this.color = color;
        this.xpValue = xpValue;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color; ctx.fill();
    }
    update() {
        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        if (distToPlayer < player.collectionRadius) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            const speed = Math.max(5, (player.collectionRadius - distToPlayer) * 0.1); 
            this.x += Math.cos(angle) * speed;
            this.y += Math.sin(angle) * speed;
        }
        this.draw();
    }
}

class Monster {
    constructor(x, y, radius, color, speed, health) {
        this.x = x; this.y = y; this.radius = radius; this.color = color;
        this.speed = speed; this.velocity = { x: 0, y: 0 };
        this.maxHealth = health; this.health = health;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color; ctx.fill();
        ctx.strokeStyle = 'black'; ctx.stroke();
    }
    drawHealthBar() {
        if(this.health < this.maxHealth) {
            const barWidth = this.radius * 2;
            const barHeight = 5;
            const yOffset = this.y - this.radius - 10;
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x - this.radius, yOffset, barWidth, barHeight);
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x - this.radius, yOffset, barWidth * (this.health / this.maxHealth), barHeight);
        }
    }
    update() {
        this.draw(); this.drawHealthBar();
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.velocity.x = Math.cos(angle) * this.speed;
        this.velocity.y = Math.sin(angle) * this.speed;
        this.x += this.velocity.x; this.y += this.velocity.y;
    }
}

class MeleeMonster extends Monster {
    constructor(x, y, radius, color, speed, health) {
        super(x, y, radius, color, speed, health);
    }
}

class RangedMonster extends Monster {
    constructor(x, y, radius, color, speed, health) {
        super(x, y, radius, color, speed, health);
        this.shootCooldown = 120;
    }
    update() {
        this.draw(); this.drawHealthBar();
        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        if (distToPlayer > 300) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.velocity.x = Math.cos(angle) * this.speed;
            this.velocity.y = Math.sin(angle) * this.speed;
            this.x += this.velocity.x; this.y += this.velocity.y;
        }
        this.shootCooldown--;
        if (this.shootCooldown <= 0) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            const projectileSpeed = 4;
            const velocity = { x: Math.cos(angle) * projectileSpeed, y: Math.sin(angle) * projectileSpeed };
            enemyProjectiles.push(new Projectile(this.x, this.y, 5, 'orange', velocity));
            this.shootCooldown = 120;
        }
    }
}

// ========================================================================
// LÓGICA PRINCIPAL DO JOGO
// ========================================================================

function initializeGame(characterType) {
    let startHealth = 100, startSpeed = 3, startProjectileSpeed = 5, startAttackCooldown = 30, startDamage = 25, startCollectionRadius = 50;
    switch (characterType) {
        case 'gladiator':
            startHealth = 140; startSpeed = 2.8; break;
        case 'witch':
            startHealth = 80; startProjectileSpeed = 6; startAttackCooldown = 25; startCollectionRadius = 70; break;
        case 'ranger':
            startSpeed = 3.5; startDamage = 20; break;
    }
    player = new Player(canvas.width / 2, canvas.height / 2, 15, 'cyan');
    player.maxHealth = startHealth; player.health = startHealth;
    player.speed = startSpeed; player.projectileSpeed = startProjectileSpeed;
    player.attackCooldown = startAttackCooldown; player.damage = startDamage;
    player.collectionRadius = startCollectionRadius;
    startScreen.classList.add('hidden');
    canvas.classList.remove('hidden');
    gameState = 'wave_transition';
    animate();
}

function generatePassiveChoices() {
    const allPassives = [
        { text: 'Vigor (+20 Vida Máxima)', action: () => { player.maxHealth += 20; player.health += 20; } },
        { text: 'Frenesim (+10% Velocidade de Ataque)', action: () => { player.attackCooldown = Math.max(5, player.attackCooldown * 0.9); } },
        { text: 'Pressa (+10% Velocidade de Movimento)', action: () => { player.speed *= 1.1; } },
        { text: 'Força (+10% de Dano)', action: () => { player.damage *= 1.1; } },
        { text: 'Recuperação (Cura 50 de vida)', action: () => { player.health = Math.min(player.maxHealth, player.health + 50); } },
        { text: 'Ganância (+25% Raio de Coleta)', action: () => { player.collectionRadius *= 1.25; } }
    ];
    passiveChoiceOptions = allPassives.sort(() => 0.5 - Math.random()).slice(0, 3);
}

function drawPassiveChoiceScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white'; ctx.font = '40px Arial'; ctx.textAlign = 'center';
    ctx.fillText('NÍVEL AUMENTADO!', canvas.width / 2, 150);
    ctx.font = '25px Arial';
    ctx.fillText('Escolha uma melhoria (Pressione 1, 2 ou 3)', canvas.width / 2, 200);
    ctx.font = '20px Arial';
    passiveChoiceOptions.forEach((option, index) => {
        ctx.fillText(`${index + 1}: ${option.text}`, canvas.width / 2, 300 + (index * 50));
    });
}

function startNextWave() {
    waveNumber++;
    gameState = 'in_wave';
    monstersRemainingInWave = waveNumber * 3 + 2;
    for (let i = 0; i < monstersRemainingInWave; i++) {
        setTimeout(() => {
            let x = Math.random() < 0.5 ? 0 - 30 : canvas.width + 30;
            let y = Math.random() < 0.5 ? 0 - 30 : canvas.height + 30;
            let radius = 15, color = 'red', speed = 1;
            let health = 50 + (waveNumber * 10);
            const isRare = Math.random() < 0.05; 
            if (isRare) {
                radius = 30; color = 'yellow'; speed *= 1.25; health *= 3;
            }
            if (Math.random() < 0.7) {
                monsters.push(new MeleeMonster(x, y, radius, color, speed, health));
            } else {
                if (!isRare) color = '#ff8c00';
                monsters.push(new RangedMonster(x, y, radius, color, speed, health));
            }
        }, i * 1000);
    }
}

function animate() {
    animationId = requestAnimationFrame(animate);
    if (gameState === 'passive_choice') { drawPassiveChoiceScreen(); return; }
    if (!player) return;

    // --- NOVO DESENHO DO FUNDO ---
    // 1. Limpa completamente o canvas para remover rastros
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 2. Desenha a textura em azulejos maiores e repetidos
    if (backgroundImage.complete) { // Garante que a imagem já carregou
        const tileSize = 200; // Define o tamanho de cada "azulejo" da textura
        for (let y = 0; y < canvas.height; y += tileSize) {
            for (let x = 0; x < canvas.width; x += tileSize) {
                ctx.drawImage(backgroundImage, x, y, tileSize, tileSize);
            }
        }
    }

    // 3. Desenha a vinheta por cima para dar atmosfera
    const vignetteGradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width / 4, canvas.width / 2, canvas.height / 2, canvas.width);
    vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vignetteGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // --- FIM DO NOVO DESENHO DO FUNDO ---

    player.update();
    player.draw();
    player.drawHealthBar();
    player.drawXpBar();
    ctx.fillStyle = 'white'; ctx.font = '20px Arial'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 10, 60);
    ctx.fillText('Wave: ' + waveNumber, canvas.width - 100, 30);

    if (gameState === 'wave_transition') {
        waveTransitionTimer--;
        ctx.font = '30px Arial'; ctx.textAlign = 'center';
        ctx.fillText(`Próxima onda em: ${Math.ceil(waveTransitionTimer / 60)}`, canvas.width / 2, canvas.height / 2);
        if (waveTransitionTimer <= 0) { startNextWave(); }
        return;
    }
    
    // O resto da lógica do jogo continua aqui...
    lootDrops.forEach((loot, lootIndex) => {
        loot.update();
        const dist = Math.hypot(player.x - loot.x, player.y - loot.y);
        if (dist - loot.radius - player.radius < 1) {
            player.gainXp(loot.xpValue);
            score += 100;
            lootDrops.splice(lootIndex, 1);
        }
    });

    projectiles.forEach((projectile, projIndex) => {
        projectile.update();
        if (projectile.x + projectile.radius < 0 ||
            projectile.x - projectile.radius > canvas.width ||
            projectile.y + projectile.radius < 0 ||
            projectile.y - projectile.radius > canvas.height) {
            projectiles.splice(projIndex, 1);
        }
    });

    enemyProjectiles.forEach((enemyProj, index) => {
        enemyProj.update();
        if (enemyProj.x + enemyProj.radius < 0 ||
            enemyProj.x - enemyProj.radius > canvas.width ||
            enemyProj.y - enemyProj.radius < 0 ||
            enemyProj.y - enemyProj.radius > canvas.height) {
            setTimeout(() => { enemyProjectiles.splice(index, 1); }, 0);
        }
        const dist = Math.hypot(player.x - enemyProj.x, player.y - enemyProj.y);
        if (dist - player.radius - enemyProj.radius < 1) {
            player.health -= 5;
            enemyProjectiles.splice(index, 1);
            if (player.health <= 0) {
                player.health = 0;
                cancelAnimationFrame(animationId);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white'; ctx.font = '50px Arial'; ctx.textAlign = 'center';
                ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);
                ctx.font = '30px Arial';
                ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
                ctx.font = '20px Arial';
                ctx.fillText('Clique para recomeçar', canvas.width / 2, canvas.height / 2 + 70);
                return;
            }
        }
    });

    monsters.forEach((monster, monsterIndex) => {
        monster.update();
        const distPlayerMonster = Math.hypot(player.x - monster.x, player.y - monster.y);
        if (distPlayerMonster - monster.radius - player.radius < 1) {
            player.health -= 15;
            monsters.splice(monsterIndex, 1);
            monstersRemainingInWave--;
            if (player.health <= 0) {
                player.health = 0;
                cancelAnimationFrame(animationId);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white'; ctx.font = '50px Arial'; ctx.textAlign = 'center';
                ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);
                ctx.font = '30px Arial';
                ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
                ctx.font = '20px Arial';
                ctx.fillText('Clique para recomeçar', canvas.width / 2, canvas.height / 2 + 70);
                return;
            }
        }
        projectiles.forEach((projectile, projIndex) => {
            const dist = Math.hypot(projectile.x - monster.x, projectile.y - monster.y);
            if (dist - monster.radius - projectile.radius < 1) {
                monster.health -= player.damage;
                projectiles.splice(projIndex, 1);
                if (monster.health <= 0) {
                    const xpFromMonster = (monster.color === 'yellow') ? 75 : 25;
                    lootDrops.push(new Loot(monster.x, monster.y, 7, 'gold', xpFromMonster));
                    monstersRemainingInWave--;
                    setTimeout(() => {
                        monsters.splice(monsterIndex, 1);
                    }, 0);
                }
            }
        });
    });

    if (monsters.length === 0 && monstersRemainingInWave <= 0 && gameState === 'in_wave') {
        gameState = 'wave_transition';
        waveTransitionTimer = 3 * 60;
        score += 500 * waveNumber;
    }
}

// ========================================================================
// LISTENERS DE EVENTOS E INÍCIO DO JOGO
// ========================================================================
characterButtons.forEach(button => {
    button.addEventListener('click', () => {
        const charType = button.getAttribute('data-char');
        initializeGame(charType);
    });
});

window.addEventListener('click', (event) => {
    if (!player) return;
    if (player.health <= 0) { window.location.reload(); return; }
    if (gameState !== 'in_wave') return;
    if (player.currentAttackCooldown <= 0) {
        let closestEnemy = null;
        let minDistance = Infinity;
        const aimingRange = 300;
        monsters.forEach(monster => {
            const distance = Math.hypot(player.x - monster.x, player.y - monster.y);
            if (distance < aimingRange && distance < minDistance) {
                closestEnemy = monster;
                minDistance = distance;
            }
        });
        if (closestEnemy) {
            const angle = Math.atan2(closestEnemy.y - player.y, closestEnemy.x - player.x);
            const velocity = { x: Math.cos(angle) * player.projectileSpeed, y: Math.sin(angle) * player.projectileSpeed };
            projectiles.push(new Projectile(player.x, player.y, 5, 'white', velocity));
            player.currentAttackCooldown = player.attackCooldown;
        }
    }
});

window.addEventListener('keydown', (event) => {
    if (!player) return;
    if (gameState === 'passive_choice') {
        if (event.key === '1') { passiveChoiceOptions[0].action(); gameState = 'in_wave'; } 
        else if (event.key === '2') { passiveChoiceOptions[1].action(); gameState = 'in_wave'; } 
        else if (event.key === '3') { passiveChoiceOptions[2].action(); gameState = 'in_wave'; }
        return;
    }
    switch (event.key.toLowerCase()) {
        case 'w': keys.w.pressed = true; break;
        case 'a': keys.a.pressed = true; break;
        case 's': keys.s.pressed = true; break;
        case 'd': keys.d.pressed = true; break;
    }
});

window.addEventListener('keyup', (event) => {
    switch (event.key.toLowerCase()) {
        case 'w': keys.w.pressed = false; break;
        case 'a': keys.a.pressed = false; break;
        case 's': keys.s.pressed = false; break;
        case 'd': keys.d.pressed = false; break;
    }
});