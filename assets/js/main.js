'use strict'

function main() {
  var mainElement = document.querySelector('#site-main');

  function buildDom(html) {
    mainElement.innerHTML = html;
    return mainElement;
  };

  function createStartScreen() {
    var startScreen = buildDom(`
      <section class="section-container intro">
        <h1 class="section-title">Lemmings Explosion's Party</h1>
        <p class="section-description"><span class="description-highlighted">WOW!!</span> A classic skip-bomb game! Keep your Lemming alive as much as you can -:P<p>
        <button class="btn-primmary">Start</button>
      </section>
    `);

    var startButton = startScreen.querySelector('button');
    startButton.addEventListener('click', createGameScreen);
  };

  function createGameScreen() {
    var gameScreen = buildDom(`
      <section class="section-container play">
        <div class="counter-container">
          <span class="description-highlighted">lives</span>
          <p class="counter-lives"></p>
          <span class="description-highlighted">seconds</span>
          <p class="counter-rank"></p>
        </div>
        <canvas width="468px" height="468px"></canvas>
        <h2 class="section-description"><span class="description-highlighted">></span> Use your left & right arrows to move the Lemming!</h2>
      </section>
    `);

    var canvas = document.querySelector('canvas');
    var game = new Game(canvas);

    game.gameOverCallback(createGameOverScreen);
    
    game.startGame();

    // Lemming commands
    document.addEventListener('keydown', function(event) {
      if (event.key === 'ArrowRight') { 
        game.player.setDirection(1);
      } else if (event.key === 'ArrowLeft') { 
        game.player.setDirection(-1);
      }
    });
  };

  function createGameOverScreen(score) {
    var gameOverScreen = buildDom(`
    <section class="section-container">
    <h2 class="section-description game-over"><span class="description-highlighted"> ></span> Booom!!! Your score is: <span class="counter-rank description-highlighted"></span></h2>    
    <div class="image-container">
    <h1 class="section-title game-over">Game Over!</h1>
    <button class="btn-primmary">Restart</button>
    </div>
    </section>
    `);
    
    var finalScore = document.querySelector('.counter-rank');
    finalScore.innerHTML = localStorage.getItem('score-rank');
    var restartButton = gameOverScreen.querySelector('button');
    restartButton.addEventListener('click', createGameScreen);
  };

  createStartScreen();
}

window.addEventListener('load', main);