document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.icon-item');
    
    menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        menuItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
    });
    });
});
