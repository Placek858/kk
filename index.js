const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType, PermissionsBitField 
} = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

// --- SCHEMATY ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String,
    logChannelId: String,
    lang: { type: String, default: 'en' },
    admins: { type: [String], default: [] },
    isBlocked: { type: Boolean, default: false },
    blockReason: String
}));

const UserData = mongoose.model('UserData', new mongoose.Schema({
    deviceId: String,
    attempts: { type: Number, default: 5 },
    isLocked: { type: Boolean, default: false },
    verifiedAccounts: { type: [String], default: [] }
}));

// --- SESJA I AUTH ---
app.use(session({
    secret: 'icarus_pro_v3',
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: `${process.env.DOMAIN}/auth/callback`,
    scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

passport.serializeUser((u, d) => d(null, u));
passport.deserializeUser((o, d) => d(null, o));
app.use(passport.initialize());
app.use(passport.session());

// --- TRANSLACJE ---
const translations = {
    pl: {
        verify: "Weryfikacja Konta", manage: "Panel Zarządzania", owner: "Panel Właściciela Systemu",
        save: "Zapisz Zmiany", unsaved: "Masz niezapisane zmiany!", success: "Zmiany zapisane!",
        fail: "Wystąpił błąd!", blocked: "SERWER ZABLOKOWANY", contact: "Kontakt: icarus.system.pl@gmail.com",
        pin_err: "PIN nieprawidłowy! Pozostało prób: ", select: "Wybierz serwer", online: "Działa", offline: "Offline",
        add: "Dodaj Bota", block_btn: "ZABLOKUJ", reason: "Powód blokady"
    },
    en: {
        verify: "Account Verification", manage: "Management Panel", owner: "System Owner Panel",
        save: "Save Changes", unsaved: "Unsaved changes detected!", success: "Changes saved!",
        fail: "An error occurred!", blocked: "SERVER BLOCKED", contact: "Contact: icarus.system.pl@gmail.com",
        pin_err: "Invalid PIN! Attempts left: ", select: "Select server", online: "Online", offline: "Offline",
        add: "Add Bot", block_btn: "BLOCK", reason: "Block reason"
    }
};

// --- SILNIK UI (APPLE STYLE) ---
const render = (content, lang = 'en', state = { hasForm: false }) => {
    const t = translations[lang] || translations.en;
    return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap');
        :root { --blue: #0071e3; --bg: #ffffff; --text: #1d1d1f; --card: #f5f5f7; --neon: #00f2ff; }
        body.dark { --bg: #0b0b0b; --text: #f5f5f7; --card: #1c1c1e; --neon: #bf00ff; }
        body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; transition: 0.5s; margin: 0; overflow-x: hidden; }
        .nav { position: fixed; top: 0; width: 100%; padding: 30px 50px; display: flex; justify-content: space-between; box-sizing: border-box; z-index: 1000; }
        .lang a { text-decoration: none; color: var(--text); font-weight: 700; margin-right: 15px; opacity: 0.3; }
        .lang a.active { opacity: 1; border-bottom: 2px solid var(--blue); }
        .theme-ico { font-size: 32px; cursor: pointer; filter: drop-shadow(0 0 10px var(--neon)); transition: 0.3s; }
        .container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 100px 20px; }
        .card { background: var(--card); padding: 50px; border-radius: 40px; width: 100%; max-width: 500px; text-align: center; box-shadow: 0 40px 100px rgba(0,0,0,0.1); }
        .btn { display: flex; align-items: center; justify-content: center; padding: 18px; border-radius: 16px; background: var(--blue); color: white; text-decoration: none; font-weight: 700; border: none; cursor: pointer; margin: 10px 0; width: 100%; transition: 0.3s; font-size: 16px; }
        .btn-alt { background: transparent; border: 2px solid var(--blue); color: var(--text); }
        input, select { width: 100%; padding: 16px; border-radius: 12px; border: 1px solid rgba(128,128,128,0.2); background: var(--bg); color: var(--text); margin-bottom: 15px; box-sizing: border-box; }
        .row-item { display: flex; justify-content: space-between; align-items: center; background: rgba(128,128,128,0.1); padding: 12px 20px; border-radius: 14px; margin-bottom: 8px; }
        .x-btn { color: #ff3b30; text-decoration: none; font-weight: 800; font-size: 18px; cursor: pointer; }
        .u-bar { position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 15px 40px; border-radius: 50px; display: none; align-items: center; gap: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); z-index: 2000; }
        .loader { border: 3px solid #f3f3f3; border-top: 3px solid var(--blue); border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: none; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="\${localStorage.getItem('mode') || ''}">
    <div class="nav">
        <div class="lang">
            <a href="?lang=pl" class="\${'${lang}'==='pl'?'active':''}">🇵🇱 Polski</a>
            <a href="?lang=en" class="\${'${lang}'==='en'?'active':''}">🇬🇧 English</a>
        </div>
        <div class="theme-ico" onclick="tgl()">\${localStorage.getItem('mode') === 'dark' ? '🔮' : '💡'}</div>
    </div>
    <div class="container">${content}</div>
    <div id="u-bar" class="u-bar">
        <span>${t.unsaved}</span>
        <button class="btn" style="width:auto; padding:8px 25px; background:white; color:black; margin:0;" onclick="send()">
            <div id="ld" class="loader"></div> ${t.save}
        </button>
    </div>
    <script>
        function tgl() {
            const b = document.body;
            b.classList.toggle('dark');
            localStorage.setItem('mode', b.classList.contains('dark') ? 'dark' : 'light');
            location.reload();
        }
        function send() {
            document.getElementById('ld').style.display = 'inline-block';
            setTimeout(() => document.forms[0].submit(), 2500);
        }
        if(${state.hasForm}) {
            document.querySelectorAll('input, select').forEach(i => i.oninput = () => document.getElementById('u-bar').style.display = 'flex');
        }
    </script>
</body>
</html>`;
};

// --- [STRONA GŁÓWNA] ---
app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(render(`
        <div class="card">
            <h1 style="font-size: 60px; margin: 0; letter-spacing: -4px;">Icarus</h1>
            <p style="opacity:0.4; margin-bottom: 50px;">Corporate Security Solutions</p>
            <a href="/login?target=select-srv&lang=${l}" class="btn">${translations[l].verify}</a>
            <a href="/login?target=dashboard&lang=${l}" class="btn btn-alt">${translations[l].manage}</a>
            <a href="/owner-auth?lang=${l}" class="btn" style="background:none; color:gray; font-size:12px; margin-top:40px;">${translations[l].owner}</a>
        </div>`, l));
});

// --- [AUTORYZACJA] ---
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${state.t}?lang=${state.l || 'en'}`);
});

// --- [WERYFIKACJA - WYBÓR] ---
app.get('/select-srv', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    const list = guilds.map(g => `<a href="/verify-final/${g.id}?lang=${l}" class="btn btn-alt">${g.name}</a>`).join('');
    res.send(render(`<div class="card"><h2>${translations[l].select}</h2>${list}</div>`, l));
});

app.get('/verify-final/:guildId', async (req, res) => {
    const l = req.query.lang || 'en';
    const conf = await GuildConfig.findOne({ guildId: req.params.guildId });
    if(conf?.isBlocked) return res.send(render(`<div class="card"><h1 style="color:#ff3b30;">${translations[l].blocked}</h1><p>${conf.blockReason}</p><p style="margin-top:30px; font-size:12px; opacity:0.5;">${translations[l].contact}</p></div>`, l));
    res.send(render(`<div class="card"><h2>${translations[l].verify}</h2><form action="/proc-v/${req.params.guildId}?lang=${l}" method="POST"><button class="btn">KLIKNIJ ABY ZWERYFIKOWAĆ</button></form></div>`, l));
});

// --- [PANEL ZARZĄDZANIA] ---
app.get('/dashboard', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => (new PermissionsBitField(BigInt(g.permissions)).has(PermissionsBitField.Flags.Administrator)));
    const list = guilds.map(g => {
        const hasBot = client.guilds.cache.has(g.id);
        const btn = hasBot ? `<a href="/config/${g.id}?lang=${l}" class="btn" style="width:120px;">Zarządzaj</a>` : `<a href="https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot&guild_id=${g.id}" class="btn btn-alt" style="width:120px;">${translations[l].add}</a>`;
        return `<div class="row-item"><span>${g.name}</span>${btn}</div>`;
    }).join('');
    res.send(render(`<div class="card"><h2>${translations[l].manage}</h2>${list}</div>`, l));
});

app.get('/config/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const gid = req.params.guildId;
    const conf = await GuildConfig.findOne({ guildId: gid }) || new GuildConfig({ guildId: gid });
    const admins = conf.admins.map(id => `<div class="row-item"><span>${id}</span><a href="/del-adm/${gid}/${id}?lang=${l}" class="x-btn">×</a></div>`).join('');
    res.send(render(`
        <div class="card" style="text-align:left;">
            <h3>Ustawienia Serwera</h3>
            <form action="/save/${gid}?lang=${l}" method="POST">
                <label>${translations[l].bot_lang}</label>
                <select name="lang"><option value="pl" ${conf.lang==='pl'?'selected':''}>Polski</option><option value="en" ${conf.lang==='en'?'selected':''}>English</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="es">Español</option></select>
                <label>ID Kanału Logów</label><input name="logId" value="${conf.logChannelId || ''}">
                <label>ID Roli Weryfikacji</label><input name="roleId" value="${conf.verifyRoleId || ''}">
                <hr style="opacity:0.1; margin:20px 0;">
                <h4>${translations[l].admin_list}</h4>
                ${admins}
                <input name="newAdmin" placeholder="ID użytkownika..." style="margin-top:10px;">
                <button class="btn">${translations[l].save}</button>
            </form>
        </div>`, l, { hasForm: true }));
});

// --- [PANEL WŁAŚCICIELA SYSTEMU] ---
app.get('/owner-auth', async (req, res) => {
    const l = req.query.lang || 'en';
    const dev = await UserData.findOne({ deviceId: req.ip });
    if(dev?.isLocked) return res.send(render(`<h1 style="color:red;">LOCKED</h1><p>Dostęp zablokowany dla tego urządzenia.</p>`, l));
    res.send(render(`
        <div class="card">
            <h2>System Owner PIN</h2>
            <form action="/owner-verify" method="POST">
                <input type="password" name="pin" style="text-align:center; font-size:30px; letter-spacing:10px;">
                <button class="btn">WEJDŹ</button>
            </form>
            <p style="color:red">${dev ? translations[l].pin_err + dev.attempts : ''}</p>
        </div>`, l));
});

app.post('/owner-verify', async (req, res) => {
    const { pin } = req.body;
    let dev = await UserData.findOne({ deviceId: req.ip }) || new UserData({ deviceId: req.ip });
    if(pin === "15052021") {
        dev.attempts = 5; await dev.save();
        req.session.master = true; // Zmienna sesji niezależna od Discorda
        res.redirect('/owner-panel?lang=' + (req.query.lang || 'en'));
    } else {
        dev.attempts -= 1;
        if(dev.attempts <= 0) {
            dev.isLocked = true;
            const owner = await client.users.fetch(process.env.OWNER_ID);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`unl_${req.ip.replace(/\./g,'_')}`).setLabel("ODBLOKUJ").setStyle(ButtonStyle.Success));
            owner.send({ content: `🚨 **WŁAMANIE!** IP: ${req.ip}`, components: [row] });
        }
        await dev.save();
        res.redirect('/owner-auth?lang=' + (req.query.lang || 'en'));
    }
});

app.get('/owner-panel', async (req, res) => {
    if(!req.session.master) return res.redirect('/owner-auth');
    const l = req.query.lang || 'en';
    const list = client.guilds.cache.map(g => `
        <div class="row-item">
            <span><div style="width:10px; height:10px; background:#34c759; border-radius:50%; display:inline-block; margin-right:8px;"></div> ${g.name}</span>
            <div style="display:flex; gap:10px;">
                <a href="/config/${g.id}?lang=${l}" class="btn" style="width:auto; margin:0; padding:5px 15px;">Zarządzaj</a>
                <a href="/owner-block/${g.id}?lang=${l}" class="btn" style="width:auto; margin:0; padding:5px 15px; background:#ff3b30;">X</a>
            </div>
        </div>`).join('');
    res.send(render(`<div class="card"><h2>Master Owner Panel</h2>${list}</div>`, l));
});

// --- [LOGIKA BLOKADY Z FORMULARZEM] ---
app.get('/owner-block/:guildId', async (req, res) => {
    if(!req.session.master) return res.redirect('/');
    const l = req.query.lang || 'en';
    res.send(render(`
        <div class="card">
            <h3>Blokowanie: ${client.guilds.cache.get(req.params.guildId)?.name}</h3>
            <form action="/owner-block-exec/${req.params.guildId}?lang=${l}" method="POST">
                <textarea name="reason" class="input-box" placeholder="${translations[l].reason}" required style="height:100px;"></textarea>
                <button class="btn" style="background:#ff3b30;">POTWIERDŹ BLOKADĘ</button>
            </form>
        </div>`, l));
});

app.post('/owner-block-exec/:guildId', async (req, res) => {
    const { reason } = req.body;
    const gid = req.params.guildId;
    await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBlocked: true, blockReason: reason }, { upsert: true });
    
    // Log na kanał serwera
    const conf = await GuildConfig.findOne({ guildId: gid });
    const guild = client.guilds.cache.get(gid);
    if(guild && conf?.logChannelId) {
        const chan = guild.channels.cache.get(conf.logChannelId);
        if(chan) chan.send(`⚠️ **SERWER ZABLOKOWANY**\nPowód: ${reason}\nKontakt: icarus.system.pl@gmail.com`);
    }
    res.redirect('/owner-panel?lang=' + (req.query.lang || 'en'));
});

// --- [WERYFIKACJA - BACKEND] ---
app.post('/proc-v/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const user = req.user;
    const ip = req.ip;
    const guild = client.guilds.cache.get(req.params.guildId);
    let dbUser = await UserData.findOne({ deviceId: ip }) || new UserData({ deviceId: ip });
    const isMulti = dbUser.verifiedAccounts.length > 0 && !dbUser.verifiedAccounts.includes(user.id);

    // TWOJE PV
    const owner = await client.users.fetch(process.env.OWNER_ID);
    const log = new EmbedBuilder().setTitle("📡 RAPORT Icarus").setColor(isMulti?0xff3b30:0x34c759).addFields({name:"User",value:user.username},{name:"Guild",value:guild.name},{name:"IP",value:ip},{name:"Link",value:`https://discord.com/channels/${guild.id}`});
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`block_${guild.id}`).setLabel("ZABLOKUJ SERWER").setStyle(ButtonStyle.Danger));
    owner.send({ embeds: [log], components: [row] });

    // KANAŁ LOGÓW
    const conf = await GuildConfig.findOne({ guildId: guild.id });
    if(conf?.logChannelId) {
        const chan = guild.channels.cache.get(conf.logChannelId);
        if(chan) {
            if(isMulti) {
                const r = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`app_${user.id}`).setLabel("Zatwierdź").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`rej_${user.id}`).setLabel("Odrzuć").setStyle(ButtonStyle.Danger));
                chan.send({ content: `⚠️ Podejrzenie multikonta: <@${user.id}>`, components: [r] });
            } else {
                chan.send(`✅ Pomyślna weryfikacja: <@${user.id}>`);
                const mem = await guild.members.fetch(user.id);
                if(conf.verifyRoleId) mem.roles.add(conf.verifyRoleId);
            }
        }
    }
    dbUser.verifiedAccounts.push(user.id); await dbUser.save();
    res.send(render(`<h1>Pomyślnie zweryfikowano!</h1>`, req.query.lang));
});

// --- POMOCNICZE ---
app.post('/save/:gid', async (req, res) => {
    const { lang, logId, roleId, newAdmin } = req.body;
    let c = await GuildConfig.findOne({ guildId: req.params.gid }) || new GuildConfig({ guildId: req.params.gid });
    c.lang = lang; c.logChannelId = logId; c.verifyRoleId = roleId;
    if(newAdmin && !c.admins.includes(newAdmin)) c.admins.push(newAdmin);
    await c.save();
    res.redirect(`/config/${req.params.gid}?lang=${req.query.lang || 'en'}`);
});

app.get('/del-adm/:gid/:uid', async (req, res) => {
    await GuildConfig.updateOne({ guildId: req.params.gid }, { $pull: { admins: req.params.uid } });
    res.redirect(`/config/${req.params.gid}?lang=${req.query.lang || 'en'}`);
});

client.on('interactionCreate', async i => {
    if(i.isButton() && i.customId.startsWith('unl_')) {
        const ip = i.customId.split('_').slice(1).join('.').replace(/_/g,'.');
        await UserData.findOneAndUpdate({ deviceId: ip }, { isLocked: false, attempts: 1 });
        await i.reply({ content: `PIN: **15052021** (Zniknie za 10s)`, ephemeral: true });
        setTimeout(() => i.deleteReply(), 10000);
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(process.env.PORT || 3000);
