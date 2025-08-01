// ========================================================================
// JOGO.JS - VERSÃO COMPLETA E FINAL
// ========================================================================

// --- CONFIGURAÇÃO INICIAL (SETUP) ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const keys = { w: { pressed: false }, a: { pressed: false }, s: { pressed: false }, d: { pressed: false } };
const projectiles = [];
const monsters = [];
const enemyProjectiles = []; // Array para os projéteis dos inimigos
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

// Classe base para todos os monstros
class Monster {
    constructor(x, y, radius, color, speed) {
        this.x = x; this.y = y; this.radius = radius; this.color = color;
        this.speed = speed;
        this.velocity = { x: 0, y: 0 };
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.stroke();
    }

    update() {
        // Lógica de perseguição padrão para monstros Melee
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.velocity.x = Math.cos(angle) * this.speed;
        this.velocity.y = Math.sin(angle) * this.speed;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.draw();
    }
}

// Classe para o monstro corpo a corpo, que herda de Monster
class MeleeMonster extends Monster {
    constructor(x, y, radius, color, speed) {
        super(x, y, radius, color, speed); // Chama o construtor da classe pai
    }
    // O método 'update' da classe pai (Monster) já define o comportamento de perseguição,
    // então não precisamos de reescrevê-lo aqui.
}

// Classe para o monstro de longo alcance, que herda de Monster
class RangedMonster extends Monster {
    constructor(x, y, radius, color, speed) {
        super(x, y, radius, color, speed);
        this.shootCooldown = 180; // 3 segundos para atirar
    }

    update() {
        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        
        // Se estiver longe do jogador, aproxima-se usando a lógica da classe pai
        if (distToPlayer > 300) {
            super.update(); 
        } else {
            // Se estiver perto, para de se mover e apenas se desenha
            this.draw(); 
        }

        // Lógica de tiro
        this.shootCooldown--;
        if (this.shootCooldown <= 0) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            const projectileSpeed = 4;
            const velocity = { x: Math.cos(angle) * projectileSpeed, y: Math.sin(angle) * projectileSpeed };
            enemyProjectiles.push(new Projectile(this.x, this.y, 5, 'orange', velocity));
            this.shootCooldown = 120; // Reseta o cooldown
        }
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
            let x = Math.random() < 0.5 ? 0 - 30 : canvas.width + 30;
            let y = Math.random() < 0.5 ? 0 - 30 : canvas.height + 30;
            
            let radius = 15;
            let color = 'red';
            let speed = 1 + (waveNumber * 0.1);

            const isRare = Math.random() < 0.05; 
            if (isRare) {
                radius = 30;
                color = 'yellow';
                speed *= 1.3;
            }

            if (Math.random() < 0.7) {
                monsters.push(new MeleeMonster(x, y, radius, color, speed));
            } else {
                if (!isRare) color = '#ff8c00'; // Laranja escuro para Ranged
                monsters.push(new RangedMonster(x, y, radius, color, speed));
            }
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

    enemyProjectiles.forEach((enemyProj, index) => {
        enemyProj.update();

        if (enemyProj.x + enemyProj.radius < 0 ||
            enemyProj.x - enemyProj.radius > canvas.width ||
            enemyProj.y + enemyProj.radius < 0 ||
            enemyProj.y - enemyProj.radius > canvas.height) {
            setTimeout(() => {
                enemyProjectiles.splice(index, 1);
            }, 0);
        }

        const dist = Math.hypot(player.x - enemyProj.x, player.y - enemyProj.y);
        if (dist - player.radius - enemyProj.radius < 1) {
            player.health -= 5;
            enemyProjectiles.splice(index, 1);
            
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
    });

    monsters.forEach((monster, monsterIndex) => {
        monster.update();

        const distPlayerMonster = Math.hypot(player.x - monster.x, player.y - monster.y);
        if (distPlayerMonster - monster.radius - player.radius < 1) {
            player.health -= 10;
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