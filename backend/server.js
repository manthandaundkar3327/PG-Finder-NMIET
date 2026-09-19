const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'frontend', 'public');
const db = new Database(path.join(__dirname, '..', 'frontend', 'campusnest.db'));

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pg_vacancies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pg_name TEXT NOT NULL,
  locality TEXT NOT NULL,
  rent INTEGER NOT NULL CHECK(rent >= 0),
  students_living INTEGER NOT NULL CHECK(students_living >= 0),
  vacancies INTEGER NOT NULL CHECK(vacancies > 0),
  distance REAL NOT NULL CHECK(distance >= 0),
  location TEXT NOT NULL,
  description TEXT DEFAULT '',
  gender_type TEXT NOT NULL DEFAULT 'Any',
  contact TEXT NOT NULL DEFAULT 'Not Provided',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// Demo data is inserted only when the database is empty.
if (db.prepare('SELECT COUNT(*) AS count FROM pg_vacancies').get().count === 0) {
  const passwordHash = bcrypt.hashSync('12345', 10);
  db.prepare('INSERT OR IGNORE INTO users(name,email,password_hash) VALUES (?,?,?)')
    .run('Demo Student', 'student@example.com', passwordHash);
  const user = db.prepare('SELECT id FROM users WHERE email=?').get('student@example.com');
  const insert = db.prepare(`INSERT INTO pg_vacancies
    (user_id,pg_name,locality,rent,students_living,vacancies,distance,location,description,gender_type,contact)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  [
    ['Green View PG','College Road',6500,3,1,0.7,'Near Main Gate','Quiet student-friendly PG near campus.','Boys','+91 9876543210'],
    ['Student Square','University Chowk',5500,2,2,1.2,'Opposite City Library','Affordable shared rooms with Wi-Fi.','Girls','+91 8765432109'],
    ['Maple Residency','Shivaji Nagar',8500,2,1,2.1,'Shivaji Nagar Bus Stop','Spacious room with attached facilities.','Boys','+91 7654321098'],
    ['Campus Corner','College Road',4800,3,1,0.9,'Near College Road','Budget-friendly shared accommodation.','Any','+91 6543210987']
  ].forEach(p => insert.run(user.id, ...p));
}

app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-before-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 4 }
}));

function publicUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

// ---------------- API ----------------
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'CampusNest API' }));

app.get('/api/session', (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  const user = db.prepare('SELECT id,name,email FROM users WHERE id=?').get(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({ loggedIn: false });
  }
  res.json({ loggedIn: true, user: publicUser(user) });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (String(password).length < 5) return res.status(400).json({ error: 'Password must be at least 5 characters.' });

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const hash = await bcrypt.hash(String(password), 10);
    const info = db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)')
      .run(String(name).trim(), normalizedEmail, hash);
    req.session.userId = Number(info.lastInsertRowid);
    const user = db.prepare('SELECT id,name,email FROM users WHERE id=?').get(req.session.userId);
    res.status(201).json({ message: 'Registration successful.', user: publicUser(user) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'An account with this email already exists.' });
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(String(email).trim().toLowerCase());
  if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  req.session.userId = user.id;
  res.json({ message: 'Login successful.', user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out.' }));
});

app.get('/api/pgs', (req, res) => {
  const { q = '', maxRent = '', maxDistance = '', gender = '' } = req.query;
  let sql = `SELECT p.*, u.name AS posted_by
             FROM pg_vacancies p JOIN users u ON u.id=p.user_id
             WHERE p.vacancies > 0`;
  const params = [];
  const search = String(q).trim();

  if (search) {
    sql += ' AND (p.pg_name LIKE ? OR p.locality LIKE ? OR p.location LIKE ?)';
    const v = `%${search}%`;
    params.push(v, v, v);
  }
  if (maxRent) { sql += ' AND p.rent <= ?'; params.push(Number(maxRent)); }
  if (maxDistance) { sql += ' AND p.distance <= ?'; params.push(Number(maxDistance)); }
  if (gender) { sql += ' AND (p.gender_type = ? OR p.gender_type = \'Any\')'; params.push(String(gender)); }

  sql += ' ORDER BY p.distance ASC, p.rent ASC, p.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/pgs', requireAuth, (req, res) => {
  const {
    pgName, locality, rent, studentsLiving, vacancies, distance,
    location, description = '', genderType = 'Any', contact
  } = req.body;

  if (!pgName || !locality || !location || !contact) {
    return res.status(400).json({ error: 'PG name, locality, contact, and exact location are required.' });
  }

  const numeric = [Number(rent), Number(studentsLiving), Number(vacancies), Number(distance)];
  if (numeric.some(Number.isNaN) || numeric[0] < 0 || numeric[1] < 0 || numeric[2] < 1 || numeric[3] < 0) {
    return res.status(400).json({ error: 'Please enter valid numeric values.' });
  }
  if (!['Any', 'Boys', 'Girls'].includes(genderType)) {
    return res.status(400).json({ error: 'Invalid gender category.' });
  }

  const info = db.prepare(`INSERT INTO pg_vacancies
    (user_id,pg_name,locality,rent,students_living,vacancies,distance,location,description,gender_type,contact)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
      req.session.userId,
      String(pgName).trim(), String(locality).trim(), ...numeric,
      String(location).trim(), String(description).trim(), genderType, String(contact).trim()
    );

  const row = db.prepare(`SELECT p.*,u.name AS posted_by
    FROM pg_vacancies p JOIN users u ON u.id=p.user_id WHERE p.id=?`).get(info.lastInsertRowid);
  res.status(201).json({ message: 'PG vacancy published successfully.', pg: row });
});

app.put('/api/pgs/:id', requireAuth, (req, res) => {
  const { pgName, locality, rent, studentsLiving, vacancies, distance, location, description = '', genderType = 'Any', contact } = req.body;
  if (!pgName || !locality || !location || !contact) return res.status(400).json({ error: 'PG name, locality, contact, and exact location are required.' });
  const numeric = [Number(rent), Number(studentsLiving), Number(vacancies), Number(distance)];
  if (numeric.some(Number.isNaN) || numeric[0] < 0 || numeric[1] < 0 || numeric[2] < 1 || numeric[3] < 0) return res.status(400).json({ error: 'Please enter valid numeric values.' });
  if (!['Any', 'Boys', 'Girls'].includes(genderType)) return res.status(400).json({ error: 'Invalid gender category.' });
  const result = db.prepare(`UPDATE pg_vacancies SET pg_name=?, locality=?, rent=?, students_living=?, vacancies=?, distance=?, location=?, description=?, gender_type=?, contact=? WHERE id=? AND user_id=?`)
    .run(String(pgName).trim(), String(locality).trim(), ...numeric, String(location).trim(), String(description).trim(), genderType, String(contact).trim(), Number(req.params.id), req.session.userId);
  if (!result.changes) return res.status(404).json({ error: 'Vacancy not found or you are not the owner.' });
  const row = db.prepare(`SELECT p.*,u.name AS posted_by FROM pg_vacancies p JOIN users u ON u.id=p.user_id WHERE p.id=?`).get(Number(req.params.id));
  res.json({ message: 'Vacancy updated successfully.', pg: row });
});

app.delete('/api/pgs/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM pg_vacancies WHERE id=? AND user_id=?')
    .run(Number(req.params.id), req.session.userId);
  if (!result.changes) return res.status(404).json({ error: 'Vacancy not found or you are not the owner.' });
  res.json({ message: 'Vacancy deleted.' });
});

app.get('/api/my-pgs', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM pg_vacancies WHERE user_id=? ORDER BY created_at DESC').all(req.session.userId));
});

// Static frontend: HTML/CSS/JS files in /public are served by Node.js.
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'find-pg.html')));

// Keep API errors JSON instead of returning an HTML error page.
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

app.listen(PORT, () => {
  console.log(`CampusNest running at http://localhost:${PORT}`);
});
