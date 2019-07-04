'use strict'

/*Player Object */

function Bomb(canvas, randomX) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.image = new Image();
  this.image.src = "./assets/images/svg/bomb.svg";
  this.dx = randomX;
  this.dy = -45;
  this.dWidth = 28;
  this.dHeight = 32;
  this.direction = 1;
  this.speed = 1.5;
}


/* Methods */

// move
Bomb.prototype.move = function() {
  this.dy = this.dy + this.direction * this.speed;
}

// drawImage
Bomb.prototype.drawImage = function() {
  this.ctx.drawImage(this.image, this.dx, this.dy, this.dWidth, this.dHeight);
}