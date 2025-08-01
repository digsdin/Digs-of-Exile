// ========================================================================
// JOGO.JS - VERSÃO COMPLETA E FINAL
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
let spawnIntervalId;

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

function spawnMonsters() {
    spawnIntervalId = setInterval(() => {
        const radius = Math.random() * (30 - 8) + 8;
        const x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius;
        const y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius;
        const color = `hsl(${Math.random() * 360}, 50%, 50%)`;
        const angle = Math.atan2(player.y - y, player.x - x);
        const speed = 1;
        const velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        monsters.push(new Monster(x, y, radius, color, velocity));
    }, 1200);
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
    ctx.fillText('Score: ' + score, 10, 60);

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
            monsters.splice(monsterIndex, 1);
            player.health -= 20;

            if (player.health <= 0) {
                player.health = 0;
                cancelAnimationFrame(animationId);
                clearInterval(spawnIntervalId);
                
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
                setTimeout(() => {
                    monsters.splice(monsterIndex, 1);
                    projectiles.splice(projIndex, 1);
                }, 0)
            }
        });
    });
}


// ========================================================================
// LISTENERS DE EVENTOS E INÍCIO DO JOGO
// ========================================================================

window.addEventListener('click', (event) => {
    if (player.health <= 0) { // Só permite reiniciar se o jogo acabou
        window.location.reload();
        return;
    }
    
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
spawnMonsters();