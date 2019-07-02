'use strict'

function Game(canvas) {
  this.isGameOver = false;
  this.canvas = canvas;
  this.ctx = this.canvas.getContext('2d');
  this.onGameOver = null;
}

Game.prototype.startGame = function() {
  console.log('aloha');
}

Game.prototype.gameOverCallback = function(callback) {
  this.onGameOver = callback;
}