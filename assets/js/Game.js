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
      var newBomb = new Bomb(this.canvas);
      this.bombs.push(newBomb);
    }

    this.draw();
    if (!this.isGameOver) {
      requestAnimationFrame(loop);
    } else {
      this.onGameOver();
    }
  };
  loop();
}

Game.prototype.draw = function() {
  console.log('draw is called');
  this.player.drawImage();
  this.bombs.forEach(function(bomb) {
    bomb.drawImage();
  })
}

Game.prototype.gameOverCallback = function(callback) {
  this.onGameOver = callback;
}