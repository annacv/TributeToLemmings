'use strict'

function Game(canvas) {
  this.player = null;
  this.isGameOver = false;
  this.canvas = canvas;
  this.ctx = this.canvas.getContext('2d');
  this.onGameOver = null;
}

Game.prototype.startGame = function() {
  this.player = new Player(this.canvas);

  var loop = () => {
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
}

Game.prototype.gameOverCallback = function(callback) {
  this.onGameOver = callback;
}