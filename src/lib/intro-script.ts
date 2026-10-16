/**
 * Runs in <head> before first paint (root layout). On a fresh page load of the homepage it decides whether the intro
 * reveal plays: once per browser session, never for reduced motion. It only sets <html data-intro>; IntroReveal reads it.
 * Other pages leave it unset, so arriving on the homepage later through in-app navigation never shows the intro.
 */
export const introScript = `(function(){var d=document.documentElement;try{if(location.pathname!=='/')return;var r=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;if(r||sessionStorage.getItem('intro-seen')){d.dataset.intro='skip';return;}sessionStorage.setItem('intro-seen','1');d.dataset.intro='play';}catch(e){d.dataset.intro='skip';}})();`;
