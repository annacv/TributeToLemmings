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

Game.prototype.gameOverCallback = function(callback) {
  this.onGameOver = callback;
}