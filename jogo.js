// ========================================================================
// JOGO.JS - VERSÃO COMPLETA COM MONSTROS CAÇADORES
// ========================================================================

// --- CONFIGURAÇÃO INICIAL (SETUP) ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const keys = { w: { pressed: false }, a: { pressed: false }, s: { pressed: false }, d: { pressed: false } };

const projectiles = [];
const monsters = [];
const lootDrops = [];
let score = 0;
let animationId;

// Variáveis para o sistema de ondas
let waveNumber = 0;
let monstersRemainingInWave = 0;
let waveTransitionTimer = 3 * 60; // 3 segundos (assumindo 60fps)
let gameState = 'wave_transition'; // Começa na transição para a primeira onda

// ========================================================================
// CLASSES (OS MOLDES DOS NOSSOS OBJETOS)
// ========================================================================

class Player {
    constructor(x, y, radius, color) {
        this.x = x; this.y = y; this.radius = radius; this.color = color; this.speed = 3;
        this.maxHealth = 100;
        this.health = this.maxHealth;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    drawHealthBar() {
        ctx.fillStyle = 'red';
        ctx.fillRect(10, 10, 200, 20);
        ctx.fillStyle = 'green';
        ctx.fillRect(10, 10, (this.health / this.maxHealth) * 200, 20);
        ctx.strokeStyle = 'white';
        ctx.strokeRect(10, 10, 200, 20);
    }

    update() {
        if (keys.w.pressed && this.y - this.radius > 0) { this.y -= this.speed; }
        if (keys.s.pressed && this.y + this.radius < canvas.height) { this.y += this.speed; }
        if (keys.a.pressed && this.x - this.radius > 0) { this.x -= this.speed; }
        if (keys.d.pressed && this.x + this.radius < canvas.width) { this.x += this.speed; }
    }
}

class Monster {
    // ATUALIZADO: Recebe 'speed' em vez de 'velocity'
    constructor(x, y, radius, color, speed) {
        this.x = x; this.y = y; this.radius = radius; this.color = color;
        this.speed = speed; // Guarda a velocidade base do monstro
        this.velocity = { x: 0, y: 0 }; // A velocidade será calculada no update
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    // ATUALIZADO: O monstro agora "pensa" a cada frame
    update() {
        // 1. Calcula o ângulo em direção à posição ATUAL do jogador
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        
        // 2. Atualiza a velocidade do monstro com base nesse ângulo e na sua velocidade
        this.velocity.x = Math.cos(angle) * this.speed;
        this.velocity.y = Math.sin(angle) * this.speed;
        
        // 3. Move-se na nova direção
        this.x = this.x + this.velocity.x;
        this.y = this.y + this.velocity.y;

        // 4. Desenha-se na nova posição
        this.draw();
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
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    update() {
        this.draw();
        this.x = this.x + this.velocity.x;
        this.y = this.y + this.velocity.y;
    }
}

class Loot {
    constructor(x, y, radius, color) {
        this.x = x; this.y = y; this.radius = radius; this.color = color;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}


// ========================================================================
// LÓGICA PRINCIPAL DO JOGO
// ========================================================================

const player = new Player(canvas.width / 2, canvas.height / 2, 15, 'cyan');

function startNextWave() {
    waveNumber++;
    gameState = 'in_wave';
    monstersRemainingInWave = waveNumber * 5;
    
    for (let i = 0; i < monstersRemainingInWave; i++) {
        setTimeout(() => {
            const radius = Math.random() * (30 - 8) + 8;
            const x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius;
            const y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius;
            const color = `hsl(${Math.random() * 360}, 50%, 50%)`;
            const speed = 1 + (waveNumber * 0.1);
            
            // ATUALIZADO: Passa a velocidade diretamente, em vez de um objeto de velocidade
            monsters.push(new Monster(x, y, radius, color, speed));

        }, i * 500);
    }
}

function animate() {
    animationId = requestAnimationFrame(animate);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    player.update();
    player.draw();
    player.drawHealthBar();

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 10, 60);
    ctx.fillText('Wave: ' + waveNumber, canvas.width - 100, 30);

    if (gameState === 'wave_transition') {
        waveTransitionTimer--;
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Próxima onda em: ${Math.ceil(waveTransitionTimer / 60)}`, canvas.width / 2, canvas.height / 2);
        
        if (waveTransitionTimer <= 0) {
            startNextWave();
        }
        return;
    }

    lootDrops.forEach((loot, lootIndex) => {
        loot.draw();
        const dist = Math.hypot(player.x - loot.x, player.y - loot.y);
        if (dist - loot.radius - player.radius < 1) {
            lootDrops.splice(lootIndex, 1);
            score += 100;
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

    monsters.forEach((monster, monsterIndex) => {
        monster.update();

        const distPlayerMonster = Math.hypot(player.x - monster.x, player.y - monster.y);
        if (distPlayerMonster - monster.radius - player.radius < 1) {
            player.health -= 20;
            monsters.splice(monsterIndex, 1);
            monstersRemainingInWave--;

            if (player.health <= 0) {
                player.health = 0;
                cancelAnimationFrame(animationId);
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white';
                ctx.font = '50px Arial';
                ctx.textAlign = 'center';
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
                lootDrops.push(new Loot(monster.x, monster.y, 7, 'gold'));
                monstersRemainingInWave--;
                
                setTimeout(() => {
                    monsters.splice(monsterIndex, 1);
                    projectiles.splice(projIndex, 1);
                }, 0);
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

window.addEventListener('click', (event) => {
    // Se o jogo acabou, o clique serve para recomeçar
    if (player.health <= 0) {
        window.location.reload();
        return;
    }
    
    // Se o jogo está a decorrer, o clique serve para atirar
    const angle = Math.atan2(event.clientY - player.y, event.clientX - player.x);
    const projectileSpeed = 5;
    const velocity = { x: Math.cos(angle) * projectileSpeed, y: Math.sin(angle) * projectileSpeed };
    projectiles.push(new Projectile(player.x, player.y, 5, 'white', velocity));
});

window.addEventListener('keydown', (event) => {
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

// Inicia o jogo
animate();