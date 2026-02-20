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
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Obsługa błędów połączenia bazy
mongoose.connect(process.env.MONGO_URI).catch(err => console.error("BŁĄD MONGO:", err));

const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String, verifyRoleId: String, logChannelId: String,
    lang: { type: String, default: 'en' }, admins: { type: [String], default: [] },
    isBlocked: { type: Boolean, default: false }, blockReason: String
}));

const UserData = mongoose.model('UserData', new mongoose.Schema({
    deviceId: String, attempts: { type: Number, default: 5 },
    isLocked: { type: Boolean, default: false }, verifiedAccounts: { type: [String], default: [] }
}));

app.use(session({
    secret: 'icarus_ultra_secret_2026',
    resave: false, saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { secure: process.env.DOMAIN.includes('https'), maxAge: 24 * 60 * 60 * 1000 }
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

const i18n = {
    pl: { verify: "Weryfikacja", manage: "Zarządzaj", owner: "System Centralny", save: "Zatwierdź zmiany", unsaved: "Wykryto niezapisane dane", block: "BLOKADA SYSTEMOWA", success: "Operacja pomyślna" },
    en: { verify: "Verification", manage: "Dashboard", owner: "Central System", save: "Save changes", unsaved: "Unsaved changes detected", block: "SYSTEM BLOCK", success: "Success" }
};

const renderUI = (content, lang = 'en', state = { hasForm: false }) => {
    const t = i18n[lang] || i18n.en;
    // POPRAWKA: Zmiana sposobu renderowania ikon, aby uniknąć błędów JS na stronie
    return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
        :root { --accent: #007aff; --bg: #f5f5f7; --text: #1d1d1f; --glass: rgba(255, 255, 255, 0.7); }
        body.dark-mode { --bg: #000000; --text: #ffffff; --glass: rgba(28, 28, 30, 0.7); --accent: #0a84ff; }
        body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; transition: 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
        .navbar { position: fixed; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; backdrop-filter: blur(20px); box-sizing: border-box; }
        .lang-btn { text-decoration: none; color: var(--text); font-size: 13px; font-weight: 600; opacity: 0.4; margin-right: 15px; transition: 0.3s; }
        .lang-btn.active { opacity: 1; color: var(--accent); }
        .neon-toggle { cursor: pointer; font-size: 24px; transition: 0.5s; filter: drop-shadow(0 0 8px var(--accent)); }
        .hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at center, rgba(0,122,255,0.05) 0%, transparent 70%); }
        .glass-card { background: var(--glass); backdrop-filter: blur(40px); border: 1px solid rgba(255,255,255,0.1); padding: 60px; border-radius: 40px; width: 100%; max-width: 450px; text-align: center; box-shadow: 0 40px 80px rgba(0,0,0,0.1); animation: slideUp 1s ease; }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .btn-prime { background: var(--accent); color: white; border: none; padding: 18px 30px; border-radius: 18px; font-weight: 700; font-size: 16px; cursor: pointer; width: 100%; margin: 10px 0; display: inline-block; text-decoration: none; transition: 0.3s; box-shadow: 0 10px 20px rgba(0,122,255,0.3); }
        .btn-prime:hover { transform: scale(1.02); box-shadow: 0 15px 30px rgba(0,122,255,0.4); }
        .btn-sec { background: rgba(128,128,128,0.1); color: var(--text); text-decoration: none; padding: 18px; border-radius: 18px; display: block; font-weight: 600; transition: 0.3s; }
        input, select { width: 100%; padding: 16px; border-radius: 14px; border: 1px solid rgba(128,128,128,0.2); background: transparent; color: var(--text); margin-bottom: 15px; box-sizing: border-box; font-size: 15px; }
        .status-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--accent); color: white; padding: 12px 30px; border-radius: 100px; display: none; align-items: center; gap: 15px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
        .loader { border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: none; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="\${localStorage.getItem('theme') || ''}">
    <div class="navbar">
        <div>
            <a href="?lang=pl" class="lang-btn \${'${lang}'==='pl'?'active':''}">🇵🇱 POLSKI</a>
            <a href="?lang=en" class="lang-btn \${'${lang}'==='en'?'active':''}">🇬🇧 ENGLISH</a>
        </div>
        <div class="neon-toggle" id="themeIco" onclick="toggleTheme()"></div>
    </div>
    <div class="hero">${content}</div>
    <div id="u-bar" class="status-bar">
        <span>${t.unsaved}</span>
        <button class="btn-prime" style="width:auto; padding:8px 20px; margin:0;" onclick="saveData()">
            <div id="loader" class="loader"></div> ${t.save}
        </button>
    </div>
    <script>
        const body = document.body;
        const ico = document.getElementById('themeIco');
        const updateIco = () => ico.innerText = body.classList.contains('dark-mode') ? '🔮' : '💡';
        updateIco();
        function toggleTheme() {
            body.classList.toggle('dark-mode');
            localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark-mode' : '');
            updateIco();
        }
        function saveData() {
            document.getElementById('loader').style.display = 'block';
            setTimeout(() => document.forms[0].submit(), 2000);
        }
        if(${state.hasForm}) {
            document.querySelectorAll('input, select, textarea').forEach(el => {
                el.oninput = () => document.getElementById('u-bar').style.display = 'flex';
            });
        }
    </script>
</body>
</html>`;
};

// --- ROUTES ---
app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(renderUI(`
        <div class="glass-card">
            <h1 style="font-size: 50px; font-weight: 800; letter-spacing: -2px; margin: 0;">ICARUS</h1>
            <p style="opacity: 0.5; margin-bottom: 40px; font-weight: 300;">NEXT-GEN SECURITY INTERFACE</p>
            <a href="/login?target=select-srv&lang=${l}" class="btn-prime">${i18n[l].verify}</a>
            <a href="/login?target=dashboard&lang=${l}" class="btn-sec">${i18n[l].manage}</a>
            <a href="/owner-gate?lang=${l}" style="display:block; margin-top:30px; color:gray; text-decoration:none; font-size:12px;">SYSTEM ACCESS</a>
        </div>`, l));
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${state.t}?lang=${state.l}`);
});

// --- OWNER PANEL (NAPRAWIONE PRZEKIEROWANIA) ---
app.get('/owner-gate', async (req, res) => {
    const l = req.query.lang || 'en';
    const dev = await UserData.findOne({ deviceId: req.ip });
    if(dev?.isLocked) return res.send(renderUI(`<h1>ACCESS DENIED</h1><p>Device restricted.</p>`, l));
    res.send(renderUI(`
        <div class="glass-card">
            <h2>Authorized Access Only</h2>
            <form action="/owner-login?lang=${l}" method="POST">
                <input type="password" name="pin" placeholder="••••••••" style="text-align:center; font-size:24px; letter-spacing:8px;">
                <button class="btn-prime">UNLOCK SYSTEM</button>
            </form>
            ${dev?.attempts < 5 ? `<p style="color:#ff3b30;">${i18n[l].pin_err} ${dev.attempts}</p>` : ''}
        </div>`, l));
});

app.post('/owner-login', async (req, res) => {
    const l = req.query.lang || 'en';
    if(req.body.pin === "15052021") {
        req.session.master = true;
        return res.redirect(`/owner-panel?lang=${l}`);
    }
    let dev = await UserData.findOne({ deviceId: req.ip }) || new UserData({ deviceId: req.ip });
    dev.attempts -= 1;
    if(dev.attempts <= 0) dev.isLocked = true;
    await dev.save();
    res.redirect(`/owner-gate?lang=${l}`);
});

app.get('/owner-panel', async (req, res) => {
    if(!req.session.master) return res.redirect('/owner-gate');
    const l = req.query.lang || 'en';
    const list = client.guilds.cache.map(g => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(128,128,128,0.05); padding:15px; border-radius:15px; margin-bottom:10px;">
            <div style="text-align:left;">
                <div style="font-weight:700;">${g.name}</div>
                <div style="font-size:10px; color:${g.available?'#34c759':'#8e8e93'}">● ${g.available?'ONLINE':'OFFLINE'}</div>
            </div>
            <div style="display:flex; gap:8px;">
                <a href="/config/${g.id}?lang=${l}&from=owner" class="btn-prime" style="width:auto; padding:8px 15px; font-size:12px; margin:0;">EDIT</a>
                <a href="/owner-block/${g.id}?lang=${l}" class="btn-prime" style="width:auto; padding:8px 15px; font-size:12px; margin:0; background:#ff3b30;">X</a>
            </div>
        </div>`).join('');
    res.send(renderUI(`<div class="glass-card"><h3>Global Infrastructure</h3>${list}</div>`, l));
});

// --- DYNAMICZNA KONFIGURACJA (Obsługuje i Właściciela i Admina) ---
app.get('/config/:guildId', async (req, res) => {
    const isOwner = req.session.master;
    if(!isOwner && !req.isAuthenticated()) return res.redirect('/');
    
    const l = req.query.lang || 'en';
    const gid = req.params.guildId;
    const conf = await GuildConfig.findOne({ guildId: gid }) || new GuildConfig({ guildId: gid });
    const admins = conf.admins.map(id => `<div style="display:flex; justify-content:space-between; padding:10px;"><span>${id}</span><a href="/del-adm/${gid}/${id}?lang=${l}" style="color:#ff3b30; text-decoration:none; font-weight:800;">×</a></div>`).join('');

    res.send(renderUI(`
        <div class="glass-card" style="text-align:left;">
            <h2>Server Config</h2>
            <form action="/save-config/${gid}?lang=${l}&from=${req.query.from}" method="POST">
                <label style="font-size:12px; font-weight:700; opacity:0.5;">BOT LANGUAGE</label>
                <select name="lang">
                    <option value="pl" ${conf.lang==='pl'?'selected':''}>Polski</option>
                    <option value="en" ${conf.lang==='en'?'selected':''}>English</option>
                    <option value="de">Deutsch</option>
                    <option value="fr">Français</option>
                    <option value="es">Español</option>
                </select>
                <input name="logId" placeholder="Log Channel ID" value="${conf.logChannelId || ''}">
                <input name="roleId" placeholder="Verified Role ID" value="${conf.verifyRoleId || ''}">
                <div style="background:rgba(128,128,128,0.1); border-radius:15px; padding:15px; margin:15px 0;">
                    <h4 style="margin:0 0 10px 0;">Authorized Admins</h4>
                    ${admins}
                    <input name="newAdmin" placeholder="Add User ID" style="margin-top:10px; font-size:12px;">
                </div>
                <button class="btn-prime">SAVE ARCHITECTURE</button>
            </form>
            <a href="${req.query.from==='owner'?'/owner-panel':'/dashboard'}?lang=${l}" style="color:gray; font-size:12px; text-decoration:none;">← Back</a>
        </div>`, l, { hasForm: true }));
});

app.post('/save-config/:guildId', async (req, res) => {
    const { lang, logId, roleId, newAdmin } = req.body;
    let c = await GuildConfig.findOne({ guildId: req.params.guildId }) || new GuildConfig({ guildId: req.params.guildId });
    c.lang = lang; c.logChannelId = logId; c.verifyRoleId = roleId;
    if(newAdmin && !c.admins.includes(newAdmin)) c.admins.push(newAdmin);
    await c.save();
    res.redirect(`/config/${req.params.guildId}?lang=${req.query.lang}&from=${req.query.from}&status=ok`);
});

// --- WERYFIKACJA (PROFESJONALNE EMBEDY) ---
app.post('/proc-v/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const user = req.user;
    const guild = client.guilds.cache.get(req.params.guildId);
    const dbUser = await UserData.findOne({ deviceId: req.ip }) || new UserData({ deviceId: req.ip });
    const isMulti = dbUser.verifiedAccounts.length > 0 && !dbUser.verifiedAccounts.includes(user.id);

    // PROFESJONALNY LOG DLA CIEBIE
    const owner = await client.users.fetch(process.env.OWNER_ID);
    const ownerEmbed = new EmbedBuilder()
        .setAuthor({ name: "Icarus Security Central", iconURL: client.user.displayAvatarURL() })
        .setTitle("🚨 Security Intelligence Report")
        .setColor(isMulti ? 0xff3b30 : 0x007aff)
        .addFields(
            { name: "👤 Subject", value: `**${user.username}** (${user.id})`, inline: true },
            { name: "🏢 Terminal", value: `**${guild.name}**`, inline: true },
            { name: "🌐 Network ID", value: `\`${req.ip}\``, inline: true },
            { name: "⚠️ Risk Level", value: isMulti ? "CRITICAL (Multi-account)" : "LOW (Verified)" }
        )
        .setFooter({ text: `System Trace ID: ${Date.now()}` })
        .setTimestamp();

    const ownerRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`block_${guild.id}`).setLabel("BLOCK SERVER").setStyle(ButtonStyle.Danger)
    );
    owner.send({ embeds: [ownerEmbed], components: [ownerRow] });

    // LOG DLA SERWERA
    const conf = await GuildConfig.findOne({ guildId: guild.id });
    if(conf?.logChannelId) {
        const chan = guild.channels.cache.get(conf.logChannelId);
        if(chan) {
            const sEmbed = new EmbedBuilder().setTitle("Account Validation").setColor(isMulti?0xff3b30:0x34c759).setDescription(isMulti ? `Flagged: <@${user.id}> - Potential security risk.` : `Success: <@${user.id}> has passed validation.`);
            if(isMulti) {
                const r = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`app_${user.id}`).setLabel("Override & Approve").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`rej_${user.id}`).setLabel("Reject Access").setStyle(ButtonStyle.Danger)
                );
                chan.send({ embeds: [sEmbed], components: [r] });
            } else {
                chan.send({ embeds: [sEmbed] });
                const mem = await guild.members.fetch(user.id).catch(() => null);
                if(mem && conf.verifyRoleId) mem.roles.add(conf.verifyRoleId);
            }
        }
    }
    
    if(!dbUser.verifiedAccounts.includes(user.id)) dbUser.verifiedAccounts.push(user.id);
    await dbUser.save();
    res.send(renderUI(`<div class="glass-card"><h1>SUCCESS</h1><p>Identity confirmed. Check Discord.</p></div>`, req.query.lang));
});

// --- INTERAKCJE (UNLOKOWANIE PINU I BLOKADY) ---
client.on('interactionCreate', async i => {
    if(i.isButton() && i.customId.startsWith('unl_')) {
        const ip = i.customId.split('_').slice(1).join('.').replace(/_/g,'.');
        await UserData.findOneAndUpdate({ deviceId: ip }, { isLocked: false, attempts: 1 });
        await i.reply({ content: `PIN: **15052021** (Auto-delete in 10s)`, ephemeral: true });
        setTimeout(() => i.deleteReply(), 10000);
    }
});

client.login(process.env.DISCORD_TOKEN).catch(err => console.error("FATAL: INVALID TOKEN"));
app.listen(process.env.PORT || 3000);
