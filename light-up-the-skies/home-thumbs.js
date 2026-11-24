// Home: the two big buttons' pictures (still, so the home screen scrolls smoothly), and a guard so a scroll is never a tap. Start the show: three
// of the game's own crackers (their soft glow is CSS). Create a love card: AMMA written in fireworks over the palace.
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const show = document.querySelector('#btnStart .btn-ico'), card = document.querySelector('#btnIntroCard');
    if (!show || !card) return;
    show.innerHTML = ['anar', 'rocket', 'bomb'].map((k) => `<img src="assets/ground/${k}.webp" alt="">`).join('');
    const pic = document.createElement('span');
    pic.className = 'btn-ico card-pic'; pic.setAttribute('aria-hidden', 'true');
    card.prepend(pic);
  });

  // A scroll is not a tap: on Android a touch that stops a fling, or a swipe whose finger drifts, can still arrive as a
  // click on the button under it. On the home screen a click is dropped when the page scrolled in the last 250 ms, or
  // the finger travelled more than 10 px between down and up.
  document.addEventListener('DOMContentLoaded', () => {
    const intro = document.getElementById('intro');
    if (!intro) return;
    let scrolledAt = 0, down = null, moved = false;
    const scrolled = () => { scrolledAt = performance.now(); };
    intro.addEventListener('scroll', scrolled, { passive: true, capture: true });
    window.addEventListener('scroll', scrolled, { passive: true });
    intro.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, at: performance.now(), scrolling: performance.now() - scrolledAt < 120 }; moved = false; }, true);
    intro.addEventListener('pointermove', (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) moved = true; }, true);
    intro.addEventListener('click', (e) => {
      if (!e.isTrusted || !down) return; // (the game's own .click() calls and keyboard presses pass)
      const recent = performance.now() - scrolledAt < 250 && scrolledAt > down.at - 120;
      if (moved || down.scrolling || recent) { e.preventDefault(); e.stopImmediatePropagation(); }
      down = null;
    }, true);
  });
})();
