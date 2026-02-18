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
    admins: [String], // Lista ID użytkowników z dostępem do panelu
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

// --- TRANSLACJE (5 JĘZYKÓW) ---
const LOCALES = {
    pl: { v: "Weryfikacja Konta", m: "Panel Zarządzania", o: "Panel Właściciela", save: "Zapisz", success: "Zapisano pomyślnie!", error: "Błąd zapisu!", unsaved: "Masz niezapisane zmiany!", blockMsg: "Serwer zablokowany przez Administratora.", contact: "Kontakt:" },
    en: { v: "Verify Account", m: "Management Panel", o: "Owner Portal", save: "Save", success: "Saved successfully!", error: "Save error!", unsaved: "You have unsaved changes!", blockMsg: "Server blocked by Administrator.", contact: "Contact:" },
    de: { v: "Konto verifizieren", m: "Verwaltungspanel", o: "Besitzerportal", save: "Speichern", success: "Erfolgreich gespeichert!", error: "Fehler beim Speichern!", unsaved: "Sie haben ungespeicherte Änderungen!", blockMsg: "Server vom Administrator blockiert.", contact: "Kontakt:" },
    fr: { v: "Vérifier le compte", m: "Panneau de gestion", o: "Portail propriétaire", save: "Enregistrer", success: "Enregistré avec succès!", error: "Erreur d'enregistrement!", unsaved: "Vous avez des modifications non enregistrées!", blockMsg: "Serveur bloqué par l'administrateur.", contact: "Contact:" },
    es: { v: "Verificar cuenta", m: "Panel de gestión", o: "Portal del propietario", save: "Guardar", success: "¡Guardado con éxito!", error: "¡Error al guardar!", unsaved: "¡Tienes cambios sin guardar!", blockMsg: "Servidor bloqueado por el Administrador.", contact: "Contacto:" }
};

// --- LUXURY UI SYSTEM ---
const UI_STYLE = `
    :root { --accent: #0071e3; --neon: #00f2ff; --bg: #ffffff; --text: #1d1d1f; --card: rgba(255,255,255,0.8); }
    body.dark-mode { --bg: #000000; --text: #f5f5f7; --card: rgba(28,28,30,0.8); --accent: #0a84ff; }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; transition: 0.5s; overflow-x: hidden; }
    
    .top-bar { position: fixed; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; z-index: 1000; }
    .lang-switcher { display: flex; gap: 10px; background: var(--card); backdrop-filter: blur(20px); padding: 10px 20px; border-radius: 50px; border: 1px solid rgba(128,128,128,0.2); }
    .lang-switcher span { cursor: pointer; font-size: 14px; opacity: 0.7; transition: 0.3s; }
    .lang-switcher span:hover { opacity: 1; transform: scale(1.1); }

    .neon-toggle { width: 50px; height: 50px; border-radius: 15px; background: var(--card); display: flex; align-items: center; justify-content: center; font-size: 24px; cursor: pointer; border: 2px solid var(--neon); box-shadow: 0 0 15px var(--neon); transition: 0.3s; }
    .neon-toggle:hover { transform: scale(1.1); box-shadow: 0 0 25px var(--neon); }

    .container { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 20px; box-sizing: border-box; }
    .card { background: var(--card); backdrop-filter: blur(30px); padding: 40px; border-radius: 30px; width: 100%; max-width: 500px; text-align: center; border: 1px solid rgba(128,128,128,0.1); box-shadow: 0 30px 60px rgba(0,0,0,0.1); position: relative; }
    
    .btn { width: 100%; padding: 16px; border-radius: 14px; border: none; font-size: 16px; font-weight: 600; margin: 10px 0; cursor: pointer; transition: 0.3s; text-decoration: none; display: flex; align-items: center; justify-content: center; }
    .btn-blue { background: var(--accent); color: white; }
    .btn-glass { background: rgba(128,128,128,0.1); color: var(--text); }
    .btn:hover { opacity: 0.8; transform: translateY(-2px); }

    .loader-wheel { border: 3px solid #f3f3f3; border-top: 3px solid var(--accent); border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: none; margin-left: 10px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    #unsaved-bar { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--accent); color: white; padding: 15px 30px; border-radius: 50px; display: none; align-items: center; gap: 20px; z-index: 2000; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 5px; }
    .online { background: #34c759; box-shadow: 0 0 10px #34c759; }
    .offline { background: #ff3b30; box-shadow: 0 0 10px #ff3b30; }
`;

const getWrapper = (content, lang = 'en') => `
    <html>
    <head>
        <title>Icarus System</title>
        <style>${UI_STYLE}</style>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    </head>
    <body class="\${localStorage.getItem('theme') === 'dark' ? 'dark-mode' : ''}">
        <div class="top-bar">
            <div class="lang-switcher">
                <span onclick="setLang('pl')">🇵🇱 PL</span>
                <span onclick="setLang('en')">🇬🇧 EN</span>
                <span onclick="setLang('de')">🇩🇪 DE</span>
                <span onclick="setLang('fr')">🇫🇷 FR</span>
                <span onclick="setLang('es')">🇲🇽 ES</span>
            </div>
            <div class="neon-toggle" onclick="toggleTheme()">🌓</div>
        </div>
        <div class="container">${content}</div>
        <div id="unsaved-bar">
            <span>${LOCALES[lang].unsaved}</span>
            <button class="btn-blue" style="width:auto; padding:8px 20px;" onclick="saveConfig()">Zapisz teraz</button>
        </div>
        <script>
            function setLang(l) { localStorage.setItem('lang', l); location.href = location.pathname + '?lang=' + l; }
            function toggleTheme() { 
                document.body.classList.toggle('dark-mode'); 
                localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); 
            }
            let originalForm = "";
            window.onload = () => { if(document.querySelector('form')) originalForm = new FormData(document.querySelector('form')); };
            function checkChanges() {
                if(!document.querySelector('form')) return;
                let currentForm = new FormData(document.querySelector('form'));
                let changed = false;
                for(let pair of currentForm.entries()) { if(pair[1] !== originalForm.get(pair[0])) changed = true; }
                document.getElementById('unsaved-bar').style.display = changed ? 'flex' : 'none';
            }
            if(document.querySelector('form')) document.querySelector('form').addEventListener('input', checkChanges);
        </script>
    </body>
    </html>
`;

// --- ROUTY ---

app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    const t = LOCALES[l] || LOCALES.en;
    res.send(getWrapper(`
        <div class="card">
            <h1 style="font-size:45px; margin:0;">Icarus</h1>
            <p style="opacity:0.5; margin-bottom:40px;">Next-Gen Security & Protection</p>
            <a href="/login?target=verify" class="btn btn-blue">${t.v}</a>
            <a href="/login?target=dashboard" class="btn btn-glass">${t.m}</a>
            <a href="/owner-login" class="btn btn-glass" style="margin-top:40px; border:1px solid var(--neon); color:var(--neon)">${t.o}</a>
        </div>
    `, l));
});

// PANEL KONFIGURACJI SERWERA (Zarządzanie)
app.get('/config/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login');
    const { guildId } = req.params;
    const l = req.query.lang || 'en';
    const t = LOCALES[l];
    
    const config = await GuildConfig.findOne({ guildId }) || new GuildConfig({ guildId });
    const guild = client.guilds.cache.get(guildId);

    if(!guild || (guild.ownerId !== req.user.id && !config.admins.includes(req.user.id))) return res.send("Brak uprawnień.");

    res.send(getWrapper(`
        <div class="card" style="text-align:left;">
            <h2>Konfiguracja: ${guild.name}</h2>
            <form id="configForm" onsubmit="event.preventDefault(); saveConfig();">
                <label>Język Bota:</label>
                <select name="lang" class="btn btn-glass" style="width:100%; margin-bottom:15px;">
                    <option value="pl" ${config.lang === 'pl' ? 'selected' : ''}>Polski</option>
                    <option value="en" ${config.lang === 'en' ? 'selected' : ''}>English</option>
                    <option value="de" ${config.lang === 'de' ? 'selected' : ''}>Deutsch</option>
                    <option value="fr" ${config.lang === 'fr' ? 'selected' : ''}>Français</option>
                    <option value="es" ${config.lang === 'es' ? 'selected' : ''}>Español</option>
                </select>

                <label>ID Kanału Logów:</label>
                <input name="logChannelId" value="${config.logChannelId || ''}" class="btn btn-glass" placeholder="ID kanału">
                
                <label>ID Roli Weryfikacyjnej:</label>
                <input name="verifyRoleId" value="${config.verifyRoleId || ''}" class="btn btn-glass" placeholder="ID roli">

                <label>Dodaj Administratora Paneli (ID):</label>
                <input name="newAdmin" class="btn btn-glass" placeholder="Wpisz ID użytkownika">
                
                <div style="margin-top:10px;">
                    <small>Aktualni Admini:</small>
                    <div id="adminList">
                        ${config.admins.map(id => `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${id}</span> <span style="color:red; cursor:pointer;" onclick="removeAdmin('${id}')">X</span></div>`).join('')}
                    </div>
                </div>

                <button type="submit" class="btn btn-blue" style="margin-top:20px;">
                    <span>${t.save}</span>
                    <div id="btnLoader" class="loader-wheel"></div>
                </button>
            </form>
            <div id="saveResult" style="text-align:center; margin-top:10px; font-weight:bold;"></div>
        </div>
        <script>
            async function saveConfig() {
                const btn = document.getElementById('btnLoader');
                const resDiv = document.getElementById('saveResult');
                btn.style.display = 'inline-block';
                resDiv.innerText = "";
                
                const formData = new FormData(document.getElementById('configForm'));
                const data = Object.fromEntries(formData.entries());
                
                try {
                    const r = await fetch('/api/save-config/${guildId}', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(data)
                    });
                    const res = await r.json();
                    setTimeout(() => {
                        btn.style.display = 'none';
                        resDiv.innerText = res.success ? "${t.success}" : "${t.error} " + res.reason;
                        resDiv.style.color = res.success ? "#34c759" : "#ff3b30";
                        if(res.success) { originalForm = new FormData(document.getElementById('configForm')); checkChanges(); }
                    }, 1500);
                } catch(e) { btn.style.display = 'none'; }
            }
        </script>
    `, l));
});

// API ZAPISU
app.post('/api/save-config/:guildId', async (req, res) => {
    const { guildId } = req.params;
    const { lang, logChannelId, verifyRoleId, newAdmin } = req.body;
    try {
        let config = await GuildConfig.findOne({ guildId }) || new GuildConfig({ guildId });
        config.lang = lang;
        config.logChannelId = logChannelId;
        config.verifyRoleId = verifyRoleId;
        if(newAdmin && newAdmin.length > 5 && !config.admins.includes(newAdmin)) config.admins.push(newAdmin);
        await config.save();
        res.json({ success: true });
    } catch(e) {
        res.json({ success: false, reason: e.message });
    }
});

// PANEL WŁAŚCICIELA SYSTEMU (Ty)
app.get('/owner-panel', async (req, res) => {
    if(!req.session.isOwner) return res.redirect('/owner-login');
    const guilds = client.guilds.cache.map(async g => {
        const config = await GuildConfig.findOne({ guildId: g.id });
        return {
            id: g.id,
            name: g.name,
            online: true,
            blocked: config?.isBlocked || false
        };
    });
    const guildData = await Promise.all(guilds);

    res.send(getWrapper(`
        <div class="card" style="max-width:800px;">
            <h1>Master Control Panel</h1>
            <div style="text-align:left; margin-top:20px;">
                ${guildData.map(g => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid rgba(128,128,128,0.1);">
                        <div>
                            <span class="status-dot online"></span>
                            <b>${g.name}</b> <small>(${g.id})</small>
                            ${g.blocked ? '<br><span style="color:red; font-size:12px;">ZABLOKOWANY</span>' : ''}
                        </div>
                        <div style="display:flex; gap:10px;">
                            <a href="/config/${g.id}" class="btn-blue" style="width:auto; padding:5px 15px; font-size:12px;">Ustawienia</a>
                            <button onclick="blockGuild('${g.id}')" class="btn-glass" style="width:auto; padding:5px 15px; color:red; border:1px solid red;">X</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <script>
            function blockGuild(id) {
                const reason = prompt("Podaj powód blokady:");
                if(reason) {
                    fetch('/api/block-guild', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ guildId: id, reason: reason })
                    }).then(() => location.reload());
                }
            }
        </script>
    `));
});

// Obsługa blokady przez API (używane w Panelu Właściciela i Discordzie)
app.post('/api/block-guild', async (req, res) => {
    if(!req.session.isOwner && req.user?.id !== process.env.OWNER_ID) return res.sendStatus(403);
    const { guildId, reason } = req.body;
    
    await GuildConfig.findOneAndUpdate({ guildId }, { isBlocked: true, blockReason: reason });
    const guild = client.guilds.cache.get(guildId);
    const config = await GuildConfig.findOne({ guildId });
    
    // Log na serwer
    const logChan = guild?.channels.cache.get(config?.logChannelId);
    if(logChan) {
        const t = LOCALES[config.lang || 'en'];
        const embed = new EmbedBuilder()
            .setTitle('🚫 SYSTEM ALERT')
            .setDescription(`**${t.blockMsg}**\n\n**Reason:** ${reason}\n\n${t.contact} icarus.system.pl@gmail.com`)
            .setColor('#ff3b30');
        logChan.send({ embeds: [embed] });
    }
    res.json({ success: true });
});

// Logika przycisków Discord (Zatwierdzanie/Odrzucanie przez Admina Serwera)
client.on('interactionCreate', async (i) => {
    if(!i.isButton()) return;

    if(i.customId.startsWith('approve_') || i.customId.startsWith('deny_')) {
        const [action, userId, guildId] = i.customId.split('_');
        const guild = client.guilds.cache.get(guildId);
        const config = await GuildConfig.findOne({ guildId });

        if(action === 'approve') {
            const member = await guild.members.fetch(userId);
            await member.roles.add(config.verifyRoleId);
            await i.update({ content: `✅ Użytkownik <@${userId}> zatwierdzony przez <@${i.user.id}>`, components: [], embeds: [] });
        } else {
            // Pokazujemy formularz powodu na Discordzie
            const modal = new ModalBuilder().setCustomId(`deny_modal_${userId}_${guildId}`).setTitle('Powód odrzucenia');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Dlaczego odrzucasz?').setStyle(TextInputStyle.Paragraph)));
            await i.showModal(modal);
        }
    }
});

// Start wszystkiego
app.listen(process.env.PORT || 3000, () => console.log("Icarus Live."));
client.login(process.env.DISCORD_TOKEN);
