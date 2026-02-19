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

// --- BOT & SERVER CONFIG ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

// --- DATABASE SCHEMAS ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    guildName: String,
    verifyRoleId: String,
    logChannelId: String,
    lang: { type: String, default: 'en' },
    admins: { type: [String], default: [] }, // Lista ID użytkowników
    isBlocked: { type: Boolean, default: false },
    blockReason: String
}));

const UserData = mongoose.model('UserData', new mongoose.Schema({
    deviceId: String,
    attempts: { type: Number, default: 5 },
    isLocked: { type: Boolean, default: false },
    verifiedAccounts: { type: [String], default: [] }
}));

// --- AUTHENTICATION ---
app.use(session({
    secret: 'icarus_apple_pro_2026',
    resave: false, saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
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

// --- TRANSLATIONS (Wszystkie szczegóły) ---
const translations = {
    pl: {
        v: "Weryfikacja", m: "Panel Zarządzania", o: "Panel Właściciela",
        save: "Zapisz", unsaved: "Masz niezapisane zmiany!", success: "Zapisano pomyślnie!",
        err: "Błąd podczas zapisu!", blocked: "SERWER ZABLOKOWANY", 
        add_bot: "Dodaj Bota", settings: "Ustawienia", lang_bot: "Język wiadomości bota",
        log_chan: "ID Kanału Logów", role_id: "ID Roli po weryfikacji",
        admin_list: "Uprawnieni Administratorzy", add_admin: "Dodaj ID Admina"
    },
    en: {
        v: "Verification", m: "Management Panel", o: "Owner Panel",
        save: "Save", unsaved: "You have unsaved changes!", success: "Saved successfully!",
        err: "Error while saving!", blocked: "SERVER BLOCKED",
        add_bot: "Add Bot", settings: "Settings", lang_bot: "Bot message language",
        log_chan: "Log Channel ID", role_id: "Verification Role ID",
        admin_list: "Authorized Administrators", add_admin: "Add Admin ID"
    }
};

// --- UI ENGINE (Apple/Google Style) ---
const renderUI = (content, lang = 'en', state = { hasChanges: false, isOwner: false }) => {
    const t = translations[lang] || translations.en;
    return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap');
        :root { --blue: #0071e3; --bg: #ffffff; --text: #1d1d1f; --card: #f5f5f7; --neon: #00f2ff; }
        body.dark { --bg: #000000; --text: #f5f5f7; --card: #1c1c1e; --neon: #7000ff; }
        body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; transition: 0.5s; margin: 0; overflow-x: hidden; }
        .nav { position: fixed; top: 0; width: 100%; padding: 25px 50px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; box-sizing: border-box; }
        .theme-toggle { font-size: 32px; cursor: pointer; filter: drop-shadow(0 0 10px var(--neon)); transition: 0.3s; }
        .lang-switch { display: flex; gap: 15px; }
        .lang-switch a { text-decoration: none; color: var(--text); font-weight: 600; opacity: 0.4; font-size: 14px; }
        .lang-switch a.active { opacity: 1; border-bottom: 2px solid var(--blue); }
        .container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px; box-sizing: border-box; }
        .card { background: var(--card); padding: 50px; border-radius: 35px; width: 100%; max-width: 500px; box-shadow: 0 30px 60px rgba(0,0,0,0.12); text-align: center; position: relative; }
        .btn { display: flex; align-items: center; justify-content: center; padding: 18px; border-radius: 15px; background: var(--blue); color: white; text-decoration: none; font-weight: 700; border: none; cursor: pointer; margin: 12px 0; width: 100%; transition: 0.4s; }
        .btn:hover { transform: scale(1.03); filter: brightness(1.1); }
        .input-group { text-align: left; margin-bottom: 20px; }
        input, select { width: 100%; padding: 16px; border-radius: 12px; border: 1px solid rgba(128,128,128,0.2); background: var(--bg); color: var(--text); font-size: 16px; box-sizing: border-box; }
        .u-bar { position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 15px 35px; border-radius: 50px; display: none; align-items: center; gap: 25px; box-shadow: 0 15px 35px rgba(0,113,227,0.4); z-index: 2000; animation: up 0.5s ease; }
        @keyframes up { from { bottom: -100px; } to { bottom: 40px; } }
        .loader { border: 3px solid #f3f3f3; border-top: 3px solid var(--blue); border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: none; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .srv-status { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 8px; }
    </style>
</head>
<body class="\${localStorage.getItem('t') || ''}">
    <div class="nav">
        <div class="lang-switch">
            <a href="?lang=pl" class="\${'${lang}'==='pl'?'active':''}">🇵🇱 Polski</a>
            <a href="?lang=en" class="\${'${lang}'==='en'?'active':''}">🇬🇧 English</a>
        </div>
        <div class="theme-toggle" onclick="togg()">\${localStorage.getItem('t') === 'dark' ? '🔮' : '💡'}</div>
    </div>
    <div class="container">${content}</div>
    <div id="u-bar" class="u-bar">
        <span>${t.unsaved}</span>
        <button class="btn" style="width:auto; padding:8px 25px; background:white; color:black; margin:0;" onclick="save()">
            <div id="ld" class="loader"></div> ${t.save}
        </button>
    </div>
    <script>
        function togg() {
            const b = document.body;
            b.classList.toggle('dark');
            localStorage.setItem('t', b.classList.contains('dark') ? 'dark' : 'light');
            location.reload();
        }
        function save() {
            document.getElementById('ld').style.display = 'inline-block';
            setTimeout(() => document.forms[0].submit(), 2000);
        }
        if(${state.hasChanges}) {
            document.querySelectorAll('input, select').forEach(i => i.oninput = () => document.getElementById('u-bar').style.display = 'flex');
        }
    </script>
</body>
</html>`;
};

// --- ROUTES ---

app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(renderUI(`
        <div class="card">
            <h1 style="font-size: 60px; letter-spacing: -3px; margin: 0;">Icarus</h1>
            <p style="opacity:0.5; margin-bottom: 45px;">Secure Verification System</p>
            <a href="/login?target=verify&lang=${l}" class="btn">${translations[l].v}</a>
            <a href="/login?target=dashboard&lang=${l}" class="btn" style="background:transparent; border:2px solid var(--blue); color:var(--text);">${translations[l].m}</a>
            <a href="/owner-auth-page?lang=${l}" class="btn" style="margin-top:60px; background:none; font-size:12px; color:gray;">${translations[l].o}</a>
        </div>`, l));
});

// --- PANEL WŁAŚCICIELA (PIN & LOCK SYSTEM) ---
app.get('/owner-auth-page', async (req, res) => {
    const l = req.query.lang || 'en';
    const dev = await UserData.findOne({ deviceId: req.ip });
    if(dev?.isLocked) return res.send(renderUI(`<h1>Access Denied</h1><p>Device locked. Unlock via Discord PV.</p>`, l));

    res.send(renderUI(`
        <div class="card">
            <h2>System Owner</h2>
            <form action="/owner-login" method="POST">
                <input type="password" name="pin" placeholder="••••••••" style="text-align:center; font-size:32px;">
                <button class="btn">LOGIN</button>
            </form>
            <p style="color:red; font-weight:600; margin-top:20px;">Pozostało prób: ${dev ? dev.attempts : 5}</p>
        </div>`, l));
});

app.post('/owner-login', async (req, res) => {
    const { pin } = req.body;
    let dev = await UserData.findOne({ deviceId: req.ip }) || new UserData({ deviceId: req.ip });
    
    if(pin === "15052021") {
        dev.attempts = 5; await dev.save();
        req.session.isOwner = true;
        res.redirect('/owner-panel');
    } else {
        dev.attempts -= 1;
        if(dev.attempts <= 0) {
            dev.isLocked = true;
            const owner = await client.users.fetch(process.env.OWNER_ID);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`unlock_dev_${req.ip.replace(/\./g, '_')}`).setLabel("ODBLOKUJ (10s PIN)").setStyle(ButtonStyle.Success)
            );
            owner.send({ content: `🚨 **Wykryto próbę włamania do panelu!** IP: ${req.ip}`, components: [row] });
        }
        await dev.save();
        res.redirect('/owner-auth-page');
    }
});

// --- WERYFIKACJA (ANTY-MULTI & VPN) ---
app.get('/do-verify/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login?target=verify');
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });

    if(config?.isBlocked) {
        return res.send(renderUI(`
            <div class="card" style="border: 3px solid #ff3b30;">
                <h1 style="color:#ff3b30;">${translations[l].blocked}</h1>
                <p><strong>Powód:</strong> ${config.blockReason}</p>
                <hr style="opacity:0.1; margin:30px 0;">
                <p style="font-size:12px; opacity:0.6;">Contact: icarus.system.pl@gmail.com</p>
            </div>`, l));
    }

    res.send(renderUI(`
        <div class="card">
            <h2>Weryfikacja Konta</h2>
            <p style="opacity:0.6;">System Icarus sprawdza Twoje urządzenie pod kątem multikont i VPN.</p>
            <form action="/verify-process/${req.params.guildId}?lang=${l}" method="POST">
                <button class="btn">ROZPOCZNIJ WERYFIKACJĘ</button>
            </form>
        </div>`, l));
});

app.post('/verify-process/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const user = req.user;
    const ip = req.ip;
    const guild = client.guilds.cache.get(req.params.guildId);
    
    let dbUser = await UserData.findOne({ deviceId: ip }) || new UserData({ deviceId: ip });
    const isMulti = dbUser.verifiedAccounts.length > 0 && !dbUser.verifiedAccounts.includes(user.id);

    // LOGI NA MOJE PV (PEŁNE DANE)
    const owner = await client.users.fetch(process.env.OWNER_ID);
    const ownerEmbed = new EmbedBuilder()
        .setTitle("📡 Nowa Weryfikacja")
        .setColor(isMulti ? 0xff3b30 : 0x34c759)
        .addFields(
            { name: "Użytkownik", value: `${user.username} (${user.id})` },
            { name: "Serwer", value: `${guild.name}` },
            { name: "Urządzenie IP", value: ip },
            { name: "Link Serwera", value: `https://discord.com/channels/${guild.id}` }
        );
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sys_block_srv_${guild.id}`).setLabel("BLOKUJ SERWER").setStyle(ButtonStyle.Danger)
    );
    owner.send({ embeds: [ownerEmbed], components: [row] });

    // LOGI NA SERWERZE
    const config = await GuildConfig.findOne({ guildId: guild.id });
    if(config?.logChannelId) {
        const chan = guild.channels.cache.get(config.logChannelId);
        if(chan) {
            const srvEmbed = new EmbedBuilder().setTitle("Weryfikacja Icarus").setDescription(isMulti ? "⚠️ Wykryto podejrzenie multikonta!" : "✅ Pomyślnie zweryfikowano.");
            if(isMulti) {
                const srvRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`approve_${user.id}`).setLabel("Zatwierdź").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`reject_${user.id}`).setLabel("Odrzuć").setStyle(ButtonStyle.Danger)
                );
                chan.send({ embeds: [srvEmbed], components: [srvRow] });
            } else {
                chan.send({ embeds: [srvEmbed] });
                const member = await guild.members.fetch(user.id);
                if(config.verifyRoleId) member.roles.add(config.verifyRoleId);
            }
        }
    }

    if(!dbUser.verifiedAccounts.includes(user.id)) dbUser.verifiedAccounts.push(user.id);
    await dbUser.save();
    res.send(renderUI(`<h1>Sukces</h1><p>Proces zakończony.</p>`, req.query.lang));
});

// --- DISCORD INTERACTIONS ---
client.on('interactionCreate', async i => {
    if(i.isButton()) {
        if(i.customId.startsWith('unlock_dev_')) {
            const ip = i.customId.split('_').slice(2).join('.').replace(/_/g,'.');
            await UserData.findOneAndUpdate({ deviceId: ip }, { isLocked: false, attempts: 1 });
            const m = await i.reply({ content: `Odblokowano. PIN: **15052021** (10s)`, fetchReply: true });
            setTimeout(() => i.deleteReply(), 10000);
        }
        if(i.customId === 'reject_user_modal') { // Logika odrzucenia z powodem
            const modal = new ModalBuilder().setCustomId('modal_reject').setTitle('Powód Odrzucenia');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('r').setLabel('Powód').setStyle(TextInputStyle.Paragraph)));
            await i.showModal(modal);
        }
    }
});

// --- APP LISTEN ---
client.login(process.env.DISCORD_TOKEN);
app.listen(3000, () => console.log("Icarus System Online 2026"));

// Pomocnicze funkcje Passport
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${state.t}?lang=${state.l || 'en'}`);
});
