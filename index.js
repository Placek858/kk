const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');

// --- MODELE BAZY DANYCH ---
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

// --- BOT SETUP ---
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message]
});

let botOwner = null;
client.on('ready', async () => {
    const app = await client.application.fetch();
    botOwner = app.owner;
    console.log(`System Icarus gotowy. Właściciel: ${botOwner.tag}`);
});

// --- TŁUMACZENIA ---
const translations = {
    en: { title: "Icarus Cloud", desc: "Corporate Security", btnAuth: "Authorize", scan: "Analyzing...", verified: "Verified", denied: "Blocked", fraud: "Multi-Account Detected", serverBanned: "Server Blocked", contact: "Contact: icarus.system.pl@gmail.com", addBot: "Add Bot", config: "Configure" },
    pl: { title: "Icarus Cloud", desc: "Bezpieczeństwo Korporacyjne", btnAuth: "Autoryzuj", scan: "Analizowanie...", verified: "Zweryfikowano", denied: "Zablokowano", fraud: "Wykryto Multikonto", serverBanned: "Serwer Zablokowany", contact: "Kontakt: icarus.system.pl@gmail.com", addBot: "Dodaj Bota", config: "Konfiguracja" }
};

// --- EXPRESS & AUTH ---
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

const UI_STYLE = `<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
    body { background: #1c1c1e; color: #f5f5f7; font-family: 'Inter', sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .card { background: rgba(44, 44, 46, 0.8); backdrop-filter: blur(20px); border-radius: 28px; padding: 50px; width: 400px; border: 1px solid rgba(255,255,255,0.1); text-align: center; }
    .btn { display: block; width: 100%; padding: 15px; border-radius: 12px; font-weight: 500; text-decoration: none; margin-top: 20px; cursor: pointer; border: none; }
    .btn-primary { background: #0071e3; color: white; }
    .loader { width: 30px; height: 30px; border: 3px solid #3a3a3c; border-top: 3px solid #0071e3; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    input, select { width: 100%; padding: 12px; background: #3a3a3c; border: 1px solid #48484a; border-radius: 10px; color: white; margin: 10px 0; }
</style>`;

const getWrapper = (content) => `<html>${UI_STYLE}<body>${content}</body></html>`;

// --- ROUTING ---
app.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => (g.permissions & 0x8) === 0x8);
    let list = guilds.map(g => {
        const inG = client.guilds.cache.has(g.id);
        return `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #333;"><span>${g.name}</span><a href="${inG ? '/manage/'+g.id : 'https://discord.com/api/oauth2/authorize?client_id='+process.env.CLIENT_ID+'&permissions=8&scope=bot&guild_id='+g.id}" style="color:#0071e3; text-decoration:none;">${inG ? 'Configure' : 'Add Bot'}</a></div>`;
    }).join('');
    res.send(getWrapper(`<div class="card"><h1>Dashboard</h1>${list}</div>`));
});

app.get('/manage/:guildId', async (req, res) => {
    const config = await GuildConfig.findOne({ guildId: req.params.guildId }) || {};
    res.send(getWrapper(`<div class="card"><h1>Config</h1><form action="/save/${req.params.guildId}" method="POST">
        Język: <select name="lang"><option value="pl" ${config.language==='pl'?'selected':''}>Polski</option><option value="en" ${config.language==='en'?'selected':''}>English</option></select>
        Role ID: <input name="roleId" value="${config.verifyRoleId||''}">
        Log ID: <input name="logChanId" value="${config.logChannelId||''}">
        <button class="btn btn-primary">Save</button></form></div>`));
});

app.post('/save/:guildId', async (req, res) => {
    await GuildConfig.findOneAndUpdate({ guildId: req.params.guildId }, { verifyRoleId: req.body.roleId, logChannelId: req.body.logChanId, language: req.body.lang }, { upsert: true });
    res.redirect('/dashboard');
});

app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    const guilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    let list = guilds.map(g => `<a href="/auth?token=${req.user.id}&guild=${g.id}" class="btn btn-primary" style="text-decoration:none; margin-bottom:10px;">${g.name}</a>`).join('');
    res.send(getWrapper(`<div class="card"><h1>Wybierz serwer</h1>${list}</div>`));
});

app.get('/auth', async (req, res) => {
    const config = await GuildConfig.findOne({ guildId: req.query.guild });
    const t = translations[config?.language || 'en'];
    if (config?.isBanned) return res.send(getWrapper(`<div class="card"><h1 style="color:red;">${t.serverBanned}</h1><p>${config.banReason}</p></div>`));
    
    res.send(getWrapper(`<div class="card"><h1>${t.title}</h1><p>${t.scan}</p><div class="loader"></div>
        <script>
            async function start() {
                await fetch("/process", { method: "POST", headers: {"Content-Type":"application/json"}, 
                    body: JSON.stringify({ userId: "${req.query.token}", guildId: "${req.query.guild}", ua: navigator.userAgent }) 
                });
                const i = setInterval(async () => {
                    const r = await fetch("/status?userId=${req.query.token}&guildId=${req.query.guild}");
                    const d = await r.json();
                    if(d.status === "success") { clearInterval(i); document.body.innerHTML = "<h1>SUCCESS</h1>"; }
                    if(d.status === "rejected") { clearInterval(i); document.body.innerHTML = "<h1 style='color:red;'>DENIED</h1>"; }
                }, 2000);
            } start();
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

    // --- LOGIKA RAPORTU NA PV (DLA CIEBIE MISIU) ---
    const sendOwnerReport = async (type, color) => {
        if (!botOwner) return;
        const embed = new EmbedBuilder()
            .setTitle(`🕵️ ICARUS REPORT: ${type}`)
            .setColor(color)
            .addFields(
                { name: 'Użytkownik', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                { name: 'Serwer', value: `${guild.name}`, inline: true },
                { name: 'Adres IP', value: `\`${ip}\``, inline: true },
                { name: 'Kraj', value: `${ipData.data.country || 'N/A'}`, inline: true },
                { name: 'User-Agent', value: `\`\`\`${ua}\`\`\`` }
            );
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ban_${guildId}`).setLabel('Zbanuj Serwer').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Dopuść ręcznie').setStyle(ButtonStyle.Success)
        );
        botOwner.send({ embeds: [embed], components: [row] });
    };

    // 1. Wykryto multikonto
    if (existing) {
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'rejected', ip, ua }, { upsert: true });
        await sendOwnerReport('MULTIKONTO / FRAUD', 'Red');
        return res.json({ ok: false });
    }

    // 2. Podejrzane IP (VPN)
    if (isSus) {
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending', ip, ua }, { upsert: true });
        await sendOwnerReport('VPN / PROXY DETECTED', 'Yellow');
    } 
    // 3. Czysta weryfikacja
    else {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'success', ip, ua }, { upsert: true });
        
        // Pełny raport dla Ciebie
        await sendOwnerReport('SUCCESSFUL VERIFICATION', 'Green');

        // Czysty log dla serwera
        const logChan = guild.channels.cache.get(config?.logChannelId);
        if(logChan) {
            const serverEmbed = new EmbedBuilder().setTitle('User Verified').setDescription(`<@${userId}> passed security checks.`).setColor('Green');
            logChan.send({ embeds: [serverEmbed] });
        }
    }
    res.json({ ok: true });
});

// --- OBSŁUGA PRZYCISKÓW ---
client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;
    const [action, uid, gid] = i.customId.split('_');

    if (action === 'acc') {
        const config = await GuildConfig.findOne({ guildId: gid });
        const guild = client.guilds.cache.get(gid);
        const member = await guild.members.fetch(uid).catch(() => null);
        if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success' });
        i.update({ content: '✅ Użytkownik dopuszczony.', embeds: [], components: [] });
    } else if (action === 'ban') {
        i.reply({ content: `Aby zbanować ten serwer, napisz: \`banuj ${uid} POWÓD\``, ephemeral: true });
    }
});

// --- KOMENDY PV ---
client.on('messageCreate', async (m) => {
    if (m.author.id !== botOwner?.id || m.channel.type !== 1) return;
    if (m.content.startsWith('banuj')) {
        const [_, gid, ...reason] = m.content.split(' ');
        await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBanned: true, banReason: reason.join(' ') }, { upsert: true });
        m.reply(`Serwer ${gid} zbanowany.`);
    }
    if (m.content.startsWith('odblokuj')) {
        const gid = m.content.split(' ')[1];
        await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBanned: false });
        m.reply(`Serwer ${gid} odblokowany.`);
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
