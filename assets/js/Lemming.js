'use strict'

/*Player Object */

function Player(canvas) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.image = new Image();
  this.image.src = "./assets/images/svg/lemming.svg";
  this.sx = 0;
  this.sy = 0;
  this.sWidth = 142;
  this.sHeight = 142;
  this.dx = 40;
  this.dy = 380;
  this.dWidth = 50;
  this.dHeight = 50;
  this.lives = 3;
  this.direction = 0;
}


/* Methods */

// drawImage
Player.prototype.drawImage = function() {
  this.ctx.drawImage(this.image, this.sx, this.sy, this.sWidth, this.sHeight, this.dx, this.dy, this.dWidth, this.dHeight);
}