document.addEventListener('DOMContentLoaded', function () {
    updateNavAuth();
});

function updateNavAuth() {
    var token = localStorage.getItem('token');
    var user = null;
    try {
        user = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
        user = null;
    }

    var navAuth = document.getElementById('navAuth');
    var navUser = document.getElementById('navUser');
    var navAdmin = document.getElementById('navAdmin');

    if (token && user) {
        if (navAuth) navAuth.style.display = 'none';
        if (navUser) navUser.style.display = 'inline';
        if (navAdmin && user.is_admin) navAdmin.style.display = 'inline';
    } else {
        if (navAuth) navAuth.style.display = 'inline';
        if (navUser) navUser.style.display = 'none';
        if (navAdmin) navAdmin.style.display = 'none';
    }
}

function toggleNav() {
    var navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

function apiRequest(url, options) {
    options = options || {};
    var headers = options.headers || {};
    var token = localStorage.getItem('token');
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    options.headers = headers;
    return fetch(url, options).then(function (r) {
        return r.json();
    });
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    return d.toLocaleDateString();
}
