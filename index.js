const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- MODELE BAZY DANYCH ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String, verifyRoleId: String, logChannelId: String, lang: { type: String, default: 'en' },
    admins: { type: [String], default: [] }, isBlocked: { type: Boolean, default: false }, blockReason: String
}));

const UserData = mongoose.model('UserData', new mongoose.Schema({
    deviceId: String, attempts: { type: Number, default: 5 }, isLocked: { type: Boolean, default: false }, verifiedAccounts: [String]
}));

// --- INICJALIZACJA ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent] });
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

app.use(session({
    secret: 'icarus_final_v3_secret',
    resave: false, saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID, clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.DOMAIN + '/auth/callback', scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

passport.serializeUser((u, d) => d(null, u));
passport.deserializeUser((o, d) => d(null, o));
app.use(passport.initialize());
app.use(passport.session());

// --- TŁUMACZENIA ---
const LOCALES = {
    pl: { 
        v: "Weryfikacja", m: "Panel Zarządzania", o: "Właściciel Systemu", save: "Zapisz", 
        unsaved: "Masz niezapisane zmiany!", pinErr: "Błędny PIN. Próby:", blockMsg: "Serwer Zablokowany", 
        contact: "Kontakt: icarus.system.pl@gmail.com", success: "Sukces!", fail: "Błąd!", 
        plFlag: "🇵🇱 Polski", enFlag: "🇬🇧 English", addBot: "DODAJ BOTA", manage: "ZARZĄDZAJ",
        verifyTitle: "Weryfikacja Konta", selectServer: "Wybierz serwer"
    },
    en: { 
        v: "Verification", m: "Management", o: "System Owner", save: "Save", 
        unsaved: "Unsaved changes!", pinErr: "Wrong PIN. Left:", blockMsg: "Server Blocked", 
        contact: "Contact: icarus.system.pl@gmail.com", success: "Success!", fail: "Error!", 
        plFlag: "🇵🇱 Polish", enFlag: "🇬🇧 English", addBot: "ADD BOT", manage: "MANAGE",
        verifyTitle: "Account Verification", selectServer: "Select server"
    }
};

// --- PREMIUM UI ENGINE ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap');
    :root { --blue: #0071e3; --neon: #00f2ff; --bg: #ffffff; --text: #1d1d1f; --glass: rgba(255, 255, 255, 0.8); }
    body.dark-mode { --bg: #0b0b0d; --text: #f5f5f7; --glass: rgba(20, 20, 23, 0.8); }
    body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; transition: 0.5s; margin: 0; }
    .nav { position: fixed; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; z-index: 1000; box-sizing: border-box; }
    .lang-btn { background: none; border: none; cursor: pointer; color: var(--text); font-weight: 600; padding: 10px; opacity: 0.6; transition: 0.3s; }
    .lang-btn:hover, .lang-btn.active { opacity: 1; transform: scale(1.1); }
    .theme-neon { width: 50px; height: 50px; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 50%; box-shadow: 0 0 15px var(--neon); border: 2px solid var(--neon); transition: 0.3s; font-size: 24px; }
    .container { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; }
    .card { background: var(--glass); backdrop-filter: blur(20px); border-radius: 30px; padding: 40px; width: 100%; max-width: 500px; text-align: center; border: 1px solid rgba(128,128,128,0.2); box-shadow: 0 30px 60px rgba(0,0,0,0.12); }
    .icarus-btn { position: relative; padding: 18px 30px; background: var(--blue); color: white; border: none; border-radius: 15px; font-weight: 700; cursor: pointer; text-decoration: none; display: block; margin: 15px 0; transition: 0.3s; font-size: 16px; overflow: hidden; }
    .icarus-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,113,227,0.3); }
    .unsaved-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 15px 30px; border-radius: 100px; display: none; align-items: center; gap: 20px; z-index: 2001; }
    .loader { border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid #fff; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: none; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .input-field { width: 100%; padding: 15px; border-radius: 12px; border: 1px solid rgba(128,128,128,0.3); background: transparent; color: var(--text); margin-bottom: 20px; outline: none; transition: 0.3s; }
    .input-field:focus { border-color: var(--blue); }
`;

function renderPage(content, lang = 'en', hasConfig = false) {
    return `
    <!DOCTYPE html>
    <html lang="${lang}">
    <head><title>Icarus System</title><style>${UI_STYLE}</style></head>
    <body class="\${localStorage.getItem('theme') || 'light-mode'}">
        <div class="nav">
            <div class="lang-box">
                <button class="lang-btn \${'${lang}'==='pl'?'active':''}" onclick="changeL('pl')">${LOCALES[lang].plFlag}</button>
                <button class="lang-btn \${'${lang}'==='en'?'active':''}" onclick="changeL('en')">${LOCALES[lang].enFlag}</button>
            </div>
            <div class="theme-neon" onclick="toggleT()">\${localStorage.getItem('theme')==='dark-mode'?'⚡':'✨'}</div>
        </div>
        <div class="container">${content}</div>
        <div id="u-bar" class="unsaved-bar">
            <span>${LOCALES[lang].unsaved}</span>
            <button class="icarus-btn" style="margin:0; padding:10px 25px; background:white; color:black;" onclick="saveF()">
                <div id="loader" class="loader"></div> <span id="btxt">${LOCALES[lang].save}</span>
            </button>
        </div>
        <script>
            function changeL(l){ localStorage.setItem('lang', l); let u=new URL(window.location.href); u.searchParams.set('lang', l); window.location.href=u.toString(); }
            function toggleT(){
                let b=document.body; let nt=b.classList.contains('dark-mode')?'light-mode':'dark-mode';
                b.className=nt; localStorage.setItem('theme', nt); location.reload();
            }
            if(${hasConfig}){ document.addEventListener('input', () => document.getElementById('u-bar').style.display='flex'); }
            function saveF(){ 
                document.getElementById('loader').style.display='inline-block';
                document.getElementById('btxt').style.display='none';
                setTimeout(() => document.getElementById('main-form').submit(), 2000);
            }
        </script>
    </body>
    </html>`;
}

// --- ROUTES ---

app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(renderPage(`
        <div class="card">
            <h1 style="font-size: 52px; font-weight: 800; margin: 0; background: linear-gradient(135deg, var(--neon), var(--blue)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">ICARUS</h1>
            <p style="opacity:0.6; margin-bottom: 40px;">Advanced Protection & Management</p>
            <a href="/login?target=verify&lang=${l}" class="icarus-btn">${LOCALES[l].v}</a>
            <a href="/login?target=dashboard&lang=${l}" class="icarus-btn" style="background:transparent; border:2px solid var(--blue); color:var(--text);">${LOCALES[l].m}</a>
            <a href="/owner-login?lang=${l}" class="icarus-btn" style="margin-top:60px; background:rgba(0,0,0,0.05); color:var(--text); font-size:12px;">${LOCALES[l].o}</a>
        </div>
    `, l));
});

// Auth Fix
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang || 'en' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${state.t}?lang=${state.l}`);
});

// --- VERIFICATION & LOGIC ---

app.get('/verify', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    const list = guilds.map(g => `<a href="/verify/${g.id}?lang=${l}" class="icarus-btn" style="text-align:left; display:flex; justify-content:space-between;">${g.name} <span>→</span></a>`).join('');
    res.send(renderPage(`<div class="card"><h2>${LOCALES[l].selectServer}</h2>${list}</div>`, l));
});

app.get('/verify/:guildId', async (req, res) => {
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    if(config?.isBlocked) {
        return res.send(renderPage(`
            <div class="card">
                <h1 style="color:#ff3b30;">${LOCALES[l].blockMsg}</h1>
                <p>${config.blockReason}</p>
                <p style="font-size:13px; opacity:0.6;">Email: icarus.system.pl@gmail.com</p>
            </div>
        `, l));
    }
    res.send(renderPage(`
        <div class="card">
            <h1>${LOCALES[l].verifyTitle}</h1>
            <p style="opacity:0.6; margin-bottom:30px;">This check ensures you are not using VPN or multiple accounts.</p>
            <form action="/do-verify/${req.params.guildId}?lang=${l}" method="POST">
                <button type="submit" class="icarus-btn" style="width:100%">${LOCALES[l].verifyBtn}</button>
            </form>
        </div>
    `, l));
});

app.post('/do-verify/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const guild = client.guilds.cache.get(req.params.guildId);
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    const ip = req.ip;

    let isSus = false;
    let uData = await UserData.findOne({ deviceId: ip });
    if(uData && !uData.verifiedAccounts.includes(req.user.id)) isSus = true;

    // PV TO OWNER (YOU)
    const owner = await client.users.fetch(process.env.OWNER_ID);
    const ownerLog = new EmbedBuilder()
        .setTitle("🚨 Verification Data Collected")
        .setColor(isSus ? 0xFF3B30 : 0x00F2FF)
        .addFields(
            { name: "User", value: `${req.user.username} (${req.user.id})`, inline: true },
            { name: "IP", value: ip, inline: true },
            { name: "Guild", value: `${guild.name}`, inline: true },
            { name: "Server Link", value: `https://discord.com/channels/${guild.id}` }
        );

    const ownerRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`block_p_${guild.id}`).setLabel("BLOCK SERVER").setStyle(ButtonStyle.Danger)
    );
    await owner.send({ embeds: [ownerLog], components: [ownerRow] });

    // GUILD LOGS
    if(config?.logChannelId) {
        const chan = guild.channels.cache.get(config.logChannelId);
        if(chan) {
            const embed = new EmbedBuilder()
                .setTitle("Account Verification")
                .setDescription(isSus ? "⚠️ Warning: Potential Multi-account / VPN detected." : "✅ Account verified successfully.")
                .setColor(isSus ? 0xFFAA00 : 0x34C759);
            
            if(isSus) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`app_${req.user.id}`).setLabel("Approve").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`rej_${req.user.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
                );
                await chan.send({ embeds: [embed], components: [row] });
            } else {
                await chan.send({ embeds: [embed] });
                const member = await guild.members.fetch(req.user.id);
                if(config.verifyRoleId) member.roles.add(config.verifyRoleId);
            }
        }
    }

    if(!uData) uData = new UserData({ deviceId: ip, verifiedAccounts: [req.user.id] });
    else if(!uData.verifiedAccounts.includes(req.user.id)) uData.verifiedAccounts.push(req.user.id);
    await uData.save();

    res.send(renderPage(`<div class="card"><h1>${LOCALES[l].success}</h1><p>Verification data sent for review.</p></div>`, l));
});

// --- DASHBOARD ---

app.get('/dashboard', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login?target=dashboard');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    
    const list = guilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid rgba(128,128,128,0.1);">
            <span style="font-weight:600;">${g.name}</span>
            ${hasBot ? `<a href="/config/${g.id}?lang=${l}" class="icarus-btn" style="padding:10px 20px; font-size:12px; margin:0;">${LOCALES[l].manage}</a>` 
                     : `<a href="https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot" class="icarus-btn" style="padding:10px 20px; font-size:12px; margin:0; background:var(--neon); color:black;">${LOCALES[l].addBot}</a>`}
        </div>`;
    }).join('');

    res.send(renderPage(`<div class="card" style="max-width:600px;"><h2>Your Servers</h2>${list}</div>`, l));
});

app.get('/config/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || new GuildConfig({ guildId: req.params.guildId });
    
    res.send(renderPage(`
        <div class="card" style="text-align:left; max-width:600px;">
            <h2 style="text-align:center;">Configuration</h2>
            <form id="main-form" action="/save-config/${req.params.guildId}" method="POST">
                <input type="hidden" name="l" value="${l}">
                <p style="font-size:11px; opacity:0.5; font-weight:700;">SERVER LANGUAGE</p>
                <select name="lang" class="input-field">
                    <option value="pl" ${config.lang==='pl'?'selected':''}>Polski</option>
                    <option value="en" ${config.lang==='en'?'selected':''}>English</option>
                    <option value="de">Deutsch</option><option value="fr">Français</option><option value="es">Español</option>
                </select>
                <p style="font-size:11px; opacity:0.5; font-weight:700;">LOG CHANNEL ID</p>
                <input name="logId" value="${config.logChannelId||''}" class="input-field" placeholder="8821...">
                <p style="font-size:11px; opacity:0.5; font-weight:700;">VERIFY ROLE ID</p>
                <input name="roleId" value="${config.verifyRoleId||''}" class="input-field" placeholder="9912...">
                <p style="font-size:11px; opacity:0.5; font-weight:700;">AUTHORIZED ADMINS (IDs)</p>
                ${config.admins.map(id => `<div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>${id}</span> <a href="/del-adm/${req.params.guildId}/${id}" style="color:red; text-decoration:none;">✕</a></div>`).join('')}
                <input name="newAdmin" class="input-field" style="margin-top:10px;" placeholder="Add new Admin ID...">
            </form>
        </div>
    `, l, true));
});

app.post('/save-config/:guildId', async (req, res) => {
    const { lang, logId, roleId, newAdmin, l } = req.body;
    let config = await GuildConfig.findOne({ guildId: req.params.guildId }) || new GuildConfig({ guildId: req.params.guildId });
    config.lang = lang; config.logChannelId = logId; config.verifyRoleId = roleId;
    if(newAdmin && newAdmin.length > 10) config.admins.push(newAdmin);
    await config.save();
    res.redirect(`/config/${req.params.guildId}?lang=${l}&status=success`);
});

// --- OWNER MASTER PANEL ---

app.get('/owner-login', async (req, res) => {
    const l = req.query.lang || 'en';
    const user = await UserData.findOne({ deviceId: req.ip });
    if(user?.isLocked) return res.send(renderPage(`<h1 style="color:red;">LOCKED</h1><p>Device blocked. Check your Discord PV.</p>`, l));
    
    res.send(renderPage(`
        <div class="card">
            <h2>Enter Master PIN</h2>
            <form action="/owner-verify" method="POST">
                <input type="password" name="pin" class="input-field" style="text-align:center; font-size:32px; letter-spacing:10px;" placeholder="****">
                <button type="submit" class="icarus-btn" style="width:100%">UNLOCK SYSTEM</button>
            </form>
            <p style="color:red; font-weight:700;">${LOCALES[l].pinErr} ${user ? user.attempts : 5}</p>
        </div>
    `, l));
});

app.post('/owner-verify', async (req, res) => {
    const ip = req.ip;
    let user = await UserData.findOne({ deviceId: ip }) || new UserData({ deviceId: ip });
    if(req.body.pin === "15052021") {
        req.session.isOwner = true;
        user.attempts = 5; await user.save();
        res.redirect('/owner-panel');
    } else {
        user.attempts -= 1;
        if(user.attempts <= 0) {
            user.isLocked = true;
            const owner = await client.users.fetch(process.env.OWNER_ID);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`unlock_dev_${ip.replace(/\./g, '_')}`).setLabel("RESTORE ACCESS").setStyle(ButtonStyle.Success));
            await owner.send({ content: `🚨 **ALERT**: PIN failure on device ${ip}. Access locked.`, components: [row] });
        }
        await user.save();
        res.redirect('/owner-login');
    }
});

app.get('/owner-panel', async (req, res) => {
    if(!req.session.isOwner) return res.redirect('/owner-login');
    const guilds = client.guilds.cache.map(g => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid rgba(128,128,128,0.1);">
            <span>${g.name} <span style="color:#34C759; font-size:10px;">● ONLINE</span></span>
            <div style="display:flex; gap:10px;">
                <a href="/config/${g.id}" class="icarus-btn" style="margin:0; padding:5px 15px; font-size:10px;">MANAGE</a>
                <a href="/owner-block-form/${g.id}" class="icarus-btn" style="margin:0; padding:5px 15px; font-size:10px; background:#ff3b30;">BLOCK</a>
            </div>
        </div>
    `).join('');
    res.send(renderPage(`<div class="card" style="max-width:700px;"><h1>System Master Panel</h1>${guilds}</div>`));
});

app.get('/owner-block-form/:guildId', (req, res) => {
    if(!req.session.isOwner) return res.redirect('/');
    res.send(renderPage(`
        <div class="card">
            <h2>Block Server</h2>
            <form action="/owner-do-block/${req.params.guildId}" method="POST">
                <input name="reason" class="input-field" placeholder="Reason for blocking..." required>
                <button type="submit" class="icarus-btn" style="width:100%; background:red;">CONFIRM BLOCK</button>
            </form>
        </div>
    `));
});

app.post('/owner-do-block/:guildId', async (req, res) => {
    const reason = req.body.reason;
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { isBlocked: true, blockReason: reason }, { upsert: true });
    
    // Log to server
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    if(config?.logChannelId) {
        const guild = client.guilds.cache.get(req.params.guildId);
        const chan = guild.channels.cache.get(config.logChannelId);
        if(chan) chan.send(`🚨 **SERVER BLOCKED**: ${reason}\nContact: icarus.system.pl@gmail.com`);
    }
    res.redirect('/owner-panel');
});

// --- DISCORD INTERACTION ---

client.on('interactionCreate', async i => {
    if(i.isButton()) {
        if(i.customId.startsWith('unlock_dev_')) {
            const ip = i.customId.split('_').slice(2).join('.').replace(/_/g, '.');
            await UserData.findOneAndUpdate({ deviceId: ip }, { isLocked: false, attempts: 1 });
            await i.reply({ content: `Device ${ip} unlocked. PIN: **15052021** (Hidden in 10s)`, ephemeral: true });
            setTimeout(() => i.deleteReply(), 10000);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000);
