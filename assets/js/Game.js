'use strict'

function Game(canvas) {
  this.player = null;
  this.bombs = [];
  this.isGameOver = false;
  this.canvas = canvas;
  this.ctx = this.canvas.getContext('2d');
  this.onGameOver = null;
  this.score = 0;
  this.count = 0;
  this.gameSong = new Audio('assets/sounds/03_-_Lemmings_-_DOS_-_Lemming_2.ogg');
}

Game.prototype.startGame = function() {
  this.player = new Player(this.canvas);

  var loop = () => {
    if (Math.random() > 0.97) {
      var randomX = Math.random() * (this.canvas.width - 28);
      var newBomb = new Bomb(this.canvas, randomX);
      this.bombs.push(newBomb);
    }
    this.count++;
    
    if (this.count % 60 ===0) { 
      this.score++;
    }

    this.update();
    this.clear();
    this.draw();
    this.checkCollisions();
    this.displayLives();
    this.updateScore();
    this.saveScore(this.score);

    if (!this.isGameOver) {
      this.gameSong.play();
      requestAnimationFrame(loop);
    } else {
      this.onGameOver(this.score);
      var scoreDisplay = document.querySelector('.counter-rank');
      scoreDisplay.innerHTML = this.score;
      this.gameSong.pause();
    }
  };
  loop();
}

Game.prototype.update = function() {
  this.player.move();
  this.bombs.forEach(function(bomb) {
    bomb.move();
  })
};

Game.prototype.clear = function() {
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
};

Game.prototype.draw = function() {
  this.player.drawImage();
  this.bombs.forEach(function(bomb) {
    bomb.drawImage();
  })
}

Game.prototype.checkCollisions = function() {
  this.bombs.forEach((bomb, index) => {
    if(!bomb.isExploding) {
      var rightLeft = this.player.dx + this.player.dWidth >= bomb.dx; //ca
      var leftRight = this.player.dx <= bomb.dx + bomb.dWidth; // ac
      var bottomTop = this.player.dy + this.player.dHeight >= bomb.dy; //db
      var topBottom = this.player.dy <= bomb.dy + bomb.dHeight; // bd
      
      if (rightLeft && leftRight && bottomTop && topBottom) {
        bomb.image.src = './assets/images/svg/booom.svg';
        bomb.isExploding = true;
     
        setTimeout(() => callback(this.bombs, this.player, this.isGameOver), 100);
        var callback = (bombs, player) => {
          bombs.splice(index, 1);
          player.lives --;
          if (player.lives < 1) {
            this.isGameOver = true;
          }
        }
      }
    }
  })
}

Game.prototype.updateScore = function() {
  var scoreDisplay = document.querySelector('.counter-rank');
  scoreDisplay.innerHTML = this.score;
}

Game.prototype.saveScore = function(score) {
  localStorage.setItem('score-value', score);
}

Game.prototype.displayLives = function() {
  var livesDisplay = document.querySelector('.counter-lives');
  livesDisplay.innerHTML = this.player.lives;
}

Game.prototype.gameOverCallback = function(callback) {
  this.onGameOver = callback;
}
