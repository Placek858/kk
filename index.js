const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');

// --- SCHEMATY BAZY DANYCH ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String,
    logChannelId: String,
    lang: { type: String, default: 'en' },
    admins: [String],
    isBlocked: { type: Boolean, default: false },
    blockReason: String
}));

const UserData = mongoose.model('UserData', new mongoose.Schema({
    userId: String,
    attempts: { type: Number, default: 5 },
    isLocked: { type: Boolean, default: false },
    deviceId: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({
    userId: String,
    guildId: String,
    status: String,
    details: Object,
    ip: String
}));

// --- INICJALIZACJA ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

app.use(session({
    secret: 'icarus_ultra_secret_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.DOMAIN + '/auth/callback',
    scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

passport.serializeUser((u, d) => d(null, u));
passport.deserializeUser((o, d) => d(null, o));
app.use(passport.initialize());
app.use(passport.session());

// --- TRANSLACJE ---
const LOCALES = {
    pl: { v: "Weryfikacja Konta", m: "Panel Zarządzania", o: "Panel Właściciela", save: "Zapisz", success: "Zapisano!", error: "Błąd!", unsaved: "Niezapisane zmiany!", blockMsg: "Serwer zablokowany.", contact: "Kontakt:" },
    en: { v: "Verify Account", m: "Management Panel", o: "Owner Portal", save: "Save", success: "Saved!", error: "Error!", unsaved: "Unsaved changes!", blockMsg: "Server blocked.", contact: "Contact:" },
    de: { v: "Verifizieren", m: "Verwaltung", o: "Besitzer", save: "Speichern", success: "Gespeichert!", error: "Fehler!", unsaved: "Ungespeicherte Änderungen!", blockMsg: "Server blockiert.", contact: "Kontakt:" },
    fr: { v: "Vérifier", m: "Gestion", o: "Propriétaire", save: "Enregistrer", success: "Enregistré!", error: "Erreur!", unsaved: "Changements non enregistrés!", blockMsg: "Serveur bloqué.", contact: "Contact:" },
    es: { v: "Verificar", m: "Gestión", o: "Propietario", save: "Guardar", success: "Guardado!", error: "Error!", unsaved: "Cambios sin guardar!", blockMsg: "Servidor bloqueado.", contact: "Contacto:" }
};

// --- UI STYLE ---
const UI_STYLE = `
    :root { --accent: #0071e3; --neon: #00f2ff; --bg: #ffffff; --text: #1d1d1f; --card: rgba(255,255,255,0.8); }
    body.dark-mode { --bg: #000000; --text: #f5f5f7; --card: rgba(28,28,30,0.8); --accent: #0a84ff; }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; transition: 0.5s; overflow-x: hidden; }
    .top-bar { position: fixed; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; z-index: 1000; box-sizing: border-box; }
    .lang-switcher { display: flex; gap: 10px; background: var(--card); backdrop-filter: blur(20px); padding: 10px; border-radius: 50px; border: 1px solid rgba(128,128,128,0.2); }
    .lang-switcher span { cursor: pointer; transition: 0.3s; }
    .neon-toggle { width: 50px; height: 50px; border-radius: 15px; background: var(--card); display: flex; align-items: center; justify-content: center; font-size: 24px; cursor: pointer; border: 2px solid var(--neon); box-shadow: 0 0 15px var(--neon); }
    .container { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
    .card { background: var(--card); backdrop-filter: blur(30px); padding: 40px; border-radius: 30px; width: 100%; max-width: 500px; text-align: center; border: 1px solid rgba(128,128,128,0.1); box-shadow: 0 30px 60px rgba(0,0,0,0.1); }
    .btn { width: 100%; padding: 16px; border-radius: 14px; border: none; font-size: 16px; font-weight: 600; margin: 10px 0; cursor: pointer; transition: 0.3s; text-decoration: none; display: flex; align-items: center; justify-content: center; }
    .btn-blue { background: var(--accent); color: white; }
    .btn-glass { background: rgba(128,128,128,0.1); color: var(--text); }
    .loader-wheel { border: 3px solid #f3f3f3; border-top: 3px solid var(--accent); border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: none; margin-left: 10px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    #unsaved-bar { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--accent); color: white; padding: 15px 30px; border-radius: 50px; display: none; align-items: center; gap: 20px; z-index: 2000; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 5px; }
    .online { background: #34c759; box-shadow: 0 0 10px #34c759; }
`;

const getWrapper = (content, lang = 'en') => `
    <html>
    <head><style>${UI_STYLE}</style></head>
    <body class="\${localStorage.getItem('theme') === 'dark' ? 'dark-mode' : ''}">
        <div class="top-bar">
            <div class="lang-switcher">
                <span onclick="setLang('pl')">🇵🇱</span> <span onclick="setLang('en')">🇬🇧</span>
                <span onclick="setLang('de')">🇩🇪</span> <span onclick="setLang('fr')">🇫🇷</span> <span onclick="setLang('es')">🇲🇽</span>
            </div>
            <div class="neon-toggle" onclick="toggleTheme()">🌓</div>
        </div>
        <div class="container">${content}</div>
        <div id="unsaved-bar"><span>${LOCALES[lang]?.unsaved || 'Unsaved changes!'}</span><button class="btn-blue" style="width:auto; padding:8px 20px;" onclick="saveConfig()">Zapisz</button></div>
        <script>
            function setLang(l) { localStorage.setItem('lang', l); location.href = location.pathname + '?lang=' + l; }
            function toggleTheme() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); }
            
            let originalForm = "";
            function checkChanges() {
                if(!document.querySelector('form')) return;
                let currentForm = new FormData(document.querySelector('form'));
                let changed = false;
                for(let pair of currentForm.entries()) { if(pair[1] !== originalForm.get(pair[0])) changed = true; }
                document.getElementById('unsaved-bar').style.display = changed ? 'flex' : 'none';
            }

            async function removeAdmin(adminId) {
                if(confirm('Usunąć admina ' + adminId + '?')) {
                    const r = await fetch(window.location.pathname + '/remove-admin', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ adminId })
                    });
                    if(r.ok) location.reload();
                }
            }

            window.onload = () => { 
                if(document.querySelector('form')) {
                    originalForm = new FormData(document.querySelector('form'));
                    document.querySelector('form').addEventListener('input', checkChanges);
                }
            };
        </script>
    </body>
    </html>
`;

// --- ROUTY GŁÓWNE ---
app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    const t = LOCALES[l] || LOCALES.en;
    res.send(getWrapper(`
        <div class="card">
            <h1>Icarus</h1>
            <p style="opacity:0.5; margin-bottom:40px;">Next-Gen Security</p>
            <a href="/login?target=verify" class="btn btn-blue">${t.v}</a>
            <a href="/login?target=dashboard" class="btn btn-glass">${t.m}</a>
            <a href="/owner-login" class="btn btn-glass" style="margin-top:40px; border:1px solid var(--neon); color:var(--neon)">${t.o}</a>
        </div>
    `, l));
});

// --- AUTORYZACJA ---
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + state.t);
});

// --- OWNER LOGIN ---
app.get('/owner-login', async (req, res) => {
    const user = await UserData.findOne({ deviceId: req.ip });
    if(user?.isLocked) return res.send("<h1>LOCKED</h1>");
    res.send(getWrapper(`
        <div class="card">
            <h1>Authorize</h1>
            <form action="/owner-verify" method="POST">
                <input type="password" name="pin" class="btn btn-glass" style="text-align:center" placeholder="PIN">
                <button class="btn btn-blue">Enter</button>
                <small>Attempts: ${user ? user.attempts : 5}</small>
            </form>
        </div>
    `));
});

app.post('/owner-verify', async (req, res) => {
    const { pin } = req.body;
    let user = await UserData.findOne({ deviceId: req.ip }) || new UserData({ deviceId: req.ip });
    if(pin === "15052021") {
        user.attempts = 5; await user.save();
        req.session.isOwner = true;
        res.redirect('/owner-panel');
    } else {
        user.attempts -= 1;
        if(user.attempts <= 0) user.isLocked = true;
        await user.save();
        res.redirect('/owner-login');
    }
});

// --- DASHBOARD & CONFIG ---
app.get('/dashboard', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let list = guilds.map(g => `
        <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
            <span>${g.name}</span>
            <a href="/config/${g.id}" class="btn-blue" style="width:auto; padding:5px 10px; border-radius:5px; font-size:12px;">Manage</a>
        </div>
    `).join('');
    res.send(getWrapper(`<div class="card"><h1>Servers</h1>${list}</div>`));
});

app.get('/config/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login');
    const { guildId } = req.params;
    const config = await GuildConfig.findOne({ guildId }) || new GuildConfig({ guildId });
    const guild = client.guilds.cache.get(guildId);
    if(!guild) return res.send("Bot not on server.");
    
    res.send(getWrapper(`
        <div class="card" style="text-align:left">
            <h3>Config: ${guild.name}</h3>
            <form id="configForm" onsubmit="event.preventDefault(); saveConfig();">
                <label>Lang:</label>
                <select name="lang" class="btn btn-glass">
                    <option value="pl" ${config.lang==='pl'?'selected':''}>PL</option>
                    <option value="en" ${config.lang==='en'?'selected':''}>EN</option>
                </select>
                <label>Log Channel ID:</label>
                <input name="logChannelId" value="${config.logChannelId||''}" class="btn btn-glass">
                <label>Verify Role ID:</label>
                <input name="verifyRoleId" value="${config.verifyRoleId||''}" class="btn btn-glass">
                <label>Add Admin ID:</label>
                <input name="newAdmin" class="btn btn-glass">
                <div id="adminList">${config.admins.map(id => `<div style="font-size:12px;">${id} <span onclick="removeAdmin('${id}')" style="color:red; cursor:pointer">X</span></div>`).join('')}</div>
                <button type="submit" class="btn btn-blue">Save <div id="btnLoader" class="loader-wheel"></div></button>
            </form>
            <script>
                async function saveConfig() {
                    document.getElementById('btnLoader').style.display='inline-block';
                    const data = Object.fromEntries(new FormData(document.getElementById('configForm')));
                    const r = await fetch('/api/save-config/${guildId}', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(data)
                    });
                    if(r.ok) location.reload();
                }
            </script>
        </div>
    `));
});

app.post('/api/save-config/:guildId', async (req, res) => {
    const { lang, logChannelId, verifyRoleId, newAdmin } = req.body;
    let config = await GuildConfig.findOne({ guildId: req.params.guildId }) || new GuildConfig({ guildId: req.params.guildId });
    config.lang = lang;
    config.logChannelId = logChannelId;
    config.verifyRoleId = verifyRoleId;
    if(newAdmin && !config.admins.includes(newAdmin)) config.admins.push(newAdmin);
    await config.save();
    res.json({ success: true });
});

app.post('/config/:guildId/remove-admin', async (req, res) => {
    const { adminId } = req.body;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { $pull: { admins: adminId } });
    res.sendStatus(200);
});

// --- OWNER PANEL ---
app.get('/owner-panel', async (req, res) => {
    if(!req.session.isOwner) return res.redirect('/owner-login');
    const guildData = client.guilds.cache.map(g => ({ id: g.id, name: g.name }));
    res.send(getWrapper(`
        <div class="card">
            <h1>Owner Panel</h1>
            ${guildData.map(g => `<div style="padding:10px; border-bottom:1px solid #eee;">${g.name} <button onclick="blockGuild('${g.id}')" style="color:red">Block</button></div>`).join('')}
        </div>
        <script>
            function blockGuild(id) {
                const r = prompt("Reason:");
                if(r) fetch('/api/block-guild', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ guildId: id, reason: r })}).then(()=>location.reload());
            }
        </script>
    `));
});

app.post('/api/block-guild', async (req, res) => {
    if(!req.session.isOwner) return res.sendStatus(403);
    await GuildConfig.findOneAndUpdate({ guildId: req.body.guildId }, { isBlocked: true, blockReason: req.body.reason });
    res.json({ success: true });
});

app.listen(process.env.PORT || 3000, () => console.log("Icarus Online."));
client.login(process.env.DISCORD_TOKEN);
