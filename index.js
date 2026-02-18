const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const axios = require('axios');

// --- DATABASE SCHEMAS ---
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
    deviceId: String // IP as Device ID
}));

const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({
    userId: String,
    guildId: String,
    status: String,
    details: Object,
    ip: String,
    fp: String
}));

// --- INITIALIZATION ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI);

app.use(session({
    secret: 'icarus_neon_2026',
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

// --- TRANSLATIONS (5 LANGUAGES) ---
const LOCALES = {
    pl: { 
        v: "Weryfikacja Konta", m: "Panel Zarządzania", o: "Panel Właściciela Systemu", 
        save: "Zapisz Zmiany", unsaved: "Masz niezapisane zmiany!", success: "Zmiany zapisane pomyślnie", 
        error: "Błąd podczas zapisu", loading: "Przetwarzanie...", blockMsg: "SERWER ZABLOKOWANY",
        reason: "Powód:", contact: "Kontakt:", pinErr: "Nieprawidłowy PIN. Pozostało prób:", locked: "Dostęp zablokowany dla tego urządzenia."
    },
    en: { 
        v: "Account Verification", m: "Management Panel", o: "System Owner Panel", 
        save: "Save Changes", unsaved: "You have unsaved changes!", success: "Changes saved successfully", 
        error: "Error saving changes", loading: "Processing...", blockMsg: "SERVER SUSPENDED",
        reason: "Reason:", contact: "Contact:", pinErr: "Invalid PIN. Attempts left:", locked: "Access denied for this device."
    },
    de: { 
        v: "Kontoverifizierung", m: "Management-Panel", o: "Systembesitzer-Panel", 
        save: "Änderungen speichern", unsaved: "Sie haben ungespeicherte Änderungen!", success: "Erfolgreich gespeichert", 
        error: "Fehler beim Speichern", loading: "Verarbeitung...", blockMsg: "SERVER GESPERRT",
        reason: "Grund:", contact: "Kontakt:", pinErr: "Ungültige PIN. Versuche übrig:", locked: "Zugriff für dieses Gerät gesperrt."
    },
    fr: { 
        v: "Vérification du Compte", m: "Panneau de Gestion", o: "Panneau Propriétaire", 
        save: "Enregistrer", unsaved: "Changements non enregistrés!", success: "Enregistré avec succès", 
        error: "Erreur d'enregistrement", loading: "Traitement...", blockMsg: "SERVEUR SUSPENDU",
        reason: "Raison:", contact: "Contact:", pinErr: "PIN invalide. Tentatives restantes:", locked: "Accès refusé pour cet appareil."
    },
    es: { 
        v: "Verificación de Cuenta", m: "Panel de Control", o: "Panel del Propietario", 
        save: "Guardar Cambios", unsaved: "¡Tienes cambios sin guardar!", success: "Guardado exitosamente", 
        error: "Error al guardar", loading: "Procesando...", blockMsg: "SERVIDOR SUSPENDIDO",
        reason: "Razón:", contact: "Contacto:", pinErr: "PIN inválido. Intentos restantes:", locked: "Acceso denegado para este dispositivo."
    }
};

// --- CSS & UI SYSTEM ---
const UI_STYLE = `
    :root { --blue: #0071e3; --neon: #00f2ff; --dark: #050505; --light: #ffffff; }
    body { font-family: 'Inter', -apple-system, sans-serif; margin: 0; background: var(--bg); color: var(--text); transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
    body.light-mode { --bg: #ffffff; --text: #1d1d1f; --card: rgba(245, 245, 247, 0.8); }
    body.dark-mode { --bg: #000000; --text: #f5f5f7; --card: rgba(28, 28, 30, 0.8); }

    .top-bar { position: fixed; top: 0; width: 100%; display: flex; justify-content: space-between; padding: 20px 40px; box-sizing: border-box; z-index: 100; }
    
    /* Neon Border Animation */
    .neon-btn {
        position: relative; padding: 15px 30px; border: none; background: transparent;
        color: var(--text); font-weight: 600; cursor: pointer; border-radius: 12px;
        text-decoration: none; overflow: hidden; display: inline-block;
    }
    .neon-btn::before {
        content: ''; position: absolute; top:0; left:0; right:0; bottom:0;
        border-radius: 12px; padding: 2px; 
        background: linear-gradient(90deg, var(--neon), var(--blue), var(--neon));
        background-size: 200% auto;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: destination-out;
        mask-composite: exclude;
        animation: neon-flow 3s linear infinite;
    }
    @keyframes neon-flow { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }

    .card { background: var(--card); backdrop-filter: blur(20px); border-radius: 24px; padding: 40px; width: 450px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .container { height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column; }
    
    #unsaved-banner { 
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: var(--blue); color: white; padding: 15px 30px; border-radius: 50px;
        display: none; align-items: center; gap: 20px; box-shadow: 0 10px 30px rgba(0,113,227,0.4);
    }
    .loader { border: 3px solid #f3f3f3; border-top: 3px solid var(--neon); border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: none; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const getWrapper = (content, lang = 'en') => {
    const t = LOCALES[lang] || LOCALES.en;
    return `
    <html>
        <head>
            <title>Icarus System</title>
            <style>${UI_STYLE}</style>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
        </head>
        <body class="light-mode">
            <div class="top-bar">
                <div class="lang-picker">
                    <button class="neon-btn" onclick="setLang('pl')">🇵🇱 Polski</button>
                    <button class="neon-btn" onclick="setLang('en')">🇬🇧 English</button>
                </div>
                <div class="theme-picker">
                    <button class="neon-btn" onclick="toggleTheme()" id="theme-icon">🔆</button>
                </div>
            </div>
            <div class="container">${content}</div>
            <div id="unsaved-banner">
                <span>${t.unsaved}</span>
                <button class="neon-btn" style="background: white; color: black; padding: 5px 15px;" onclick="saveCurrentConfig()">${t.save}</button>
            </div>
            <script>
                function setLang(l) { localStorage.setItem('lang', l); location.search = '?lang=' + l; }
                function toggleTheme() { 
                    const b = document.body;
                    b.classList.toggle('dark-mode'); b.classList.toggle('light-mode');
                    document.getElementById('theme-icon').innerText = b.classList.contains('dark-mode') ? '🌙' : '🔆';
                }
                function saveCurrentConfig() { document.querySelector('form').submit(); }
            </script>
        </body>
    </html>`;
};

// --- CORE ROUTES ---

app.get('/', (req, res) => {
    const lang = req.query.lang || 'en';
    const t = LOCALES[lang];
    res.send(getWrapper(`
        <div class="card">
            <h1 style="font-size: 42px; margin-bottom: 10px;">Icarus</h1>
            <p style="opacity: 0.6; margin-bottom: 40px;">Fingerprint Protection System</p>
            <a href="/login?target=verify" class="neon-btn" style="width: 80%; margin-bottom: 20px;">${t.v}</a>
            <a href="/login?target=dashboard" class="neon-btn" style="width: 80%; margin-bottom: 20px;">${t.m}</a>
            <a href="/owner-login" class="neon-btn" style="width: 80%; margin-top: 20px; color: var(--neon);">${t.o}</a>
        </div>
    `, lang));
});

// --- OWNER SYSTEM (PIN & LOCK) ---
app.get('/owner-login', async (req, res) => {
    const lang = req.query.lang || 'en';
    const ip = req.ip;
    const user = await UserData.findOne({ deviceId: ip });
    
    if (user?.isLocked) return res.send(getWrapper(`<div class="card"><h1>🚫</h1><p>${LOCALES[lang].locked}</p></div>`, lang));

    res.send(getWrapper(`
        <div class="card">
            <h2>System Authorization</h2>
            <form action="/owner-verify" method="POST">
                <input type="password" name="pin" style="width: 100%; padding: 15px; border-radius: 10px; border: 1px solid #ddd; margin: 20px 0;" placeholder="PIN CODE">
                <button class="neon-btn" style="width: 100%">${LOCALES[lang].loading}</button>
                <p style="font-size: 12px; color: red; margin-top: 15px;">${LOCALES[lang].pinErr} ${user ? user.attempts : 5}</p>
            </form>
        </div>
    `, lang));
});

app.post('/owner-verify', async (req, res) => {
    const { pin } = req.body;
    const ip = req.ip;
    let user = await UserData.findOne({ deviceId: ip }) || new UserData({ deviceId: ip });

    if (pin === "15052021") {
        user.attempts = 5; await user.save();
        req.session.isOwner = true;
        return res.redirect('/owner-dashboard');
    } else {
        user.attempts -= 1;
        if (user.attempts <= 0) {
            user.isLocked = true;
            // Notify you on PV
            const owner = await client.users.fetch(process.env.OWNER_ID);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`unlock_device_${ip.replace(/\./g, '_')}`).setLabel('Unlock Device (1 try)').setStyle(ButtonStyle.Danger)
            );
            owner.send({ content: `🚨 **SECURITY ALERT**: Failed login attempt to Owner Panel.\n**IP**: ${ip}\nDevice has been locked.`, components: [row] });
        }
        await user.save();
        res.redirect('/owner-login');
    }
});

// --- DISCORD INTERACTION HANDLER ---
client.on('interactionCreate', async (i) => {
    // Unlock Device from PV
    if (i.customId?.startsWith('unlock_device_')) {
        const ip = i.customId.split('_').slice(2).join('.');
        await UserData.findOneAndUpdate({ deviceId: ip }, { isLocked: false, attempts: 1 });
        const reply = await i.reply({ content: `✅ Device ${ip} unlocked for 1 attempt. PIN: ||15052021||`, fetchReply: true });
        setTimeout(() => reply.delete().catch(() => {}), 10000);
    }

    // Block Guild Modal
    if (i.customId?.startsWith('block_guild_btn_')) {
        const gid = i.customId.split('_')[3];
        const modal = new ModalBuilder().setCustomId(`modal_block_${gid}`).setTitle('Zablokuj Serwer');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Powód blokady').setStyle(TextInputStyle.Paragraph))
        );
        await i.showModal(modal);
    }

    if (i.type === InteractionType.ModalSubmit && i.customId.startsWith('modal_block_')) {
        const gid = i.customId.split('_')[2];
        const reason = i.fields.getTextInputValue('reason');
        const config = await GuildConfig.findOneAndUpdate({ guildId: gid }, { isBlocked: true, blockReason: reason }, { upsert: true, new: true });
        
        const guild = client.guilds.cache.get(gid);
        const logChan = guild?.channels.cache.get(config.logChannelId);
        
        // Translate and send to server
        const t = LOCALES[config.lang || 'en'];
        const blockEmbed = new EmbedBuilder()
            .setTitle(`🚫 ${t.blockMsg}`)
            .setDescription(`**${t.reason}** ${reason}\n\n${t.contact} icarus.system.pl@gmail.com`)
            .setColor('#ff3b30');
            
        if (logChan) logChan.send({ embeds: [blockEmbed] });
        await i.reply({ content: `Serwer ${guild?.name || gid} został pomyślnie zablokowany.`, ephemeral: true });
    }
});

// --- AUTH & CALLBACKS ---
app.get('/login', (req, res, next) => {
    const state = Buffer.from(JSON.stringify({ t: req.query.target })).toString('base64');
    passport.authenticate('discord', { state })(req, res, next);
});

app.get('/auth/callback', passport.authenticate('discord'), (req, res) => {
    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
    res.redirect('/' + state.t);
});

// --- START ---
app.listen(process.env.PORT || 3000, () => console.log("Icarus System Online."));
client.login(process.env.DISCORD_TOKEN);
