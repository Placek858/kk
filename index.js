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

// --- INICJALIZACJA BOT I SERWER ---
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

// --- LUXURY UI SYSTEM ---
const UI_STYLE = `
    :root { --accent: #0071e3; --neon: #00f2ff; --bg: #ffffff; --text: #1d1d1f; --card: rgba(255,255,255,0.8); }
    body.dark-mode { --bg: #000000; --text: #f5f5f7; --card: rgba(28,28,30,0.8); --accent: #0a84ff; }
    
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1); overflow-x: hidden; }
    .top-bar { position: fixed; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; box-sizing: border-box; z-index: 1000; }
    
    .lang-switcher { display: flex; gap: 15px; background: var(--card); backdrop-filter: blur(20px); padding: 10px; border-radius: 50px; border: 1px solid rgba(128,128,128,0.2); cursor: pointer; }
    .neon-toggle { width: 50px; height: 50px; border-radius: 50%; background: var(--card); display: flex; align-items: center; justify-content: center; font-size: 24px; cursor: pointer; border: 2px solid var(--neon); box-shadow: 0 0 15px var(--neon); transition: 0.3s; }
    .neon-toggle:hover { transform: rotate(180deg) scale(1.1); }

    .container { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .card { background: var(--card); backdrop-filter: blur(30px); padding: 50px; border-radius: 30px; width: 450px; text-align: center; border: 1px solid rgba(128,128,128,0.1); box-shadow: 0 30px 60px rgba(0,0,0,0.1); }
    
    .btn { width: 100%; padding: 18px; border-radius: 15px; border: none; font-size: 16px; font-weight: 600; margin: 10px 0; cursor: pointer; transition: 0.3s; text-decoration: none; display: inline-block; box-sizing: border-box; }
    .btn-blue { background: var(--accent); color: white; }
    .btn-blue:hover { opacity: 0.9; transform: translateY(-2px); }
    .btn-glass { background: rgba(128,128,128,0.1); color: var(--text); }
    
    .status-toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: #323232; color: white; padding: 12px 24px; border-radius: 12px; display: none; z-index: 2000; }
    .loader { border: 4px solid #f3f3f3; border-top: 4px solid var(--accent); border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; display: none; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const SHARED_JS = `
    const T = {
        en: { v: "Verify Account", m: "Management Panel", o: "Owner Portal", pl: "Polish", en: "English", save: "Save Changes", unsaved: "You have unsaved changes!", success: "Changes saved successfully", error: "Error saving changes" },
        pl: { v: "Weryfikacja Konta", m: "Panel Zarządzania", o: "Panel Właściciela", pl: "Polski", en: "Angielski", save: "Zapisz Zmiany", unsaved: "Masz niezapisane zmiany!", success: "Zmiany zapisane", error: "Błąd podczas zapisu" }
    };
    function setLang(l) { localStorage.setItem('lang', l); location.reload(); }
    function toggleTheme() { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode')?'dark':'light'); }
    const currLang = localStorage.getItem('lang') || 'en';
    if(localStorage.getItem('theme')==='dark') document.body.classList.add('dark-mode');
    
    function showToast(m, type) {
        const t = document.getElementById('toast');
        t.innerText = m; t.style.display = 'block'; t.style.background = type==='error'?'#ff3b30':'#34c759';
        setTimeout(()=>t.style.display='none', 3000);
    }
`;

const getWrapper = (content, lang) => `
    <html>
    <head>
        <title>Icarus System</title>
        <style>${UI_STYLE}</style>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    </head>
    <body>
        <div class="top-bar">
            <div class="lang-switcher">
                <span onclick="setLang('pl')">🇵🇱 Polski</span>
                <span onclick="setLang('en')">🇬🇧 English</span>
            </div>
            <div class="neon-toggle" onclick="toggleTheme()">🌓</div>
        </div>
        <div class="container">${content}</div>
        <div id="toast" class="status-toast"></div>
        <script>${SHARED_JS}</script>
        <script>
            // Unsaved changes detector
            let originalData = "";
            window.onload = () => { originalData = document.querySelector('form')?.innerHTML || ""; };
            setInterval(() => {
                const currentData = document.querySelector('form')?.innerHTML || "";
                if(currentData !== originalData && originalData !== "") {
                    document.getElementById('unsaved-bar').style.display = 'flex';
                }
            }, 1000);
        </script>
        <div id="unsaved-bar" style="position:fixed; bottom:0; width:100%; background:var(--accent); color:white; padding:15px; display:none; justify-content:center; align-items:center; gap:20px; z-index:1500;">
            <span data-t="unsaved">Niezapisane zmiany!</span>
            <button class="btn-blue" style="width:auto; padding:5px 15px;" onclick="document.querySelector('form').submit()">Zapisz</button>
        </div>
        <script type="text/javascript">
            var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
            (function(){
            var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
            s1.async=true; s1.src='https://embed.tawk.to/6994d0bdeafe121c3aa42b10/1jhmkupms';
            s1.charset='UTF-8'; s1.setAttribute('crossorigin','*');
            s0.parentNode.insertBefore(s1,s0); })();
        </script>
    </body>
    </html>
`;

// --- ROUTY ---

app.get('/', (req, res) => {
    const l = req.query.lang || 'en';
    res.send(getWrapper(`
        <div class="card">
            <h1 style="font-size:40px; margin-bottom:10px;">Icarus</h1>
            <p style="opacity:0.6; margin-bottom:40px;">Next-Gen Security System</p>
            <a href="/login?target=verify" class="btn btn-blue">Weryfikacja Konta</a>
            <a href="/login?target=dashboard" class="btn btn-glass">Panel Zarządzania</a>
            <a href="/owner-login" class="btn btn-glass" style="margin-top:40px; border:1px solid var(--neon)">Panel Właściciela Systemu</a>
        </div>
    `, l));
});

// LOGIKA OWNERA - PIN
app.get('/owner-login', async (req, res) => {
    const deviceId = req.ip; // Prosta identyfikacja urządzenia
    const user = await UserData.findOne({ deviceId });
    if(user && user.isLocked) return res.send(getWrapper(`<h1>Access Revoked</h1><p>Too many failed attempts. Contact Owner on Discord.</p>`));
    
    res.send(getWrapper(`
        <div class="card">
            <h1>System Access</h1>
            <p>Enter Master PIN to continue</p>
            <form action="/owner-verify" method="POST">
                <input type="password" name="pin" style="width:100%; padding:15px; border-radius:10px; border:1px solid #ddd; margin-bottom:20px;" placeholder="••••••••">
                <button class="btn btn-blue">Authorize</button>
                <p style="font-size:12px; color:red; margin-top:10px;">Attempts remaining: ${user ? user.attempts : 5}</p>
            </form>
        </div>
    `));
});

app.post('/owner-verify', async (req, res) => {
    const { pin } = req.body;
    const deviceId = req.ip;
    let user = await UserData.findOne({ deviceId }) || new UserData({ deviceId, userId: "unknown" });

    if(pin === "15052021") {
        user.attempts = 5; await user.save();
        req.session.isOwner = true;
        return res.redirect('/owner-panel');
    } else {
        user.attempts -= 1;
        if(user.attempts <= 0) {
            user.isLocked = true;
            // Powiadomienie na PV do Ciebie
            const owner = await client.users.fetch(process.env.OWNER_ID);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`unlock_${deviceId}`).setLabel('Unlock Device & Show PIN').setStyle(ButtonStyle.Danger)
            );
            owner.send({ content: `🚨 ALERT: Brute-force attempt from IP: ${deviceId}`, components: [row] });
        }
        await user.save();
        res.redirect('/owner-login');
    }
});

// PANEL ZARZĄDZANIA SERWEREM
app.get('/dashboard', async (req, res) => {
    if(!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => {
        const isOwner = (g.permissions & 0x8) === 0x8; // Tylko właściciel (lub admin w uproszczeniu, lepiej sprawdzić guild.ownerId przez bota)
        return isOwner;
    });

    let list = "";
    for(const g of guilds) {
        const botIn = client.guilds.cache.has(g.id);
        const config = await GuildConfig.findOne({ guildId: g.id });
        const status = config?.isBlocked ? "🔴 BLOCKED" : (botIn ? "🟢 ONLINE" : "⚪ NOT ADDED");
        
        list += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid rgba(128,128,128,0.1);">
                <div style="text-align:left">
                    <b>${g.name}</b><br><span style="font-size:12px; opacity:0.5">${status}</span>
                </div>
                ${botIn ? `<a href="/config/${g.id}" class="btn-blue" style="width:auto; padding:8px 15px; font-size:12px; border-radius:8px;">Manage</a>` : `<a href="https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot" class="btn-glass" style="width:auto; padding:8px 15px; font-size:12px; border-radius:8px;">Add Bot</a>`}
            </div>
        `;
    }

    res.send(getWrapper(`
        <div class="card" style="width:600px;">
            <h1>Server Management</h1>
            <div style="margin-top:30px;">${list}</div>
        </div>
    `));
});

// WERYFIKACJA I ANTY-MULTIKONTO
app.post('/complete-verify', async (req, res) => {
    const { userId, guildId, fp } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const parsedFp = JSON.parse(fp);
    const guild = client.guilds.cache.get(guildId);
    const config = await GuildConfig.findOne({ guildId });

    if(config?.isBlocked) return res.json({ error: "BLOCKED", reason: config.blockReason });

    // Anty-Multi
    const duplicate = await RequestTracker.findOne({ "details.cfp": parsedFp.cfp, guildId, userId: { $ne: userId } });
    const isVpn = (await axios.get(`http://ip-api.com/json/${ip}?fields=proxy,hosting`)).data.proxy;

    const status = (duplicate || isVpn) ? 'flagged' : 'success';
    await RequestTracker.create({ userId, guildId, status, details: parsedFp, ip });

    // LOGI DO CIEBIE (Wszystko)
    const owner = await client.users.fetch(process.env.OWNER_ID);
    const fullEmbed = new EmbedBuilder()
        .setTitle('🛰️ FULL DATA LOG')
        .addFields(
            { name: 'User', value: `<@${userId}>` },
            { name: 'Server', value: `${guild.name}` },
            { name: 'IP', value: `\`${ip}\`` },
            { name: 'Hardware Hash', value: `\`${parsedFp.cfp}\`` },
            { name: 'VPN', value: isVpn ? "TAK" : "NIE" }
        ).setColor('#00f2ff');
    
    const blockRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`block_guild_${guildId}`).setLabel('Blokuj Serwer').setStyle(ButtonStyle.Danger)
    );
    owner.send({ embeds: [fullEmbed], components: [blockRow] });

    // LOGI NA SERWER (Bez IP)
    const logChan = guild.channels.cache.get(config.logChannelId);
    if(logChan) {
        const serverEmbed = new EmbedBuilder()
            .setTitle(status === 'success' ? '✅ Verification Passed' : '⚠️ Suspicious Activity')
            .setDescription(`User: <@${userId}>\nReason: ${status === 'flagged' ? 'Hardware Link/VPN' : 'Clean'}`)
            .setColor(status === 'success' ? '#34c759' : '#ff9500');

        if(status === 'flagged') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`approve_${userId}_${guildId}`).setLabel('Approve').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`deny_${userId}_${guildId}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
            );
            logChan.send({ embeds: [serverEmbed], components: [row] });
        } else {
            const member = await guild.members.fetch(userId);
            await member.roles.add(config.verifyRoleId);
            logChan.send({ embeds: [serverEmbed] });
        }
    }

    res.json({ status });
});

// --- DISCORD INTERACTION HANDLER (Pola Formularza/Przyciski) ---
client.on('interactionCreate', async (i) => {
    // Odblokowanie PINu dla Ciebie
    if(i.customId?.startsWith('unlock_')) {
        const deviceId = i.customId.split('_')[1];
        await UserData.findOneAndUpdate({ deviceId }, { attempts: 1, isLocked: false });
        await i.reply({ content: `Odblokowano 1 próbę. PRAWIDŁOWY PIN: ||15052021|| (Zniknie za 10s)`, ephemeral: true });
        setTimeout(() => i.deleteReply(), 10000);
    }

    // Blokowanie serwera (Z Twojego PV)
    if(i.customId?.startsWith('block_guild_')) {
        const gid = i.customId.split('_')[2];
        const modal = new ModalBuilder().setCustomId(`modal_block_${gid}`).setTitle('Blokada Infrastruktury');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Powód blokady (Publiczny)').setStyle(TextInputStyle.Paragraph)));
        await i.showModal(modal);
    }

    // Obsługa Modali
    if(i.type === InteractionType.ModalSubmit) {
        if(i.customId.startsWith('modal_block_')) {
            const gid = i.customId.split('_')[2];
            const reason = i.fields.getTextInputValue('reason');
            await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBlocked: true, blockReason: reason });
            
            const guild = client.guilds.cache.get(gid);
            const config = await GuildConfig.findOne({ guildId: gid });
            const logChan = guild?.channels.cache.get(config?.logChannelId);
            
            const blockEmbed = new EmbedBuilder()
                .setTitle('🚫 SERVER SUSPENDED')
                .setDescription(`This server has been blocked by System Administrator.\n**Reason:** ${reason}\n\nContact: icarus.system.pl@gmail.com`)
                .setColor('#ff3b30');
            
            if(logChan) logChan.send({ embeds: [blockEmbed] });
            await i.reply({ content: `Serwer ${guild?.name} został zablokowany.`, ephemeral: true });
        }
    }
});

// Reszta logowania, callbacków i startu
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord'), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + state.t);
});

app.listen(process.env.PORT || 3000, () => console.log("Icarus System Online."));
client.login(process.env.DISCORD_TOKEN);
