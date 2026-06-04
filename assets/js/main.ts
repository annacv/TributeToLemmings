import { Game } from './Game';

function main(): void {
  const mainElement = document.querySelector('#site-main') as HTMLElement;

  function buildDom(html: string): HTMLElement {
    mainElement.innerHTML = html;
    return mainElement;
  }

  function createStartScreen(): void {
    const startScreen = buildDom(`
      <section class="section-container intro">
        <h1 class="section-title">Lemmings Explosion's Party</h1>
        <p class="section-description"><span class="description-highlighted">WOW!!</span> A classic skip-bomb game! Keep the Lemming alive as much as you can -:P<p>
        <button class="btn-primmary">Start</button>
      </section>
    `);

    const startButton = startScreen.querySelector('button')!;
    startButton.addEventListener('click', createGameScreen);
  }

  function createGameScreen(): void {
    const gameScreen = buildDom(`
      <section class="section-container play">
      <div class="touch-left"><</div>
      <div class="touch-right">></div>
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

    const canvas = gameScreen.querySelector('canvas') as HTMLCanvasElement;
    const game = new Game(canvas);

    game.gameOverCallback(createGameOverScreen);
    game.startGame();

    const arrowRight = gameScreen.querySelector('.touch-right') as HTMLElement;
    arrowRight.addEventListener('touchstart', () => game.player?.setDirection(1));

    const arrowLeft = gameScreen.querySelector('.touch-left') as HTMLElement;
    arrowLeft.addEventListener('touchstart', () => game.player?.setDirection(-1));

    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        game.player?.setDirection(1);
      } else if (event.key === 'ArrowLeft') {
        game.player?.setDirection(-1);
      }
    });
  }

  function createGameOverScreen(score: number): void {
    const gameOverScreen = buildDom(`
    <section class="section-container">
    <h2 class="section-description game-over"><span class="description-highlighted"> ></span> Booom!!! Your score is: <span class="counter-rank description-highlighted"></span></h2>
    <div class="image-container">
    <h1 class="section-title game-over">Game Over!</h1>
    <button class="btn-primmary">Restart</button>
    </div>
    </section>
    `);

    const finalScore = gameOverScreen.querySelector('.counter-rank');
    if (finalScore) finalScore.innerHTML = String(localStorage.getItem('score-value') ?? score);
    const restartButton = gameOverScreen.querySelector('button')!;
    restartButton.addEventListener('click', createGameScreen);
  }

  createStartScreen();
}

window.addEventListener('load', main);
