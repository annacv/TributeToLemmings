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
  this.speed = 2;
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
}

//setNewDirection
Player.prototype.setDirection = function(newDirection) {
  this.direction = newDirection;
}
