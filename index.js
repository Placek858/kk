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
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- POŁĄCZENIE Z BAZĄ ---
mongoose.connect(process.env.MONGO_URI);

// --- MODELE ---
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

// --- AUTORYZACJA ---
app.use(session({
    secret: 'icarus_pro_2026',
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

// --- TŁUMACZENIA ---
const i18n = {
    pl: {
        verify: "Weryfikacja Konta", manage: "Panel Zarządzania", owner: "Panel Właściciela Systemu",
        save: "Zapisz Zmiany", unsaved: "Masz niezapisane zmiany!", success: "Zmiany zapisane!",
        fail: "Błąd podczas zapisu", blocked: "SERWER ZABLOKOWANY", contact: "Kontakt: icarus.system.pl@gmail.com",
        pin_err: "Nieprawidłowy PIN!", attempts: "Pozostało prób: ", select_srv: "Wybierz serwer"
    },
    en: {
        verify: "Account Verification", manage: "Management Panel", owner: "System Owner Panel",
        save: "Save Changes", unsaved: "You have unsaved changes!", success: "Changes saved!",
        fail: "Error saving changes", blocked: "SERVER BLOCKED", contact: "Contact: icarus.system.pl@gmail.com",
        pin_err: "Invalid PIN!", attempts: "Attempts left: ", select_srv: "Select Server"
    }
};

// --- SILNIK UI (APPLE/GOOGLE STYLE) ---
const UI = (content, lang = 'en', state = { hasConfig: false }) => {
    const t = i18n[lang] || i18n.en;
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap');
        :root { --blue: #0071e3; --bg: #ffffff; --text: #1d1d1f; --card: #f5f5f7; --neon: #00f2ff; }
        body.dark { --bg: #000000; --text: #f5f5f7; --card: #1c1c1e; --neon: #bc00ff; }
        body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; transition: 0.5s; margin: 0; }
        .nav { position: fixed; top: 0; width: 100%; padding: 25px 40px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; box-sizing: border-box; }
        .lang-switch a { text-decoration: none; color: var(--text); font-weight: 600; margin-right: 15px; opacity: 0.4; font-size: 14px; }
        .lang-switch a.active { opacity: 1; border-bottom: 2px solid var(--blue); }
        .theme-toggle { font-size: 30px; cursor: pointer; filter: drop-shadow(0 0 8px var(--neon)); transition: 0.3s; }
        .container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .card { background: var(--card); padding: 50px; border-radius: 35px; width: 100%; max-width: 480px; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.1); }
        .btn { display: flex; align-items: center; justify-content: center; padding: 18px; border-radius: 14px; background: var(--blue); color: white; text-decoration: none; font-weight: 700; border: none; cursor: pointer; margin: 10px 0; width: 100%; transition: 0.3s; }
        .btn:hover { transform: scale(1.02); filter: brightness(1.1); }
        input, select { width: 100%; padding: 16px; border-radius: 12px; border: 1px solid rgba(128,128,128,0.2); background: var(--bg); color: var(--text); font-size: 16px; box-sizing: border-box; }
        .unsaved-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--blue); color: white; padding: 15px 30px; border-radius: 50px; display: none; align-items: center; gap: 20px; box-shadow: 0 10px 30px rgba(0,113,227,0.4); z-index: 2000; animation: slideUp 0.4s ease; }
        @keyframes slideUp { from { bottom: -100px; } to { bottom: 30px; } }
        .loader { width: 18px; height: 18px; border: 3px solid #fff; border-top: 3px solid transparent; border-radius: 50%; animation: spin 0.8s linear infinite; display: none; margin-right: 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="\${localStorage.getItem('theme') || ''}">
    <div class="nav">
        <div class="lang-switch">
            <a href="?lang=pl" class="\${'${lang}'==='pl'?'active':''}">🇵🇱 Polski</a>
            <a href="?lang=en" class="\${'${lang}'==='en'?'active':''}">🇬🇧 English</a>
        </div>
        <div class="theme-toggle" onclick="toggleT()">\${localStorage.getItem('theme')==='dark'?'🔮':'💡'}</div>
    </div>
    <div class="container">${content}</div>
    <div id="u-bar" class="unsaved-bar">
        <span>${t.unsaved}</span>
        <button class="btn" style="width:auto; padding:8px 25px; background:white; color:black; margin:0;" onclick="submitForm()">
            <div id="ldr" class="loader"></div> ${t.save}
        </button>
    </div>
    <script>
        function toggleT() {
            const b = document.body;
            b.classList.toggle('dark');
            localStorage.setItem('theme', b.classList.contains('dark') ? 'dark' : 'light');
            location.reload();
        }
        function submitForm() {
            document.getElementById('ldr').style.display = 'inline-block';
            setTimeout(() => document.forms[0].submit(), 2000);
        }
        if(${state.hasConfig}) {
            document.querySelectorAll('input, select').forEach(el => {
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
    res.send(UI(`
        <div class="card">
            <h1 style="font-size: 55px; margin: 0; letter-spacing: -2px;">Icarus</h1>
            <p style="opacity: 0.5; margin-bottom: 40px;">Advanced Verification System</p>
            <a href="/login?target=select-guild&lang=${l}" class="btn">${i18n[l].verify}</a>
            <a href="/login?target=dashboard&lang=${l}" class="btn" style="background:transparent; border:2px solid var(--blue); color:var(--text);">${i18n[l].manage}</a>
            <a href="/owner-gate?lang=${l}" class="btn" style="background:none; font-size:12px; margin-top:50px; color:gray;">${i18n[l].owner}</a>
        </div>`, l));
});

// LOGOWANIE I CALLBACK
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target, l: req.query.lang })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${state.t}?lang=${state.l || 'en'}`);
});

// WYBÓR SERWERA DO WERYFIKACJI
app.get('/select-guild', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const l = req.query.lang || 'en';
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    const list = guilds.map(g => `<a href="/verify-page/${g.id}?lang=${l}" class="btn" style="justify-content:space-between;">${g.name} <span>→</span></a>`).join('');
    res.send(UI(`<div class="card"><h2>${i18n[l].select_srv}</h2>${list}</div>`, l));
});

// STRONA WERYFIKACJI (ANTY-MULTI)
app.get('/verify-page/:guildId', async (req, res) => {
    const l = req.query.lang || 'en';
    const config = await GuildConfig.findOne({ guildId: req.params.guildId });
    if(config?.isBlocked) {
        return res.send(UI(`
            <div class="card" style="border-top: 5px solid #ff3b30;">
                <h1 style="color:#ff3b30;">${i18n[l].blocked}</h1>
                <p><strong>Powód:</strong> ${config.blockReason}</p>
                <p style="font-size:13px; opacity:0.6; margin-top:30px;">${i18n[l].contact}</p>
            </div>`, l));
    }
    res.send(UI(`
        <div class="card">
            <h2>Weryfikacja Konta</h2>
            <p>Kliknij poniżej, aby przejść proces anty-multi.</p>
            <form action="/process-verify/${req.params.guildId}?lang=${l}" method="POST">
                <button class="btn">WERYFIKUJ</button>
            </form>
        </div>`, l));
});

app.post('/process-verify/:guildId', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/');
    const user = req.user;
    const ip = req.ip;
    const guild = client.guilds.cache.get(req.params.guildId);
    
    let dbUser = await UserData.findOne({ deviceId: ip }) || new UserData({ deviceId: ip });
    const isMulti = dbUser.verifiedAccounts.length > 0 && !dbUser.verifiedAccounts.includes(user.id);

    // LOGI NA TWOJE PV
    const owner = await client.users.fetch(process.env.OWNER_ID);
    const ownerEmbed = new EmbedBuilder()
        .setTitle("📡 NOWA WERYFIKACJA")
        .setColor(isMulti ? 0xff3b30 : 0x34c759)
        .addFields(
            { name: "Użytkownik", value: `${user.username} (${user.id})` },
            { name: "Serwer", value: `${guild.name}` },
            { name: "Urządzenie IP", value: ip },
            { name: "Multi-Account", value: isMulti ? "TAK ⚠️" : "NIE ✅" },
            { name: "Link do serwera", value: `https://discord.com/channels/${guild.id}` }
        );
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sys_block_srv_${guild.id}`).setLabel("ZABLOKUJ SERWER").setStyle(ButtonStyle.Danger)
    );
    owner.send({ embeds: [ownerEmbed], components: [row] });

    // LOGI NA KANAŁ SERWERA
    const config = await GuildConfig.findOne({ guildId: guild.id });
    if(config?.logChannelId) {
        const chan = guild.channels.cache.get(config.logChannelId);
        if(chan) {
            const embed = new EmbedBuilder().setTitle("Weryfikacja Icarus").setDescription(isMulti ? "⚠️ Wykryto podejrzenie multikonta!" : "✅ Pomyślnie zweryfikowano.");
            if(isMulti) {
                const srvRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`approve_${user.id}`).setLabel("Zatwierdź").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`reject_modal_${user.id}`).setLabel("Odrzuć").setStyle(ButtonStyle.Danger)
                );
                chan.send({ embeds: [embed], components: [srvRow] });
            } else {
                chan.send({ embeds: [embed] });
                const member = await guild.members.fetch(user.id);
                if(config.verifyRoleId) member.roles.add(config.verifyRoleId);
            }
        }
    }

    if(!dbUser.verifiedAccounts.includes(user.id)) dbUser.verifiedAccounts.push(user.id);
    await dbUser.save();
    res.send(UI(`<h1>Pomyślnie zweryfikowano!</h1>`, req.query.lang));
});

// --- PANEL WŁAŚCICIELA SYSTEMU (PIN) ---
app.get('/owner-gate', async (req, res) => {
    const l = req.query.lang || 'en';
    const dev = await UserData.findOne({ deviceId: req.ip });
    if(dev?.isLocked) return res.send(UI(`<h1>ZABLOKOWANO</h1><p>Dostęp zablokowany. Odblokuj przez PV.</p>`, l));

    res.send(UI(`
        <div class="card">
            <h2>System Owner</h2>
            <form action="/owner-login" method="POST">
                <input type="password" name="pin" placeholder="PIN" style="text-align:center; font-size:25px;">
                <button class="btn">ENTER</button>
            </form>
            <p style="color:red;">${dev ? i18n[l].attempts + dev.attempts : ''}</p>
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
                new ButtonBuilder().setCustomId(`unlock_dev_${req.ip.replace(/\./g,'_')}`).setLabel("ODBLOKUJ URZĄDZENIE").setStyle(ButtonStyle.Success)
            );
            owner.send({ content: `🚨 **PRÓBA WŁAMANIA!** IP: ${req.ip}`, components: [row] });
        }
        await dev.save();
        res.redirect('/owner-gate');
    }
});

// --- INTERAKCJE DISCORD ---
client.on('interactionCreate', async i => {
    if(i.isButton()) {
        if(i.customId.startsWith('unlock_dev_')) {
            const ip = i.customId.split('_').slice(2).join('.').replace(/_/g,'.');
            await UserData.findOneAndUpdate({ deviceId: ip }, { isLocked: false, attempts: 1 });
            const msg = await i.reply({ content: `PIN: **15052021** (Zniknie za 10s)`, fetchReply: true });
            setTimeout(() => i.deleteReply(), 10000);
        }
        if(i.customId.startsWith('reject_modal_')) {
            const uid = i.customId.split('_')[2];
            const modal = new ModalBuilder().setCustomId(`modal_reject_${uid}`).setTitle('Powód Odrzucenia');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Podaj powód').setStyle(TextInputStyle.Paragraph)));
            await i.showModal(modal);
        }
        if(i.customId.startsWith('sys_block_srv_')) {
            const gid = i.customId.split('_')[3];
            const modal = new ModalBuilder().setCustomId(`modal_block_${gid}`).setTitle('Blokada Serwera');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Powód Blokady').setStyle(TextInputStyle.Paragraph)));
            await i.showModal(modal);
        }
    }
    
    if(i.type === InteractionType.ModalSubmit) {
        if(i.customId.startsWith('modal_block_')) {
            const gid = i.customId.split('_')[2];
            const reason = i.fields.getTextInputValue('reason');
            const config = await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBlocked: true, blockReason: reason }, { upsert: true, new: true });
            
            // Informacja na kanał logów serwera
            const guild = client.guilds.cache.get(gid);
            if(guild && config.logChannelId) {
                const chan = guild.channels.cache.get(config.logChannelId);
                if(chan) chan.send(`⚠️ **TEN SERWER ZOSTAŁ ZABLOKOWANY.**\nPowód: ${reason}\nKontakt: icarus.system.pl@gmail.com`);
            }
            await i.reply(`Zablokowano serwer ${gid}.`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
app.listen(3000, () => console.log("Icarus Online"));
