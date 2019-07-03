'use strict'

function Game(canvas) {
  this.player = null;
  this.bombs = [];
  this.isGameOver = false;
  this.canvas = canvas;
  this.ctx = this.canvas.getContext('2d');
  this.onGameOver = null;
}

Game.prototype.startGame = function() {
  this.player = new Player(this.canvas);

  var loop = () => {
    if (Math.random() > 0.97) {
      var randomX = Math.random() * this.canvas.width - 38;
      var newBomb = new Bomb(this.canvas, randomX);
      this.bombs.push(newBomb);
    }
    
    this.update();
    this.clear();
    this.draw();
    this.checkCollisions();

    if (!this.isGameOver) {
      requestAnimationFrame(loop);
    } else {
      this.onGameOver();
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
    var rightLeft = this.player.dx + this.player.dWidth >= bomb.dx; //ca
    var leftRight = this.player.dx <= bomb.dx + bomb.dWidth; // ac
    var bottomTop = this.player.dy + this.player.dHeight >= bomb.dy; //db
    var topBottom = this.player.dy <= bomb.dy + bomb.dHeight; // bd
    
    if (rightLeft && leftRight && bottomTop && topBottom) {
      this.bombs.splice(index, 1);
      this.player.lives --;
      if (this.player.lives === 0) {
        this.isGameOver = true;
      }
    }
  })
}

Game.prototype.gameOverCallback = function(callback) {
  this.onGameOver = callback;
}