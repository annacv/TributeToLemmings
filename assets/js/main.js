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

    var startButton = startScreen.querySelector('.btn-primary');
    startButton.addEventListener('click', createGameScreen);
  };

  createStartScreen();
}

window.addEventListener('load', main);