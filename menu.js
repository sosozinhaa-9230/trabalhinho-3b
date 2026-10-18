const welcomeTextEl = document.querySelector('#log-in-menu h1');

if (!localStorage.getItem('hasVisited')) {
    localStorage.setItem('hasVisited', 'true');
    welcomeTextEl.innerHTML = 'Bem vind@, crie sua conta para guardar seu progresso'
} else {
    welcomeTextEl.innerHTML = 'Crie sua conta ou entre em uma já existente'
}