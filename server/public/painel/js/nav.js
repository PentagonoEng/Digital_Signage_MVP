// server/public/painel/js/nav.js
const menuButtons = document.querySelectorAll('.menu button')
const tabs = document.querySelectorAll('.tab')
const pageTitle = document.getElementById('page-title')
menuButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    menuButtons.forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    tabs.forEach((s) => s.classList.remove('active'))
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active')
    pageTitle.textContent = btn.textContent
  })
)