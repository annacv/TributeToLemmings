'use strict'

function main() {
  var mainElement = document.querySelector('#site-main');

  function buildDom(html) {
    mainElement.innerHTML = html;
    return mainElement;
  };

  function createStartScreen() {
    var startScreen = buildDom(`
      <section class="section-container">
        <h1 class="section-title">Lemmings Explosion's Party</h1>
        <p class="section-description">WOW!! A simple skip-bombs game!! Try to keep alive your Lemming as much you can!!!!<p>
        <button class="btn-primmary">Start</button>
      </section>
    `);

    var startButton = startScreen.querySelector('button');
    startButton.addEventListener('click', createGameScreen);
  };

  function createGameScreen() {
    var gameScreen = buildDom(`
      <section class="section-container">
        <canvas width="468px" height="468px"></canvas>
      </section>
    `);

    var canvas = document.querySelector('canvas');
    var game = new Game(canvas);

    game.gameOverCallback(createGameOverScreen);
    
    game.startGame();
  };

  function createGameOverScreen() {
    var gameOverScreen = buildDom(`
      <section class="section-container">
        <h1 class="section-title">Game Over</h1>
        <button class="btn-primmary">Restart</button>
      </section>
    `);

    var restartButton = gameOverScreen.querySelector('button');
    restartButton.addEventListener('click', createGameScreen);
  };

  createStartScreen();
}

window.addEventListener('load', main);