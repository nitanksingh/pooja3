// script.js
document.documentElement.style.touchAction = 'manipulation';

const ambience = document.getElementById('ambience');
const sunMsg = document.getElementById('sunMsg');
const sunText = document.getElementById('sunText');
const sunClose = document.getElementById('sunClose');
const audioControl = document.getElementById('audioControl');
const audioTooltip = document.querySelector('.audio-tooltip');
const diyas = Array.from(document.querySelectorAll('.diya'));
const audioIcon = document.getElementById('audioIcon');

// safe-guard: some elements might not exist in tests
// comfortable starting volume (if ambience exists)
if (ambience) {
  ambience.volume = 0.62;
}

// update the play/pause icon and aria
function updateIconState(isPlaying){
  if (!audioControl) return;
  const svg = audioControl.querySelector('svg');
  if(!svg) return;
  // pause icon (two bars) when playing, play triangle when paused
  svg.innerHTML = isPlaying ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"></path>' : '<path d="M8 5v14l11-7z"></path>';
  audioControl.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
  audioControl.setAttribute('aria-label', isPlaying ? 'Pause music' : 'Play music');
  if (audioTooltip) audioTooltip.textContent = isPlaying ? 'Pause music' : 'Play music';
}

// ------------------- AUDIO: mobile-safe autoplay & first-tap start -------------------
// We attempt a muted autoplay on load (allowed by browsers).
// If blocked, we start audible playback on the first user interaction (pointer/touch/click).

async function tryAutoplayMuted() {
  if (!ambience) return;
  try {
    ambience.muted = true;          // start muted so autoplay is allowed
    await ambience.play();          // attempt to play (muted)
    // If the browser lets us autoplay muted, try to unmute immediately.
    ambience.muted = false;
    updateIconState(true);
    console.log('✅ Autoplay succeeded (muted -> unmuted).');
  } catch (err) {
    // Autoplay with sound blocked — we'll wait for a user gesture.
    ambience.muted = true; // keep it muted until user interacts
    updateIconState(false);
    console.warn('⚠️ Autoplay blocked; waiting for user interaction.', err);
  }
}

// Start audible playback on the first user interaction (works for mobile)
async function startAudioOnFirstGesture() {
  if (!ambience) return;
  try {
    await ambience.play();
    ambience.muted = false;
    updateIconState(true);
    console.log('🎵 Audio started after user interaction.');
  } catch (err) {
    // Still blocked — keep waiting (rare). Do not spam requests.
    console.warn('Audio play attempt on gesture still blocked:', err);
  } finally {
    // remove listeners after the first attempt to avoid extra calls
    window.removeEventListener('pointerdown', startAudioOnFirstGesture);
    window.removeEventListener('touchstart', startAudioOnFirstGesture);
    document.removeEventListener('click', startAudioOnFirstGesture);
  }
}

// Install the initial autoplay attempt and gesture listeners
window.addEventListener('DOMContentLoaded', () => {
  tryAutoplayMuted();

  // Listen for a user gesture to enable audible playback (once)
  window.addEventListener('pointerdown', startAudioOnFirstGesture, { passive: true, once: true });
  window.addEventListener('touchstart', startAudioOnFirstGesture, { passive: true, once: true });
  document.addEventListener('click', startAudioOnFirstGesture, { once: true });
});

// ------------------- Audio control (play/pause) -------------------
if (audioControl && ambience) {
  audioControl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (ambience.paused) {
      ambience.play().then(() => updateIconState(true)).catch(() => {
        // fallback: if play fails, leave UI as-is; user can tap again
        console.warn('Play failed from control; user gesture may be needed.');
      });
    } else {
      ambience.pause();
      updateIconState(false);
    }
  });

  audioControl.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      audioControl.click();
    }
  });
}

// reflect audio state changes
if (ambience) {
  ambience.addEventListener('play', () => updateIconState(true));
  ambience.addEventListener('pause', () => updateIconState(false));
  // helpful error handler for missing/incorrect files
  ambience.addEventListener('error', (e) => {
    console.error('Audio error', e);
    alert('⚠️ Audio file could not be loaded. Ensure the MP3 is in the same folder and the filename matches the <source> tag.');
  });
}
updateIconState(false);

// ------------------- Diya selection, ripple, and show in sun -------------------
let lastSelected = null;
function selectDiya(el){
  if(!el) return;
  if(lastSelected) lastSelected.classList.remove('selected');
  el.classList.add('selected');
  lastSelected = el;
}

// ripple effect
function triggerRipple(diya){
  const r = diya.querySelector('.ripple');
  if(!r) return;
  r.style.transition = 'none';
  r.style.transform = 'scale(0.3)';
  r.style.opacity = '0.6';
  requestAnimationFrame(()=> {
    r.style.transition = 'transform .6s ease, opacity .6s ease';
    r.style.transform = 'scale(1.06)';
    r.style.opacity = '0';
  });
}

// show message and scroll on small screens
function showInSun(text, sourceDiya){
  if (!sunText || !sunMsg) return;
  sunText.textContent = text;
  sunMsg.classList.add('show');
  if(sourceDiya) selectDiya(sourceDiya);

  if(window.innerWidth < 720){
    const rect = document.querySelector('.sun-core')?.getBoundingClientRect();
    if (rect) {
      const offset = Math.max(0, rect.top + window.scrollY - 80);
      window.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }
}

// attach interactions to diyas
diyas.forEach((d, idx) => {
  d.addEventListener('click', () => { triggerRipple(d); showInSun(d.dataset.msg, d); });
  d.addEventListener('touchstart', (e) => { e.stopPropagation(); triggerRipple(d); showInSun(d.dataset.msg, d); }, { passive: true });
  d.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); triggerRipple(d); showInSun(d.dataset.msg, d); }});
  d.setAttribute('aria-label', `Diya ${idx+1} — press to show blessing in sun`);
});

// close message
if (sunClose) {
  sunClose.addEventListener('click', (e) => { e.stopPropagation(); sunMsg.classList.remove('show'); });
}

// ESC hides message
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') sunMsg.classList.remove('show'); });

// make first diya keyboard focusable
const firstDiya = document.querySelector('.diya');
if (firstDiya) firstDiya.setAttribute('tabindex', '0');

// handle orientation change to keep sun visible
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    if (sunMsg && sunMsg.classList.contains('show')) {
      const rect = document.querySelector('.sun-core')?.getBoundingClientRect();
      if (rect && window.innerWidth < 720) {
        const offset = Math.max(0, rect.top + window.scrollY - 80);
        window.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }
  }, 350);
});

// ------------------- Gentle floating for diyas (visual enhancement) -------------------
diyas.forEach((diya, index) => {
  const drift = ((index % 2 === 0) ? 1 : -1) * (6 + index * 2);
  // use Web Animations API to avoid CSS conflicts
  diya.animate(
    [
      { transform: `translateY(0) translateX(0)` },
      { transform: `translateY(8px) translateX(${drift}px)` },
      { transform: `translateY(0) translateX(0)` }
    ],
    {
      duration: 6000 + index * 400,
      iterations: Infinity,
      direction: 'alternate',
      easing: 'ease-in-out',
      delay: index * 200
    }
  );
});
