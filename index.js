const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');

/**
 * ICARUS ENTERPRISE SYSTEM v4.0 (Full Stack)
 * Rok: 2026 | Standard: Corporate Security
 */

// --- MODELE BAZY DANYCH ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String,
    logChannelId: String,
    language: { type: String, default: 'pl' },
    isBanned: { type: Boolean, default: false },
    banReason: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    guildId: String, 
    status: { type: String, default: 'pending' }, // pending, success, rejected
    ip: String,
    ua: String,
    isp: String,
    country: String,
    timestamp: { type: Date, default: Date.now }
}));

// --- INICJALIZACJA BOTA ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.DirectMessages, 
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
});

let botOwner = null;
client.on('ready', async () => {
    const app = await client.application.fetch();
    botOwner = app.owner;
    console.log(`[ICARUS] System zabezpieczeń włączony. Monitorowanie dla: ${botOwner.tag}`);
});

// --- KONFIGURACJA SERWERA WEB ---
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

app.use(session({
    secret: 'icarus_full_system_vault_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { secure: true, maxAge: 3600000 } // 1h
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));
passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.DOMAIN + '/auth/callback',
    scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// --- FRONT-END UI (APPLE GLASSMORPHISM) ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    :root { --accent: #0071e3; --bg: #000; --card: rgba(255, 255, 255, 0.04); --border: rgba(255, 255, 255, 0.1); }
    body { background: var(--bg); color: #fff; font-family: 'Inter', sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; overflow-x: hidden; }
    .card { background: var(--card); backdrop-filter: blur(40px) saturate(180%); border-radius: 32px; padding: 50px; width: 420px; text-align: center; border: 1px solid var(--border); box-shadow: 0 40px 100px rgba(0,0,0,0.7); }
    h1 { font-size: 34px; font-weight: 600; margin-bottom: 15px; letter-spacing: -1.5px; }
    p { color: #86868b; font-size: 16px; margin-bottom: 35px; line-height: 1.5; }
    .btn { display: block; width: 100%; padding: 18px; border-radius: 16px; font-size: 17px; font-weight: 500; text-decoration: none; cursor: pointer; border: none; margin-bottom: 12px; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .btn-primary { background: var(--accent); color: white; }
    .btn-secondary { background: rgba(255,255,255,0.08); color: white; }
    .btn:hover { transform: scale(1.02); filter: brightness(1.1); }
    .loader { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.05); border-top: 3px solid var(--accent); border-radius: 50%; animation: spin 1s linear infinite; margin: 30px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .status-msg { margin-top: 20px; font-weight: 500; }
`;

const getWrapper = (content) => `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${UI_STYLE}</style></head><body>${content}</body></html>`;

// --- LOGIKA ENDPOINTÓW ---

// 1. Dashboard i Zarządzanie
app.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=dashboard');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let list = guilds.map(g => {
        const inG = client.guilds.cache.has(g.id);
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:rgba(255,255,255,0.03); border-radius:15px; margin-bottom:10px; border:1px solid var(--border);">
            <span>${g.name}</span>
            <a href="${inG ? '/manage/'+g.id : 'https://discord.com/api/oauth2/authorize?client_id='+process.env.CLIENT_ID+'&permissions=8&scope=bot&guild_id='+g.id}" 
               class="btn-primary" style="padding:8px 15px; font-size:12px; width:auto; margin:0;">${inG ? 'KONFIGURUJ' : 'DODAJ BOTA'}</a>
        </div>`;
    }).join('');
    res.send(getWrapper(`<div class="card"><h1>Zarządzanie</h1><p>Twoje serwery korporacyjne</p><div style="text-align:left;">${list}</div></div>`));
});

app.get('/manage/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || {};
    res.send(getWrapper(`
        <div class="card">
            <h1>Ustawienia</h1>
            <form action="/save/${req.params.guildId}" method="POST" style="text-align:left;">
                <label>Język:</label>
                <select name="lang" style="width:100%; padding:12px; background:#111; border:1px solid #333; color:white; border-radius:10px; margin:10px 0;">
                    <option value="pl" ${config.language==='pl'?'selected':''}>Polski</option>
                    <option value="en" ${config.language==='en'?'selected':''}>English</option>
                </select>
                <label>Rola (ID):</label>
                <input name="roleId" value="${config.verifyRoleId||''}" style="width:100%; padding:12px; background:#111; border:1px solid #333; color:white; border-radius:10px; margin:10px 0;">
                <label>Kanał Logów (ID):</label>
                <input name="logChanId" value="${config.logChannelId||''}" style="width:100%; padding:12px; background:#111; border:1px solid #333; color:white; border-radius:10px; margin:10px 0;">
                <button class="btn btn-primary" style="margin-top:20px;">Zapisz</button>
            </form>
            <a href="/dashboard" style="color:#86868b; font-size:12px; text-decoration:none;">← Powrót</a>
        </div>
    `));
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId, language: req.body.lang }, { upsert: true });
    res.redirect('/dashboard');
});

// 2. Weryfikacja (Frontend + API)
app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=verify');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    let list = guilds.map(g => `<a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn btn-secondary">${g.name}</a>`).join('');
    res.send(getWrapper(`<div class="card"><h1>Weryfikacja</h1><p>Wybierz serwer docelowy</p>${list}</div>`));
});

app.get('/auth', async (req, res) => {
    const config = await GuildConfig.findOne({ guildId: req.query.guild });
    if (config?.isBanned) return res.send(getWrapper(`<div class="card"><h1>🚫 Zablokowano</h1><p>${config.banReason}</p></div>`));
    
    res.send(getWrapper(`
        <div class="card" id="main">
            <h1>Icarus Cloud</h1>
            <p>Analiza bezpieczeństwa środowiska cyfrowego...</p>
            <div class="loader"></div>
            <div class="status-msg" id="st">Inicjalizacja skanera...</div>
            <script>
                async function start() {
                    const st = document.getElementById('st');
                    await fetch("/process", { 
                        method: "POST", 
                        headers: {"Content-Type":"application/json"}, 
                        body: JSON.stringify({ userId: "${req.query.token}", guildId: "${req.query.guild}", ua: navigator.userAgent }) 
                    });
                    st.innerText = "Sprawdzanie multikont i proxy...";
                    const poller = setInterval(async () => {
                        const r = await fetch("/status?userId=${req.query.token}&guildId=${req.query.guild}");
                        const d = await r.json();
                        if(d.status === "success") {
                            clearInterval(poller);
                            document.getElementById('main').innerHTML = '<h1>✅ Udane</h1><p>Twoja tożsamość została potwierdzona. Możesz zamknąć to okno.</p>';
                        } else if(d.status === "rejected") {
                            clearInterval(poller);
                            document.getElementById('main').innerHTML = '<h1 style="color:#ff3b30">❌ Odmowa</h1><p>Wykryto zagrożenie bezpieczeństwa (VPN lub Multi-Account).</p>';
                        }
                    }, 2500);
                } start();
            </script>
        </div>`));
});

// 3. Backend - Procesor i Logi na PV
app.post('/process', async (req, res) => {
    const { userId, guildId, ua } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const config = await GuildConfig.findOne({ guildId });
    const guild = client.guilds.cache.get(guildId);
    
    const ipData = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city,isp,proxy,hosting`).catch(() => ({data:{}}));
    const isSus = ipData.data.proxy || ipData.data.hosting;
    const multi = await RequestTracker.findOne({ ip: ip, guildId: guildId, userId: { $ne: userId }, status: 'success' });

    const sendPVReport = async (status, color) => {
        if (!botOwner) return;
        const embed = new EmbedBuilder()
            .setTitle(`🛡️ RAPORT SYSTEMOWY: ${status}`)
            .setColor(color)
            .addFields(
                { name: 'Użytkownik', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                { name: 'Serwer', value: `${guild?.name || 'Unknown'}`, inline: true },
                { name: 'IP', value: `\`${ip}\``, inline: true },
                { name: 'Dostawca (ISP)', value: `${ipData.data.isp || 'N/A'}`, inline: true },
                { name: 'User-Agent', value: `\`\`\`${ua}\`\`\`` }
            ).setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Wpuść mimo to').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ban_${guildId}`).setLabel('Zablokuj ten serwer').setStyle(ButtonStyle.Danger)
        );
        botOwner.send({ embeds: [embed], components: [row] });
    };

    if (multi) {
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'rejected', ip, ua }, { upsert: true });
        await sendPVReport('WYKRYTO MULTIKONTO', 'Red');
    } else if (isSus) {
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending', ip, ua }, { upsert: true });
        await sendPVReport('WYKRYTO VPN / PROXY', 'Yellow');
    } else {
        const member = await guild?.members.fetch(userId).catch(() => null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success', ip, ua }, { upsert: true });
        await sendPVReport('WERYFIKACJA POMYŚLNA', 'Green');
    }
    res.json({ ok: true });
});

// --- PASSPORT & SYSTEM HELPERS ---
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const d = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + d.t);
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending' });
});

// --- KOMENDY BOTA (PV) ---
client.on('messageCreate', async (m) => {
    if (m.author.id !== botOwner?.id || m.channel.type !== 1) return;
    const args = m.content.split(' ');
    if (args[0] === 'ban') {
        const gid = args[1];
        const reason = args.slice(2).join(' ') || "Złamanie zasad korporacyjnych.";
        await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBanned: true, banReason: reason }, { upsert: true });
        m.reply(`🚫 Serwer \`${gid}\` został zablokowany.`);
    }
    if (args[0] === 'unban') {
        await GuildConfig.findOneAndUpdate({ guildId: args[1] }, { isBanned: false });
        m.reply(`✅ Serwer \`${args[1]}\` odblokowany.`);
    }
});

// --- START ---
app.listen(process.env.PORT || 3000, () => console.log('System Icarus Online.'));
client.login(process.env.DISCORD_TOKEN);
