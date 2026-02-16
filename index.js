const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- KONFIGURACJA ---
const BOT_TOKEN = process.env.DISCORD_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const PROXYCHECK_API_KEY = 'e2brv7-y9y366-243469-435457';
const GUILD_ID = '1464901079593521322';
const ROLE_ID = '1473060746194845959';
const ALL_ADMINS = ['1131510639769178132', '1276586330847051780', '1210653947061080175'];

mongoose.connect(MONGO_URI).then(() => console.log("✅ Baza danych aktywna"));

const UserIP = mongoose.model('UserIP', new mongoose.Schema({ userId: String, ip: String, fingerprint: String, country: String, operator: String }));
const RequestTracker = mongoose.model('RequestTracker', new mongoose.Schema({ userId: String, status: { type: String, default: 'pending' }, reason: String }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages] });
const app = express();
app.use(express.json());

// --- STRONA WERYFIKACJI ---
app.get('/auth', (req, res) => {
    const userId = req.query.token;
    res.send(`
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Night RP | Security</title>
            <style>
                body { margin: 0; padding: 0; font-family: sans-serif; background: #0d0d12 url('https://w.wallhaven.cc/full/85/wallhaven-85m89y.jpg') no-repeat center center fixed; background-size: cover; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                .card { background: rgba(10, 10, 15, 0.8); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); padding: 50px; border-radius: 30px; text-align: center; max-width: 400px; width: 90%; color: white; }
                .btn { background: #5865f2; color: white; padding: 16px; border: none; border-radius: 14px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; margin-top: 20px; }
                .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #5865f2; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto; display: none; }
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
                    if(s.status === 'allowed_manually') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#43b581;">✅ Zaakceptowano</h1><p>Administrator zatwierdził Twój dostęp ręcznie. Możesz wejść!</p>';
                    } else if(s.status === 'rejected') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#f04747;">❌ Odrzucono</h1><p>Twoja prośba została odrzucona.<br><b>Powód:</b> ' + (s.reason || 'Brak podanego powodu') + '</p>';
                    }
                }

                document.getElementById('startBtn').onclick = async () => {
                    document.getElementById('startBtn').style.display = 'none';
                    document.getElementById('loader').style.display = 'block';
                    const r = await fetch('/complete', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId: '${userId}', fp: btoa(navigator.userAgent) })
                    });
                    const d = await r.json();
                    if(d.action === 'success') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#43b581;">✅ Sukces</h1><p>Zweryfikowano automatycznie!</p>';
                    } else if(d.action === 'wait') {
                        document.getElementById('box').innerHTML = '<h1 style="color:#faa61a;">⏳ Oczekiwanie</h1><p>Czekaj na decyzję Admina...</p>';
                        setInterval(checkStatus, 4000);
                    } else {
                        document.getElementById('box').innerHTML = '<h1>❌ Błąd</h1><p>' + d.msg + '</p>';
                    }
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

// --- LOGIKA PRZYCISKÓW I MODALI ---
client.on('interactionCreate', async (interaction) => {
    // 1. Obsługa Przycisku "Akceptuj"
    if (interaction.isButton() && interaction.customId.startsWith('accept_')) {
        const targetId = interaction.customId.split('_')[1];
        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'allowed_manually' });

        try {
            const guild = await client.guilds.fetch(GUILD_ID);
            const member = await guild.members.fetch(targetId);
            await member.roles.add(ROLE_ID);

            const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor('#43b581')
                .setDescription(`✅ **ZAAKCEPTOWANO** przez <@${interaction.user.id}>`);
            
            await interaction.update({ embeds: [newEmbed], components: [] });
        } catch (e) { await interaction.reply({ content: 'Błąd roli!', ephemeral: true }); }
    }

    // 2. Obsługa Przycisku "Odrzuć" (Otwiera Modal)
    if (interaction.isButton() && interaction.customId.startsWith('reject_')) {
        const targetId = interaction.customId.split('_')[1];
        const modal = new ModalBuilder()
            .setCustomId(`modal_reject_${targetId}`)
            .setTitle('Powód odrzucenia');

        const input = new TextInputBuilder()
            .setCustomId('reject_reason')
            .setLabel('Dlaczego odrzucasz tego gracza?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // 3. Obsługa Formularza (Modal)
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_reject_')) {
        const targetId = interaction.customId.split('_')[2];
        const reason = interaction.fields.getTextInputValue('reject_reason');

        await RequestTracker.findOneAndUpdate({ userId: targetId }, { status: 'rejected', reason: reason });

        const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('#f04747')
            .setDescription(`❌ **ODRZUCONO** przez <@${interaction.user.id}>\n**Powód:** ${reason}`);

        await interaction.update({ embeds: [newEmbed], components: [] });
    }
});

// --- FUNKCJA WYSYŁANIA LOGÓW ---
async function sendAdminLogs(targetId, ip, country, operator, type) {
    const embed = new EmbedBuilder()
        .setColor(type.includes('⚠️') ? '#faa61a' : '#43b581')
        .setTitle(`📢 LOG: ${type}`)
        .addFields(
            { name: '👤 Użytkownik', value: `<@${targetId}>`, inline: true },
            { name: '🌍 Kraj', value: country, inline: true },
            { name: '🏢 Operator', value: `\`${operator}\``, inline: true },
            { name: '🔍 IP', value: `\`${ip}\``, inline: false }
        ).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${targetId}`).setLabel('AKCEPTUJ ✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`reject_${targetId}`).setLabel('ODRZUĆ ❌').setStyle(ButtonStyle.Danger)
    );

    for (const id of ALL_ADMINS) {
        try {
            const admin = await client.users.fetch(id);
            await admin.send({ embeds: [embed], components: type.includes('⚠️') ? [row] : [] });
        } catch (e) {}
    }
}

// --- LOGIKA KOMPLETOWANIA (Backend) ---
app.post('/complete', async (req, res) => {
    const { userId, fp } = req.body;
    const cleanIP = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    try {
        const response = await axios.get(`https://proxycheck.io/v2/${cleanIP}?key=${PROXYCHECK_API_KEY}&vpn=3&asn=1`);
        const result = response.data[cleanIP];
        const country = result.isocode || '??';
        const operator = result.asn || 'Nieznany';

        if (country !== 'PL') {
            await RequestTracker.findOneAndUpdate({ userId }, { status: 'pending' }, { upsert: true });
            await sendAdminLogs(userId, cleanIP, country, operator, "WYMAGA AKCEPTACJI ⚠️");
            return res.json({ action: 'wait' });
        }
        
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID);
        await sendAdminLogs(userId, cleanIP, country, operator, "AUTOMATYCZNA ✅");
        res.json({ action: 'success' });
    } catch (e) { res.json({ action: 'error', msg: 'Błąd systemu.' }); }
});

client.login(BOT_TOKEN);
app.listen(process.env.PORT || 3000, () => console.log("🚀 Serwer działa!"));
