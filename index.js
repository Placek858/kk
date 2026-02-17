const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// --- KONFIGURACJA (Pobierane z Environment Variables) ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const DOMAIN = process.env.DOMAIN; 
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// --- POŁĄCZENIE Z BAZĄ ---
mongoose.connect(MONGO_URI).then(() => console.log("✅ SYSTEM: Magistrala Icarus aktywna"));

const GuildConfig = mongoose.model('GuildConfig', new mongoose.Schema({
    guildId: String,
    verifyRoleId: String
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ 
    userId: String, 
    guildId: String,
    status: { type: String, default: 'pending' },
    adminId: String,
    reason: String
}));

// --- BOT CLIENT ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.login(BOT_TOKEN);

// --- EXPRESS SETUP ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'icarus_pro_2026_core',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI })
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: `${DOMAIN}/auth/callback`,
    scope: ['identify', 'guilds']
}, (at, rt, profile, done) => done(null, profile)));

app.use(passport.initialize());
app.use(passport.session());

// --- STYLE CSS (PROFESJONALNY WYGLĄD KLASY ENTERPRISE) ---
const UI_STYLE = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; display: flex; justify-content: center; align-items: center; height: 100vh; }
    .card { background: white; padding: 48px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; width: 90%; max-width: 420px; border: 1px solid #e2e8f0; }
    .logo-box { width: 60px; height: 60px; background: #5469d4; color: white; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 28px; font-weight: 700; }
    h1 { font-size: 22px; font-weight: 600; margin: 0 0 12px; color: #0f172a; }
    p { color: #64748b; font-size: 15px; line-height: 1.6; margin-bottom: 30px; }
    .btn { display: block; width: 100%; padding: 14px; background: #5469d4; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; border: none; cursor: pointer; transition: 0.2s; box-sizing: border-box; }
    .btn:hover { background: #4556ac; transform: translateY(-1px); }
    .btn-outline { background: white; color: #5469d4; border: 1px solid #5469d4; margin-top: 12px; }
    .loader { border: 3px solid #f3f3f3; border-top: 3px solid #5469d4; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; display: none; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .server-list { margin-top: 20px; text-align: left; }
    .server-item { display: flex; align-items: center; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 10px; transition: 0.2s; }
    .server-item:hover { border-color: #5469d4; background: #f1f5f9; }
    .server-item img { width: 35px; height: 35px; border-radius: 50%; margin-right: 12px; }
`;

// --- ROUTY STRON ---

// 1. STRONA GŁÓWNA - WYBÓR
app.get('/', (req, res) => {
    res.send(`
        <style>${UI_STYLE}</style>
        <div class="card">
            <div class="logo-box">I</div>
            <h1>Icarus Central</h1>
            <p>Wybierz moduł systemu, do którego chcesz uzyskać dostęp.</p>
            <a href="/login?target=verify" class="btn">Panel Weryfikacji</a>
            <a href="/login?target=dashboard" class="btn btn-outline">Zarządzanie (Admin)</a>
        </div>
    `);
});

// 2. LOGOWANIE DISCORD
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ type: req.query.target || 'dashboard' })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    const decoded = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect(`/${decoded.type}`);
});

// 3. LISTA SERWERÓW DLA UŻYTKOWNIKA
app.get('/verify', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login?target=verify');
    const commonGuilds = req.user.guilds.filter(g => client.guilds.cache.has(g.id));
    
    let list = commonGuilds.map(g => `
        <a href="/auth?token=${req.user.id}&guild=${g.id}" style="text-decoration:none; color:inherit;">
            <div class="server-item">
                <img src="${g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://discord.com/assets/1f0ac125a376cf482a442e9127e8eb.svg'}">
                <span style="font-weight:500;">${g.name}</span>
            </div>
        </a>
    `).join('');

    res.send(`<style>${UI_STYLE}</style><div class="card"><h1>Twoje Serwery</h1><p>Wybierz serwer, na którym chcesz przejść weryfikację.</p><div class="server-list">${list || 'Nie znaleziono wspólnych serwerów.'}</div></div>`);
});

// 4. STRONA FINALNEJ WERYFIKACJI (Z KÓŁKIEM)
app.get('/auth', (req, res) => {
    res.send(`
        <style>${UI_STYLE}</style>
        <div class="card" id="content">
            <div class="logo-box" id="status-icon">🛡️</div>
            <h1 id="main-title">Autoryzacja Konta</h1>
            <p id="main-desc">Kliknij poniższy przycisk, aby wysłać dane do systemu audytowego Icarus.</p>
            <div id="loader" class="loader"></div>
            <button id="vBtn" onclick="sendData()" class="btn">Rozpocznij Weryfikację</button>
        </div>
        <script>
            async function sendData() {
                const btn = document.getElementById('vBtn');
                const loader = document.getElementById('loader');
                const desc = document.getElementById('main-desc');
                
                btn.style.display = 'none';
                loader.style.display = 'block';
                desc.innerText = 'Trwa zabezpieczanie sesji i przesyłanie danych...';

                const response = await fetch('/complete', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ userId: '${req.query.token}', guildId: '${req.query.guild}' })
                });

                if(response.ok) {
                    desc.innerText = 'Wniosek przesłany do administratorów. Proszę czekać na decyzję...';
                    const poll = setInterval(async () => {
                        const r = await fetch('/status?userId=${req.query.token}&guildId=${req.query.guild}');
                        const s = await r.json();
                        if(s.status === 'success') {
                            clearInterval(poll);
                            document.getElementById('content').innerHTML = '<div style="font-size:50px;margin-bottom:20px;">✅</div><h1>Weryfikacja Pomyślna</h1><p>Dostęp został przyznany. Możesz wrócić na Discorda.</p>';
                        } else if(s.status === 'rejected') {
                            clearInterval(poll);
                            document.getElementById('content').innerHTML = '<div style="font-size:50px;margin-bottom:20px;">❌</div><h1 style="color:#ef4444">Odrzucono</h1><p>Powód: ' + (s.reason || 'Brak') + '</p>';
                        }
                    }, 3000);
                }
            }
        </script>
    `);
});

// --- BACKEND: LOGI I OBSŁUGA ---

app.post('/complete', async (req, res) => {
    const { userId, guildId } = req.body;
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    const ua = req.headers['user-agent'];

    await RequestTracker.findOneAndUpdate({ userId, guildId }, { status: 'pending' }, { upsert: true });

    const guild = client.guilds.cache.get(guildId);
    if (guild) {
        const logChan = guild.channels.cache.find(c => c.name === 'icarus-logs') || guild.channels.cache.filter(c => c.isTextBased()).first();
        const embed = new EmbedBuilder()
            .setTitle('🛡️ AUDYT ICARUS: PROŚBA O DOSTĘP')
            .setColor('#5469d4')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '👤 Użytkownik', value: `<@${userId}> (\`${userId}\`)`, inline: true },
                { name: '🌐 Adres IP', value: `\`${ip}\``, inline: true },
                { name: '💻 System/UA', value: `\`${ua.substring(0, 70)}...\`` },
                { name: '🕒 Czas', value: `<t:${Math.floor(Date.now()/1000)}:F>` },
                { name: '📊 Status', value: '```diff\n+ Sesja aktywna\n! Oczekiwanie na decyzję admina```' }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`acc_${userId}_${guildId}`).setLabel('Zatwierdź').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rej_${userId}_${guildId}`).setLabel('Odrzuć').setStyle(ButtonStyle.Danger)
        );
        logChan.send({ embeds: [embed], components: [row] });
    }
    res.json({ status: 'sent' });
});

client.on('interactionCreate', async (i) => {
    if (i.isButton()) {
        const [action, uid, gid] = i.customId.split('_');
        if (action === 'acc') {
            const config = await GuildConfig.findOne({ guildId: gid });
            const guild = client.guilds.cache.get(gid);
            const member = await guild.members.fetch(uid).catch(() => null);
            if (member && config?.verifyRoleId) await member.roles.add(config.verifyRoleId);
            
            await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'success', adminId: i.user.id });
            
            const ed = EmbedBuilder.from(i.message.embeds[0]).setTitle('✅ DOSTĘP ZAAKCEPTOWANY').setColor('#10b981').addFields({name:'👮 Administrator', value:`<@${i.user.id}>`});
            await i.update({ embeds: [ed], components: [] });
        }
        if (action === 'rej') {
            const modal = new ModalBuilder().setCustomId(`mod_rej_${uid}_${gid}`).setTitle('Odrzucenie weryfikacji');
            const input = new TextInputBuilder().setCustomId('reason').setLabel('Podaj powód odrzucenia:').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await i.showModal(modal);
        }
    }
    if (i.isModalSubmit()) {
        const [,, uid, gid] = i.customId.split('_');
        const reason = i.fields.getTextInputValue('reason');
        await RequestTracker.findOneAndUpdate({ userId: uid, guildId: gid }, { status: 'rejected', adminId: i.user.id, reason });
        const ed = EmbedBuilder.from(i.message.embeds[0]).setTitle('❌ DOSTĘP ODRZUCONY').setColor('#ef4444').addFields({name:'👮 Admin', value:`<@${i.user.id}>`}, {name:'📝 Powód', value:reason});
        await i.update({ embeds: [ed], components: [] });
    }
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId, guildId: req.query.guildId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc?.reason });
});

app.listen(process.env.PORT || 3000);
