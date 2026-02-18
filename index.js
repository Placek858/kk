const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');

// --- SCHEMATY BAZY DANYCH (MONGO) ---
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
    status: { type: String, default: 'pending' },
    ip: String,
    ua: String,
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
    console.log(`[SYSTEM ICARUS] Aktywny. Zarządzanie: ${botOwner.tag}`);
});

// --- KONFIGURACJA SERWERA WEB ---
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

app.use(session({
    secret: 'icarus_enterprise_2026_secure_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
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

// --- PROFESSIONAL LUXURY UI (APPLE DESIGN) ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@300;400;500;600&display=swap');
    :root { --accent: #0071e3; --bg: #000000; --card: rgba(28, 28, 30, 0.7); --text: #f5f5f7; }
    body { 
        background-color: var(--bg); 
        background-image: radial-gradient(circle at top right, #1d1d1f, #000);
        color: var(--text); 
        font-family: 'SF Pro Display', -apple-system, sans-serif; 
        margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; 
        -webkit-font-smoothing: antialiased;
    }
    .container { 
        background: var(--card); 
        backdrop-filter: blur(30px) saturate(150%);
        border-radius: 32px; 
        padding: 60px 40px; 
        width: 100%; max-width: 420px; 
        box-shadow: 0 30px 60px rgba(0,0,0,0.5); 
        border: 1px solid rgba(255,255,255,0.1); 
        text-align: center; 
    }
    h1 { font-size: 34px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 8px; color: #fff; }
    p { color: #86868b; font-size: 17px; margin-bottom: 40px; line-height: 1.4; }
    .btn { 
        display: block; width: 100%; padding: 18px; border-radius: 16px; 
        font-size: 17px; font-weight: 500; text-decoration: none; cursor: pointer; 
        border: none; margin-bottom: 12px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
        box-sizing: border-box;
    }
    .btn-primary { background: var(--accent); color: white; }
    .btn-primary:hover { background: #0077ed; transform: scale(1.02); }
    .btn-secondary { background: rgba(255,255,255,0.08); color: white; }
    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
    .loader { 
        width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); 
        border-top: 3px solid var(--accent); border-radius: 50%; 
        animation: spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite; margin: 30px auto; 
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .form-group { text-align: left; margin-bottom: 20px; }
    label { font-size: 12px; color: #86868b; text-transform: uppercase; margin-left: 12px; font-weight: 600; }
    input, select { 
        width: 100%; padding: 14px 18px; background: rgba(255,255,255,0.05); 
        border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; 
        color: white; font-size: 16px; margin-top: 6px; outline: none; transition: border 0.3s;
    }
    input:focus { border-color: var(--accent); }
`;

const getWrapper = (content) => `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${UI_STYLE}</style></head><body>${content}</body></html>`;

// --- TŁUMACZENIA ---
const translations = {
    pl: { title: "Icarus Cloud", desc: "System autoryzacji korporacyjnej.", scan: "Analiza zabezpieczeń urządzenia...", verified: "Autoryzacja udana", access: "Dostęp został przyznany.", denied: "Dostęp zablokowany", fraud: "Wykryto próbę oszustwa.", serverBanned: "Serwer wykluczony", contact: "Kontakt: icarus.system.pl@gmail.com | Discord: xplaceqx" },
    en: { title: "Icarus Cloud", desc: "Enterprise Security Gateway.", scan: "Scanning device security...", verified: "Identity Verified", access: "Access has been granted.", denied: "Access Denied", fraud: "Security threat detected.", serverBanned: "Server Blacklisted", contact: "Support: icarus.system.pl@gmail.com | Discord: xplaceqx" }
};

// --- ROUTES ---

// Strona Główna (Wybór)
app.get('/', (req, res) => {
    res.send(getWrapper(`
        <div class="container">
            <h1>Icarus Cloud</h1>
            <p>Najwyższy standard bezpieczeństwa dla Twojego serwera Discord.</p>
            <a href="/login?target=verify" class="btn btn-primary">Autoryzuj tożsamość</a>
            <a href="/login?target=dashboard" class="btn btn-secondary">Zarządzaj systemem</a>
        </div>
    `));
});

// Dashboard (Panel Admina)
app.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let list = guilds.map(g => {
        const inG = client.guilds.cache.has(g.id);
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:18px; background:rgba(255,255,255,0.03); border-radius:16px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05);">
                <span style="font-weight:500;">${g.name}</span>
                <a href="${inG ? '/manage/'+g.id : 'https://discord.com/api/oauth2/authorize?client_id='+process.env.CLIENT_ID+'&permissions=8&scope=bot&guild_id='+g.id}" 
                   style="color:${inG ? '#0071e3' : '#86868b'}; text-decoration:none; font-size:14px; font-weight:600;">
                   ${inG ? 'KONFIGURUJ →' : 'DODAJ BOTA +'}
                </a>
            </div>`;
    }).join('');
    res.send(getWrapper(`<div class="container"><h1>Dashboard</h1><p>Wybierz serwer do konfiguracji</p>${list}</div>`));
});

// Zarządzanie Konkretnym Serwerem
app.get('/manage/:guildId', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || {};
    res.send(getWrapper(`
        <div class="container">
            <h1>Konfiguracja</h1>
            <form action="/save/${req.params.guildId}" method="POST">
                <div class="form-group">
                    <label>Język Systemu</label>
                    <select name="lang">
                        <option value="pl" ${config.language==='pl'?'selected':''}>Polski</option>
                        <option value="en" ${config.language==='en'?'selected':''}>English</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>ID Roli Weryfikacyjnej</label>
                    <input name="roleId" placeholder="np. 1234567890" value="${config.verifyRoleId||''}">
                </div>
                <div class="form-group">
                    <label>ID Kanału Logów</label>
                    <input name="logChanId" placeholder="np. 9876543210" value="${config.logChannelId||''}">
                </div>
                <button class="btn btn-primary" style="margin-top:20px;">Zapisz zmiany</button>
            </form>
            <a href="/dashboard" style="color:#86868b; text-decoration:none; font-size:13px;">← Powrót</a>
        </div>
    `));
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId, language: req.body.lang }, { upsert: true });
    res.redirect('/dashboard');
});

// Strona Weryfikacji (Loader + Logika)
app.get('/auth', async (req, res) => {
    const config = await GuildConfig.findOne({ guildId: req.query.guild });
    const t = translations[config?.language || 'en'];

    if (config?.isBanned) {
        return res.send(getWrapper(`
            <div class="container">
                <h1 style="color:#ff3b30">✕ ${t.serverBanned}</h1>
                <p>Powód: <b>${config.banReason}</b></p>
                <div style="background:rgba(255,59,48,0.1); padding:15px; border-radius:12px; font-size:13px; color:#ff3b30;">${t.contact}</div>
            </div>`));
    }

    res.send(getWrapper(`
        <div class="container" id="main">
            <h1>${t.title}</h1>
            <p>${t.scan}</p>
            <div class="loader"></div>
            <script>
                async function init() {
                    await fetch("/process", { 
                        method: "POST", 
                        headers: {"Content-Type":"application/json"}, 
                        body: JSON.stringify({ userId: "${req.query.token}", guildId: "${req.query.guild}", ua: navigator.userAgent }) 
                    });
                    const check = setInterval(async () => {
                        const r = await fetch("/status?userId=${req.query.token}&guildId=${req.query.guild}");
                        const d = await r.json();
                        if(d.status === "success") {
                            clearInterval(check);
                            document.getElementById('main').innerHTML = '<h1>✓</h1><p>${t.verified}<br><span style="font-size:14px; opacity:0.6">${t.access}</span></p>';
                        } else if(d.status === "rejected") {
                            clearInterval(check);
                            document.getElementById('main').innerHTML = '<h1 style="color:#ff3b30">✕</h1><p>${t.denied}<br><span style="font-size:14px; opacity:0.6">${t.fraud}</span></p>';
                        }
                    }, 2000);
                } init();
            </script>
        </div>`));
});

// --- LOGIKA WERYFIKACJI I LOGOWANIA ---
app.post('/process', async (req, res) => {
    const { userId, guildId, ua } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const config = await GuildConfig.findOne({ guildId });
    const guild = client.guilds.cache.get(guildId);
    
    // Pobieranie danych Geograficznych i ISP
    const ipData = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city,isp,proxy,hosting`).catch(() => ({data:{}}));
    const isSus = ipData.data.proxy || ipData.data.hosting;
    
    // Sprawdzenie Multikonta (IP)
    const existing = await RequestTracker.findOne({ ip: ip, guildId: guildId, userId: { $ne: userId }, status: 'success' });

    const sendFullOwnerReport = async (type, color) => {
        if (!botOwner) return;
        const embed = new EmbedBuilder()
            .setTitle(`🛡️ RAPORT ICARUS: ${type}`)
            .setColor(color)
            .addFields(
                { name: '👤 Użytkownik', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                { name: '🏰 Serwer', value: `${guild?.name || 'Nieznany'} (\`${guildId}\`)`, inline: true },
                { name: '🌐 Adres IP', value: `\`${ip}\``, inline: true },
                { name: '📍 Lokalizacja', value: `${ipData.data.city || 'N/A'}, ${ipData.data.country || 'N/A'}`, inline: true },
                { name: '🔌 Dostawca (ISP)', value: `${ipData.data.isp || 'N/A'}`, inline: true },
                { name: '🖥️ Przeglądarka', value: `\`\`\`${ua}\`\`\`` }
            ).setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Dopuść ręcznie').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`ban_${guildId}`).setLabel('Zablokuj Serwer').setStyle(ButtonStyle.Secondary)
        );
        botOwner.send({ embeds: [embed], components: [row] }).catch(e => console.log("Błąd wysyłania do Ownera:", e));
    };

    if (existing) {
        // MULTIKONTO DETECTED
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'rejected', ip, ua }, { upsert: true });
        await sendFullOwnerReport('DETEKCJA MULTIKONTA (BLOKADA)', 'Red');
    } else if (isSus) {
        // VPN/PROXY DETECTED
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending', ip, ua }, { upsert: true });
        await sendFullOwnerReport('VPN / PROXY DETECTED (MANUAL)', 'Yellow');
    } else {
        // SUCCESS
        const member = await guild?.members.fetch(userId).catch(() => null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success', ip, ua }, { upsert: true });
        
        await sendFullOwnerReport('WERYFIKACJA POMYŚLNA', 'Green');
        
        // Log na serwerze (uproszczony)
        const logChan = guild?.channels.cache.get(config?.logChannelId);
        if (logChan) {
            logChan.send({ embeds: [new EmbedBuilder().setTitle('✓ Weryfikacja udana').setDescription(`Użytkownik <@${userId}> przeszedł system Icarus.`).setColor('#34c759')] });
        }
    }
    res.json({ ok: true });
});

// --- INTERAKCJE I PRZYCISKI ---
client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const [action, uid, gid] = i.customId.split('_');

    if (action === 'acc') {
        const config = await GuildConfig.findOne({ guildId: gid });
        const member = await client.guilds.cache.get(gid)?.members.fetch(uid).catch(() => null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success' });
        i.update({ content: '✅ Zaakceptowano ręcznie.', embeds: [], components: [] });
    } else if (action === 'rej') {
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected' });
        i.update({ content: '❌ Odrzucono dostęp.', embeds: [], components: [] });
    } else if (action === 'ban') {
        i.reply({ content: `Użyj komendy: \`banuj ${uid} POWÓD\` na moich wiadomościach prywatnych.`, ephemeral: true });
    }
});

// --- KOMENDY DLA CIEBIE (WŁAŚCICIELA) ---
client.on('messageCreate', async (m) => {
    if (m.author.id !== botOwner?.id || m.channel.type !== 1) return;
    const args = m.content.split(' ');
    if (args[0] === 'banuj') {
        const gid = args[1];
        const reason = args.slice(2).join(' ') || "Naruszenie regulaminu Icarus.";
        await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBanned: true, banReason: reason }, { upsert: true });
        m.reply(`🚫 Serwer \`${gid}\` został permanentnie zablokowany.`);
    }
    if (args[0] === 'odblokuj') {
        await GuildConfig.findOneAndUpdate({ guildId: args[1] }, { isBanned: false });
        m.reply(`✅ Serwer \`${args[1]}\` został odblokowany.`);
    }
});

// --- POMOCNICZE ---
app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending' });
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ target: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + decoded.target);
});

app.listen(process.env.PORT || 3000);
client.login(process.env.DISCORD_TOKEN);
