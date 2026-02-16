const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1464901079593521322';
const ROLE_ID = '1473060746194845959';
const ALL_ADMINS = ['1131510639769178132', '1276586330847051780', '1210653947061080175'];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Baza danych aktywna"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String, operator: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' }, reason: String }));
// Model do śledzenia logów u adminów
const AdminLog = mongoose.model('AdminLog', new mongoose.Schema({ targetId: String, messages: [{ adminId: String, messageId: String }] }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Night RP | Security</title>
            <style>
                body { margin: 0; padding: 0; font-family: sans-serif; background: #0d0d12 url('https://discord.com/assets/652f404f275e28ef9a35.png') no-repeat center center fixed; background-size: cover; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .card { background: rgba(10, 10, 15, 0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); padding: 50px; border-radius: 30px; text-align: center; max-width: 400px; width: 90%; color: white; }
                .btn { background: #5865f2; color: white; padding: 18px; border: none; border-radius: 15px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; margin-top: 25px; }
                .spinner { width: 45px; height: 45px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #5865f2; border-radius: 50%; animation: spin 1s linear infinite; margin: 25px auto; display: none; }
                @keyframes spin { to { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="card" id="box">
                <h1>🛡️ Weryfikacja</h1>
                <p>System Night RP sprawdza Twoje połączenie.</p>
                <div class="spinner" id="loader"></div>
                <button class="btn" id="startBtn">AUTORYZUJ DOSTĘP</button>
            </div>
            <script>
                async function checkStatus() {
                    const res = await fetch('/status?userId=${userId}');
                    const s = await res.json();
                    if(s.status === 'allowed_manually' || s.status === 'success') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#43b581;">✅ Zaakceptowano</h1><p>Administrator zatwierdził Twój dostęp. Witamy!</p>';
                    } else if(s.status === 'rejected') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#f04747;">❌ Odrzucono</h1><p>Powód: ' + (s.reason || 'Brak') + '</p>';
                    }
                }
                document.getElementById('startBtn').onclick = async () => {
                    document.getElementById('startBtn').style.display = 'none';
                    document.getElementById('loader').style.display = 'block';
                    const r = await fetch('/complete', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: '${userId}', fp: btoa(navigator.userAgent) }) });
                    const d = await r.json();
                    if(d.action === 'success') { document.getElementById('box').innerHTML = '<h1>✅ Sukces</h1>'; }
                    else if(d.action === 'wait') { document.getElementById('box').innerHTML = '<h1>⏳ Oczekiwanie</h1>'; setInterval(checkStatus, 3000); }
                    else { document.getElementById('box').innerHTML = '<h1>❌ Błąd</h1><p>'+d.msg+'</p>'; }
                };
            </script>
        </body>
        </html>
    `);
});

app.get('/status', async (req, res) => {
    const doc = await RequestTracker.findOne({ userId: req.query.userId });
    res.json({ status: doc ? doc.status : 'pending', reason: doc ? doc.reason : '' });
});

// --- FUNKCJA DO AKTUALIZACJI LOGÓW U WSZYSTKICH ADMINÓW ---
async function updateAllAdminMessages(targetId, adminUser, actionType, reason = null) {
    const logDoc = await AdminLog.findOne({ targetId });
    if (!logDoc) return;

    const color = actionType === 'accept' ? '#43b581' : '#f04747';
    const statusText = actionType === 'accept' ? `✅ Zaakceptowano przez <@${adminUser.id}>` : `❌ Odrzucono przez <@${adminUser.id}>\n**Powód:** ${reason}`;

    for (const entry of logDoc.messages) {
        try {
            const admin = await client.users.fetch(entry.adminId);
            const msg = await admin.dmChannel.messages.fetch(entry.messageId);
            const embed = EmbedBuilder.from(msg.embeds[0]).setColor(color).setDescription(statusText);
            await msg.edit({ embeds: [embed], components: [] });
        } catch (e) { console.log("Nie udało się edytować wiadomości u admina"); }
    }
    await AdminLog.deleteOne({ targetId });
}

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        const [action, targetId] = interaction.customId.split('_');
        if (action === 'accept') {
            await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed_manually' });
            const guild = await client.guilds.fetch(GUILD_ID);
            const member = await guild.members.fetch(targetId);
            await member.roles.add(ROLE_ID);
            await updateAllAdminMessages(targetId, interaction.user, 'accept');
            await interaction.reply({ content: 'Zaakceptowano!', ephemeral: true });
        }
        if (action === 'reject') {
            const modal = new ModalBuilder().setCustomId(`modal_reject_${targetId}`).setTitle('Powód odrzucenia');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Powód').setStyle(TextInputStyle.Paragraph).setRequired(true)));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_reject_')) {
        const targetId = interaction.customId.split('_')[2];
        const reason = interaction.fields.getTextInputValue('reason');
        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'rejected', reason });
        await updateAllAdminMessages(targetId, interaction.user, 'reject', reason);
        await interaction.reply({ content: 'Odrzucono!', ephemeral: true });
    }
});

async function sendAdminLogs(targetId, ip, country, operator, type) {
    const embed = new EmbedBuilder().setTitle(`📢 LOG: ${type}`).addFields({ name: '👤 Użytkownik', value: `<@${targetId}>` }, { name: '🌍 Kraj', value: country }, { name: '🔍 IP', value: `\`${ip}\`` }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${targetId}`).setLabel('AKCEPTUJ').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${targetId}`).setLabel('ODRZUĆ').setStyle(ButtonStyle.Danger)
    );

    const messageEntries = [];
    for (const id of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(id);
            const m = await admin.send({ embeds: [embed], components: [row] });
            messageEntries.push({ adminId: id, messageId: m.id });
        } catch (e) {}
    }
    await AdminLog.create({ targetId, messages: messageEntries });
}

app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const cleanIP = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    try {
        const duplicateDevice = await UserIP.findOne({ fingerprint: fp, userId: { $ne: userId } });
        if (duplicateDevice) return res.json({ action: 'error', msg: 'Multikonto (Urządzenie)' });

        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const result = response.data[cleanIP];
        const country = result.isocode || '??';
        
        const duplicateIP = await UserIP.findOne({ ip: cleanIP, userId: { $ne: userId } });
        if (country !== 'PL' || duplicateIP) {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            await sendAdminLogs(userId, cleanIP, country, result.asn || '?', "WERYFIKACJA RĘCZNA ⚠️");
            return res.json({ action: 'wait' });
        }

        await new UserIP({ userId, ip: cleanIP, fingerprint: fp, country }).save();
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd systemu.' }); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000);
