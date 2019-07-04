'use strict'

/*Player Object */

function Player(canvas) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.image = new Image();
  this.image.src = "./assets/images/svg/lemming.svg";
  this.dx = 40;
  this.dy = 380;
  this.dWidth = 50;
  this.dHeight = 50;
  this.lives = 3;
  this.direction = 0;
  this.speed = 1;
}


/* Methods */

//move
Player.prototype.move = function() {
  this.dx = this.dx + this.direction * this.speed;
  if (this.dx + this.direction * this.speed == 0 || this.dx + this.direction * this.speed >= 419) {
    this.direction = this.direction/-1;
  }
}

// drawImage
Player.prototype.drawImage = function() {
  this.ctx.drawImage(this.image, this.dx, this.dy, this.dWidth, this.dHeight);
  if (this.lives === 2) {
    this.image.src = "./assets/images/svg/lemming--2-lives.svg";
  } else if (this.lives === 1 || this.lives === 0) {
    this.image.src = "./assets/images/svg/lemming--1-life.svg";
  } else {
    this.image.src = "./assets/images/svg/lemming.svg";
  }
}

//setNewDirection
Player.prototype.setDirection = function(newDirection) {
  this.direction = newDirection;
}