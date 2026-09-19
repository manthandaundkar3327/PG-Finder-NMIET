async function api(url, options = {}) { const r = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || 'Request failed'); return data }
async function updateUserBadge() { const el = document.getElementById('userBadge'); if (!el) return; try { const s = await api('/api/session'); if (s.loggedIn) { el.innerHTML = `Hi, ${escapeHtml(s.user.name)} <button class="btn" onclick="logout()">Logout</button>` } else el.textContent = 'Not logged in' } catch { } }
async function logout() { await api('/api/logout', { method: 'POST' }); location.href = './find-pg.html' }

async function loadMyVacancies() {
    const section = document.getElementById('myVacanciesSection');
    const list = document.getElementById('myVacanciesList');
    if (!section || !list) return;
    try {
        const session = await api('/api/session');
        if (!session.loggedIn) { section.hidden = true; return; }
        section.hidden = false;
        list.innerHTML = '<div class="empty">Loading your vacancies...</div>';
        const rows = await api('/api/my-pgs');
        if (!rows.length) {
            list.innerHTML = '<div class="empty">You have not published any vacancies yet.</div>';
            return;
        }
        list.innerHTML = rows.map(p => {
            const bgClass = p.gender_type === 'Boys' ? 'pg-boys' : (p.gender_type === 'Girls' ? 'pg-girls' : 'pg-any');
            return `<article class="my-vacancy-item ${bgClass}">
                <div class="my-vacancy-info">
                    <h3>${escapeHtml(p.pg_name)}</h3>
                    <p><b>${escapeHtml(p.locality)}</b> · Rs. ${Number(p.rent).toLocaleString('en-IN')}/month · ${p.vacancies} vacancy/vacancies</p>
                    <div class="meta compact">
                        <span class="tag">For: ${escapeHtml(p.gender_type)}</span>
                        <span class="tag">${p.distance} km from college</span>
                        <span class="tag">${p.students_living} students living</span>
                    </div>
                </div>
                <div class="my-vacancy-actions"><a class="btn edit" href="./edit-vacancy.html">Edit Details</a><button class="btn danger" type="button" onclick="removeVacancy(${p.id}, '${escapeHtml(p.pg_name).replace(/'/g, '&#39;')}')">Remove Vacancy</button></div>
            </article>`;
        }).join('');
    } catch (e) {
        section.hidden = false;
        list.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
    }
}

async function removeVacancy(id, name) {
    if (!confirm(`Remove the vacancy for "${name}"? This cannot be undone.`)) return;
    try {
        await api(`/api/pgs/${id}`, { method: 'DELETE' });
        await loadMyVacancies();
        if (document.getElementById('pgList')) loadPGs();
    } catch (e) {
        alert(e.message);
    }
}
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])) }

async function loadPGs() {
    const list = document.getElementById('pgList');
    if (!list) return;

    const q = new URLSearchParams({
        q: document.getElementById('search').value,
        maxRent: document.getElementById('maxRent').value,
        maxDistance: document.getElementById('maxDistance').value,
        gender: document.getElementById('genderFilter') ? document.getElementById('genderFilter').value : ''
    });
    list.innerHTML = '<div class="empty">Loading vacancies...</div>';
    try {
        const rows = await api('/api/pgs?' + q);
        document.getElementById('count').textContent = `${rows.length} vacancy/vacancies found`;
        list.innerHTML = rows.length ? rows.map(p => {

            const bgClass = p.gender_type === 'Boys' ? 'pg-boys' : (p.gender_type === 'Girls' ? 'pg-girls' : 'pg-any');

            return `<article class="card pg-card ${bgClass}">
                <h2>${escapeHtml(p.pg_name)}</h2>
                <div class="rent">Rs. ${Number(p.rent).toLocaleString('en-IN')} / month</div>
                <p><b>Locality:</b> ${escapeHtml(p.locality)}</p>
                <div class="meta">
                    <span class="tag">For: ${escapeHtml(p.gender_type)}</span>
                    <span class="tag">${p.students_living} students living</span>
                    <span class="tag">${p.vacancies} vacancy/vacancies</span>
                    <span class="tag">${p.distance} km from college</span>
                    <span class="tag">Posted by ${escapeHtml(p.posted_by)}</span>
                </div>
                <p><b>Exact location:</b> ${escapeHtml(p.location)}</p>
                <p>${escapeHtml(p.description || 'No description provided.')}</p>
                <div class="card-actions">
                    <a href="tel:${escapeHtml(p.contact)}" class="btn call">📞 Call: ${escapeHtml(p.contact)}</a>
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.location + (p.locality ? ", " + p.locality : ""))}" target="_blank" rel="noopener noreferrer" class="btn direction">📍 Get Direction</a>
                </div>
            </article>`
        }).join('') : '<div class="card empty">No available PGs match your search.</div>'
    } catch (e) {
        list.innerHTML = `<div class="card empty">${escapeHtml(e.message)}</div>`
    }
}

function setupLogin() { const f = document.getElementById('loginForm'); if (!f) return; f.addEventListener('submit', async e => { e.preventDefault(); const msg = document.getElementById('loginMsg'); try { const body = Object.fromEntries(new FormData(f)); await api('/api/login', { method: 'POST', body: JSON.stringify(body) }); msg.textContent = 'Login successful.'; f.reset(); loadMyVacancies(); updateUserBadge() } catch (err) { msg.textContent = err.message } }) }
function setupRegister() { const f = document.getElementById('registerForm'); if (!f) return; f.addEventListener('submit', async e => { e.preventDefault(); const msg = document.getElementById('registerMsg'); try { const body = Object.fromEntries(new FormData(f)); await api('/api/register', { method: 'POST', body: JSON.stringify(body) }); msg.textContent = 'Account created successfully.'; f.reset(); loadMyVacancies(); updateUserBadge() } catch (err) { msg.textContent = err.message } }) }
function setupVacancy() { const f = document.getElementById('vacancyForm'); if (!f || location.pathname.endsWith('./edit-vacancy.html')) return; f.addEventListener('submit', async e => { e.preventDefault(); const msg = document.getElementById('vacancyMsg'); try { const s = await api('/api/session'); if (!s.loggedIn) { msg.textContent = 'Please log in before posting a vacancy.'; return } const body = Object.fromEntries(new FormData(f)); await api('/api/pgs', { method: 'POST', body: JSON.stringify(body) }); msg.textContent = 'Vacancy published successfully!'; f.reset() } catch (err) { msg.textContent = err.message } }) }


async function setupEditVacancy() {
    const f = document.getElementById('vacancyForm');
    if (!f || !location.pathname.endsWith('./edit-vacancy.html')) return;
    const msg = document.getElementById('editMsg');
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { msg.textContent = 'Invalid vacancy.'; return; }
    try {
        const session = await api('/api/session');
        if (!session.loggedIn) { msg.textContent = 'Please log in first.'; return; }
        const rows = await api('/api/my-pgs');
        const p = rows.find(x => String(x.id) === String(id));
        if (!p) { msg.textContent = 'Vacancy not found or you are not the owner.'; return; }
        const values = { pgName:p.pg_name, locality:p.locality, rent:p.rent, studentsLiving:p.students_living, vacancies:p.vacancies, distance:p.distance, genderType:p.gender_type, contact:p.contact, location:p.location, description:p.description || '' };
        Object.entries(values).forEach(([name,value]) => { const el=f.elements[name]; if(el) el.value=value; });
        f.addEventListener('submit', async e => {
            e.preventDefault();
            try {
                const body=Object.fromEntries(new FormData(f));
                await api(`/api/pgs/${id}`, {method:'PUT', body:JSON.stringify(body)});
                msg.textContent='Vacancy updated successfully.';
                setTimeout(()=>location.href='find-pg.html',700);
            } catch(err){ msg.textContent=err.message; }
        });
    } catch(err){ msg.textContent=err.message; }
}

updateUserBadge(); setupLogin(); setupRegister(); setupVacancy(); setupEditVacancy(); loadMyVacancies();
if (document.getElementById('pgList')) {
    document.getElementById('refresh').addEventListener('click', loadPGs);
    document.getElementById('search').addEventListener('keydown', e => { if (e.key === 'Enter') loadPGs() });
    loadPGs()
}