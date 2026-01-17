const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1456335080116191436';
const ROLE_ID = '1461789323262296084';

const MY_ID = '1131510639769178132'; 
const ALL_ADMINS = [MY_ID, '1364295526736199883', '1447828677109878904'];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Połączono z MongoDB Atlas"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, country: String }));
const PanelTracker = mongoose.model('PanelTracker', new mongoose.Schema({ targetId: String, adminMessages: [{ adminId: String, messageId: String }] }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' } }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const app = express();
app.use(express.urlencoded({ extended: true }));

// --- AKTUALIZACJA STATUSU ---
async function updateLiveStatus(targetId, newStatus, actionText) {
    console.log(`Zmieniam status dla ${targetId} na: ${newStatus}`);
    await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: newStatus }, { upsert: true });
    
    const panel = await PanelTracker.findOne({ targetId });
    if (!panel) return;

    for (const entry of panel.adminMessages) {
        try {
            const admin = await client.users.fetch(entry.adminId);
            const message = await admin.dmChannel.messages.fetch(entry.messageId);
            await message.edit({ content: `**ZAKOŃCZONO:** ${actionText}`, components: [] });
        } catch (e) { console.log("Nie udało się edytować wiadomości u admina."); }
    }
    await PanelTracker.deleteOne({ targetId });
}

// --- STRONA WWW ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Weryfikacja Konta</title>
            <style>
                :root {
                    --discord-blurple: #5865f2;
                    --success: #43b581;
                    --warning: #faa61a;
                    --danger: #f04747;
                    --text: #ffffff;
                }

                body { 
                    margin: 0;
                    padding: 0;
                    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    overflow: hidden;
                    /* Animowany Gradient w tle */
                    background: linear-gradient(-45deg, #0f0c29, #302b63, #24243e, #1a1a2e);
                    background-size: 400% 400%;
                    animation: gradientBG 12s ease infinite;
                }

                @keyframes gradientBG {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                .box { 
                    background: rgba(44, 47, 51, 0.7); /* Szklany efekt */
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    padding: 60px 40px; 
                    border-radius: 24px; 
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5); 
                    max-width: 420px;
                    width: 85%;
                    text-align: center;
                    border: 1px solid rgba(255,255,255,0.1);
                    transform: translateY(0);
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                h2 { margin: 0 0 10px 0; font-size: 32px; color: white; letter-spacing: 1px; }
                p { color: #dcddde; margin-bottom: 35px; line-height: 1.6; font-size: 16px; }

                button { 
                    background: var(--discord-blurple); 
                    color: white; 
                    padding: 18px 0; 
                    border: none; 
                    border-radius: 12px; 
                    cursor: pointer; 
                    font-weight: 800; 
                    font-size: 16px;
                    width: 100%;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    transition: all 0.3s ease;
                    box-shadow: 0 8px 20px rgba(88, 101, 242, 0.4);
                }

                button:hover { 
                    background: #4752c4; 
                    transform: translateY(-3px);
                    box-shadow: 0 12px 25px rgba(88, 101, 242, 0.5);
                }

                button:active { transform: translateY(-1px); }

                .spinner {
                    width: 60px;
                    height: 60px;
                    border: 6px solid rgba(255,255,255,0.1);
                    border-top: 6px solid var(--discord-blurple);
                    border-radius: 50%;
                    animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
                    margin: 20px auto;
                }

                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

                .status-icon { font-size: 70px; margin-bottom: 25px; display: block; filter: drop-shadow(0 0 15px rgba(255,255,255,0.2)); }
                
                .footer-text { font-size: 12px; color: rgba(255,255,255,0.3); margin-top: 30px; text-transform: uppercase; }
            </style>
        </head>
        <body>
            <div class="box">
                <div id="content">
                    <span class="status-icon">🛡️</span>
                    <h2>WERYFIKACJA</h2>
                    <p>Potwierdź swoją tożsamość, aby odblokować dostęp do kanałów serwera.</p>
                    <button id="vBtn">ROZPOCZNIJ TERAZ</button>
                    <div class="footer-text">Protected by Discord Guard</div>
                </div>
            </div>

            <script>
                const content = document.getElementById('content');
                document.getElementById('vBtn').onclick = async () => {
                    content.innerHTML = '<div class="spinner"></div><h3 style="margin-top:20px">ANALIZA POŁĄCZENIA...</h3>';
                    
                    const r = await fetch('/complete', { 
                        method: 'POST', 
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        body: 'userId=${userId}' 
                    });
                    const d = await r.json();

                    if (d.action === 'wait') {
                        content.innerHTML = \`
                            <span class="status-icon">⏳</span>
                            <h3 style="color:var(--warning); font-size:24px">RĘCZNA KONTROLA</h3>
                            <p>Twoje połączenie wzbudziło czujność systemu. Administrator musi Cię zaakceptować ręcznie. <br><br><b>Nie zamykaj tej karty!</b></p>
                        \`;
                        startPolling('${userId}');
                    } else if (d.action === 'success') {
                        showSuccess();
                    } else {
                        content.innerHTML = \`
                            <span class="status-icon">❌</span>
                            <h3 style="color:var(--danger)">ODMOWA DOSTĘPU</h3>
                            <p>\${d.msg}</p>
                            <button onclick="location.reload()">SPRÓBUJ PONOWNIE</button>
                        \`;
                    }
                };

                function showSuccess() {
                    content.innerHTML = \`
                        <span class="status-icon">✅</span>
                        <h2 style="color:var(--success)">SUKCES!</h2>
                        <p>Weryfikacja zakończona pomyślnie. Twoja rola została nadana automatycznie.</p>
                        <div class="footer-text">Możesz już wrócić na Discorda</div>
                    \`;
                }

                function startPolling(uid) {
                    const timer = setInterval(async () => {
                        try {
                            const check = await fetch('/status?userId=' + uid);
                            const s = await check.json();
                            if (s.status === 'allowed') {
                                clearInterval(timer);
                                showSuccess();
                            } else if (s.status === 'banned') {
                                clearInterval(timer);
                                content.innerHTML = \`
                                    <span class="status-icon">🚫</span>
                                    <h3 style="color:var(--danger)">ZABLOKOWANO</h3>
                                    <p>Administrator odrzucił Twoją prośbę o wejście na serwer.</p>
                                \`;
                            }
                        } catch (e) {}
                    }, 2500);
                }
            </script>
        </body>
        </html>
    `);
});

// --- API STATUSU ---
app.get('/status', async (req, res) => {
    const userId = req.query.userId;
    const track = await RequestTracker.findOne({ userId });
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ status: track ? track.status : 'pending' });
});

app.post('/complete', async (req, res) => {
    const userId = req.body.userId;
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const cleanIP = userIP.split(',')[0].trim();

    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const result = response.data[cleanIP];
        const country = result.isocode || '??';
        
        const existingEntry = await UserIP.findOne({ ip: cleanIP });
        const isVPN = result.proxy === 'yes';
        const isForeign = country !== 'PL'; 
        const isMulticount = existingEntry && existingEntry.userId !== userId;

        if (isVPN) return res.json({ action: 'error', msg: 'Używanie VPN jest surowo zabronione.' });

        if (isMulticount || isForeign) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            
            const embed = new EmbedBuilder().setColor('#ffaa00').setTitle('⚠️ WYKRYTO PODEJRZANE IP').setDescription(`Użytkownik: <@${userId}>\nKraj: **${country}**\nIP: \`${cleanIP}\`\nPowód: **${isForeign ? 'Zagraniczne IP' : 'Podejrzenie Multikonta'}**`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`allow_${userId}_${cleanIP}_${country}`).setLabel('Przepuść').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel('Zablokuj').setStyle(ButtonStyle.Danger)
            );

            const adminMsgs = [];
            for (const id of ALL_ADMINS) {
                try {
                    const admin = await client.users.fetch(id);
                    const msg = await admin.send({ embeds: [embed], components: [row] });
                    adminMsgs.push({ adminId: id, messageId: msg.id });
                } catch(err) { console.log(`Nie można wysłać DM do admina ${id}`); }
            }
            await new PanelTracker({ targetId: userId, adminMessages: adminMsgs }).save();
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip: cleanIP, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Wystąpił błąd podczas sprawdzania IP.' }); }
});

client.on('interactionCreate', async (int) => {
    if (!int.isButton()) return;
    const [action, targetId, ip, country] = int.customId.split('_');
    const guild = await client.guilds.fetch(GUILD_ID);

    try {
        if (action === 'allow') {
            const member = await guild.members.fetch(targetId);
            await member.roles.add(ROLE_ID);
            if (ip) await UserIP.findOneAndUpdate({ userId: targetId }, { ip, country }, { upsert: true });
            await updateLiveStatus(targetId, 'allowed', `✅ Zaakceptowano przez **${int.user.tag}**`);
            await int.reply({ content: `Użytkownik <@${targetId}> został wpuszczony.`, ephemeral: true });
        } else {
            await guild.members.ban(targetId, { reason: 'Odrzucono weryfikację' });
            await updateLiveStatus(targetId, 'banned', `🚫 Zbanowano przez **${int.user.tag}**`);
            await int.reply({ content: `Użytkownik <@${targetId}> został zbanowany.`, ephemeral: true });
        }
    } catch (e) { console.log("Błąd przetwarzania przycisku."); }
});

client.on('ready', () => { console.log(`🤖 Bot zalogowany jako ${client.user.tag}`); });

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
