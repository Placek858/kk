const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');

// --- DATABASE MODELS ---
const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String,
    logChannelId: String,
    language: { type: String, default: 'en' },
    isBanned: { type: Boolean, default: false },
    banReason: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    guildId: String, 
    status: { type: String, default: 'pending' },
    ip: String,
    ua: String
}));

// --- BOT CLIENT ---
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message]
});

let botOwner = null;
client.on('ready', async () => {
    const app = await client.application.fetch();
    botOwner = app.owner;
    console.log(`System Icarus Online. Raporty dla: ${botOwner.tag}`);
});

// --- TRANSLATIONS ---
const translations = {
    en: { title: "Icarus Cloud", desc: "Corporate Authorization", btnAuth: "Authorize Identity", btnDash: "System Management", scan: "Scanning device...", choose: "Select Server", verified: "Verified", access: "Access granted.", denied: "Denied", fraud: "Security Alert", serverBanned: "Server Blocked", contact: "To appeal, contact: icarus.system.pl@gmail.com or add xplaceqx on Discord.", addBot: "Add Bot", config: "Configure" },
    pl: { title: "Icarus Cloud", desc: "System autoryzacji korporacyjnej.", btnAuth: "Autoryzuj tożsamość", btnDash: "Zarządzanie systemem", scan: "Skanowanie urządzenia...", choose: "Wybierz serwer", verified: "Zweryfikowano", access: "Dostęp przyznany.", denied: "Odmowa", fraud: "Alert bezpieczeństwa", serverBanned: "Serwer Zablokowany", contact: "Aby się odwołać, napisz: icarus.system.pl@gmail.com lub dodaj xplaceqx na Discordzie.", addBot: "Dodaj Bota", config: "Konfiguracja" }
};

// --- WEB SERVER & AUTH ---
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

app.use(session({
    secret: 'apple_enterprise_secret_2026',
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

// --- LUXURY UI (APPLE STYLE) ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    :root { --bg: #f5f5f7; --text: #1d1d1f; --card-bg: rgba(255, 255, 255, 0.8); --border: rgba(0,0,0,0.05); }
    body.dark-mode { --bg: #1c1c1e; --text: #f5f5f7; --card-bg: rgba(28, 28, 30, 0.8); --border: rgba(255,255,255,0.1); }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; transition: 0.3s ease; overflow: hidden; }
    .card { background: var(--card-bg); backdrop-filter: saturate(180%) blur(20px); border-radius: 28px; padding: 60px; width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.04); border: 1px solid var(--border); text-align: center; }
    .btn { display: block; width: 100%; padding: 16px; border-radius: 14px; font-size: 17px; font-weight: 500; text-decoration: none; cursor: pointer; border: none; margin-bottom: 12px; transition: 0.2s; }
    .btn-primary { background: #0071e3; color: white; }
    .btn-secondary { background: #e8e8ed; color: #1d1d1f; }
    body.dark-mode .btn-secondary { background: #3a3a3c; color: white; }
    .loader { width: 35px; height: 35px; border: 3px solid #f3f3f3; border-top: 3px solid #0071e3; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 25px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    input, select { width: 100%; padding: 14px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; margin: 10px 0; font-size: 15px; color: var(--text); outline: none; }
`;

const getWrapper = (content) => `<html><style>${UI_STYLE}</style><body class="dark-mode">${content}</body></html>`;

// --- ROUTES ---
app.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let list = guilds.map(g => {
        const inG = client.guilds.cache.has(g.id);
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid var(--border);">
            <span>${g.name}</span>
            <a href="${inG ? '/manage/'+g.id : 'https://discord.com/api/oauth2/authorize?client_id='+process.env.CLIENT_ID+'&permissions=8&scope=bot&guild_id='+g.id}" 
               class="btn-primary" style="width:auto; padding:8px 15px; font-size:12px; border-radius:8px; text-decoration:none;">
               ${inG ? 'Configure' : 'Add Bot'}
            </a>
        </div>`;
    }).join('');
    res.send(getWrapper(`<div class="card"><h1>Dashboard</h1><div style="text-align:left;">${list}</div></div>`));
});

app.get('/manage/:guildId', async (req, res) => {
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || {};
    res.send(getWrapper(`<div class="card"><h1>Config</h1><form action="/save/${req.params.guildId}" method="POST" style="text-align:left;">
        Język: <select name="lang"><option value="pl" ${config.language==='pl'?'selected':''}>Polski</option><option value="en" ${config.language==='en'?'selected':''}>English</option></select>
        Role ID: <input name="roleId" value="${config.verifyRoleId||''}">
        Log ID: <input name="logChanId" value="${config.logChannelId||''}">
        <button class="btn btn-primary" style="margin-top:20px;">Save</button></form></div>`));
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId, language: req.body.lang }, { upsert: true });
    res.redirect('/dashboard');
});

app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    let list = guilds.map(g => `<a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn btn-secondary">${g.name}</a>`).join('');
    res.send(getWrapper(`<div class="card"><h1>Wybierz serwer</h1>${list}</div>`));
});

app.get('/auth', async (req, res) => {
    const config = await GuildConfig.findOne({ guildId: req.query.guild });
    const lang = config?.language || 'en';
    const t = translations[lang];

    if (config?.isBanned) {
        return res.send(getWrapper(`<div class="card"><h1 style="color:#ff3b30">${t.serverBanned}</h1><p>Reason: ${config.banReason}</p><p style="font-size:12px; margin-top:20px;">${t.contact}</p></div>`));
    }

    res.send(getWrapper(`<div class="card"><h1>${t.title}</h1><p>${t.scan}</p><div class="loader"></div>
        <script>
            async function run() {
                await fetch("/process", { method: "POST", headers: {"Content-Type":"application/json"}, 
                    body: JSON.stringify({ userId: "${req.query.token}", guildId: "${req.query.guild}", ua: navigator.userAgent }) 
                });
                const i = setInterval(async () => {
                    const r = await fetch("/status?userId=${req.query.token}&guildId=${req.query.guild}");
                    const d = await r.json();
                    if(d.status === "success") { clearInterval(i); document.body.innerHTML = "<h1>${t.verified}</h1><p>${t.access}</p>"; }
                    if(d.status === "rejected") { clearInterval(i); document.body.innerHTML = "<h1 style='color:#ff3b30'>${t.denied}</h1><p>${t.fraud}</p>"; }
                }, 2500);
            } run();
        </script></div>`));
});

app.post('/process', async (req, res) => {
    const { userId, guildId, ua } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const config = await GuildConfig.findOne({ guildId });
    const guild = client.guilds.cache.get(guildId);
    
    const ipData = await axios.get(`http://ip-api.com/json/${ip}?fields=proxy,hosting,country`).catch(() => ({data:{}}));
    const isSus = ipData.data.proxy || ipData.data.hosting;
    const existing = await RequestTracker.findOne({ ip: ip, guildId: guildId, userId: { $ne: userId }, status: 'success' });

    const sendPVReport = async (statusType, color) => {
        if (!botOwner) return;
        const embed = new EmbedBuilder().setTitle(`🕵️ RAPORT ICARUS: ${statusType}`).setColor(color)
            .addFields(
                { name: 'Użytkownik', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                { name: 'Serwer', value: `${guild.name}`, inline: true },
                { name: 'IP', value: `\`${ip}\``, inline: true },
                { name: 'Kraj', value: `${ipData.data.country || 'N/A'}`, inline: true },
                { name: 'User-Agent', value: `\`\`\`${ua}\`\`\`` }
            );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Akceptuj').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`ban_${guildId}`).setLabel('Zbanuj Serwer').setStyle(ButtonStyle.Secondary)
        );
        botOwner.send({ embeds: [embed], components: [row] });
    };

    if (existing) {
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'rejected', ip, ua }, { upsert: true });
        await sendPVReport('FRAUD / MULTIKONTO', 'Red');
    } else if (isSus) {
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending', ip, ua }, { upsert: true });
        await sendPVReport('VPN / PROXY DETECTED', 'Yellow');
    } else {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success', ip, ua }, { upsert: true });
        await sendPVReport('WERYFIKACJA UDANA', 'Green');
        
        const logChan = guild.channels.cache.get(config?.logChannelId);
        if(logChan) logChan.send({ embeds: [new EmbedBuilder().setTitle('Weryfikacja').setDescription(`<@${userId}> przeszedł pomyślnie.`).setColor('Green')] });
    }
    res.json({ ok: true });
});

// --- INTERACTIONS ---
client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const [action, uid, gid] = i.customId.split('_');
    if (action === 'acc') {
        const config = await GuildConfig.findOne({ guildId: gid });
        const member = await client.guilds.cache.get(gid).members.fetch(uid);
        if (config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success' });
        i.update({ content: '✅ Zaakceptowano.', embeds: [], components: [] });
    } else if (action === 'rej') {
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected' });
        i.update({ content: '❌ Odrzucono.', embeds: [], components: [] });
    } else if (action === 'ban') {
        i.reply({ content: `Użyj komendy: \`banuj ${uid} POWÓD\``, ephemeral: true });
    }
});

// --- COMMANDS ---
client.on('messageCreate', async (m) => {
    if (m.author.id !== botOwner?.id || m.channel.type !== 1) return;
    const args = m.content.split(' ');
    if (args[0] === 'banuj') {
        const gid = args[1];
        const reason = args.slice(2).join(' ');
        const config = await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBanned: true, banReason: reason }, { upsert: true, new: true });
        m.reply(`Zablokowano serwer ${gid}.`);
        const guild = client.guilds.cache.get(gid);
        if (guild && config.logChannelId) {
            const t = translations[config.language || 'en'];
            const logChan = guild.channels.cache.get(config.logChannelId);
            logChan?.send({ embeds: [new EmbedBuilder().setTitle(t.serverBanned).setColor('Red').setDescription(`${reason}\n\n${t.contact}`)] });
        }
    }
    if (args[0] === 'odblokuj') {
        await GuildConfig.findOneAndUpdate({ guildId: args[1] }, { isBanned: false });
        m.reply('Serwer odblokowany.');
    }
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending' });
});

app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ type: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + decoded.type);
});

app.listen(process.env.PORT || 3000);
client.login(process.env.DISCORD_TOKEN);
