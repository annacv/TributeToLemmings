'use strict'

/*Player Object */

function Bomb(canvas) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.image = new Image();
  this.image.src = "./assets/images/svg/bomb.svg";
  this.sx = 0;
  this.sy = 0;
  this.sWidth = 76;
  this.sHeight = 84;
  this.dx = 0;
  this.dy = 0;
  this.dWidth = 38;
  this.dHeight = 42;
  this.speed = 3;
  this.direction = 0;
}


/* Methods */

// drawImage
Bomb.prototype.drawImage = function() {
  this.ctx.drawImage(this.image, this.sx, this.sy, this.sWidth, this.sHeight, this.dx, this.dy, this.dWidth, this.dHeight);
}