const container = document.querySelector('.nubes-largas-fast-container');
const rect = container.getBoundingClientRect();
const style = window.getComputedStyle(container);
const imgs = container.querySelectorAll('img');
const imgRects = Array.from(imgs).map(img => img.getBoundingClientRect());
const imgStyles = Array.from(imgs).map(img => window.getComputedStyle(img).position);

console.log('Container Rect:', rect);
console.log('Container top:', style.top, 'display:', style.display);
console.log('Image Rects:', imgRects);
console.log('Image Positions:', imgStyles);
